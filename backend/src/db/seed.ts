/**
 * Dane przykładowe: sieć oświetlenia ulicznego w centrum Żor.
 *
 *   npm run db:seed            # tylko gdy w bazie nie ma jeszcze szaf
 *   npm run db:seed -- --reset # czyści sieć (szafy, obwody, oprawy, słupy bez nazwy/skanów) i seeduje od nowa
 *
 * Słupy są rozmieszczane wzdłuż prawdziwych ulic (geometria z OpenStreetMap w seed-streets.json,
 * © OpenStreetMap contributors, ODbL). Zasady numeracji jak w dokumentacji eksploatacyjnej:
 *  - numer rośnie od szafy wzdłuż kabla: 1, 2, 3…
 *  - odgałęzienie od słupa 8: 8/1, 8/2…, a od 8/2: 8/2/1… (łamanie numerów)
 *  - kilka opraw na słupie: indeksy a, b
 *  - fazy podłączane naprzemiennie: L1, L2, L3, L1…
 *
 * Istniejące nazwane punkty (np. „Rynek”) zostają i są podpinane do najbliższego słupa sieci.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from './db.module';
import { runMigrations } from './migrate';
import { cabinets, circuits, fixtures, points, scans, type Phase } from './schema';
import { poleLabel } from '../network/label';

type LL = [number, number];

/* ---------- Geometria (lokalny układ metryczny wokół Żor) ---------- */

const LAT0 = 50.04;
const M_LAT = 111_132;
const M_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const toXY = ([lat, lng]: LL): LL => [(lng - 18.69) * M_LNG, (lat - LAT0) * M_LAT];
const toLL = ([x, y]: LL): LL => [+(LAT0 + y / M_LAT).toFixed(7), +(18.69 + x / M_LNG).toFixed(7)];
const dist = (a: LL, b: LL) => Math.hypot(...(toXY(a).map((v, i) => v - toXY(b)[i]) as LL));

class Street {
  readonly xy: LL[];
  readonly cum: number[] = [0];
  constructor(
    readonly name: string,
    pts: LL[],
  ) {
    this.xy = pts.map(toXY);
    for (let i = 1; i < this.xy.length; i++) {
      const [a, b] = [this.xy[i - 1], this.xy[i]];
      this.cum.push(this.cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
  }
  get length() {
    return this.cum[this.cum.length - 1];
  }
  /** Położenie (długość łuku) najbliższego punktu ulicy. */
  project(p: LL): number {
    const [px, py] = toXY(p);
    let best = { d: Infinity, s: 0 };
    for (let i = 1; i < this.xy.length; i++) {
      const [ax, ay] = this.xy[i - 1];
      const [bx, by] = this.xy[i];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
      const d = Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py);
      if (d < best.d) best = { d, s: this.cum[i - 1] + t * (this.cum[i] - this.cum[i - 1]) };
    }
    return best.s;
  }
  at(s: number): LL {
    s = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const t = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1);
    const [a, b] = [this.xy[i - 1], this.xy[i]];
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }
  /**
   * Kolejne punkty co `spacing` m od miejsca najbliższego `start`, w stronę `towards`
   * (domyślnie tam, gdzie zostało więcej ulicy), odsunięte o `offset` m na prawo od kierunku marszu.
   */
  walk(start: LL, count: number, spacing: number, first: number, towards?: LL, offset = 6): LL[] {
    const s0 = this.project(start);
    let dir = this.length - s0 >= s0 ? 1 : -1;
    if (towards) {
      const t = toXY(towards);
      const d = (s: number) => Math.hypot(...(this.at(s).map((v, i) => v - t[i]) as LL));
      dir = d(s0 + 40) <= d(s0 - 40) ? 1 : -1;
    }
    const out: LL[] = [];
    for (let i = 0; i < count; i++) {
      const s = s0 + dir * (first + i * spacing);
      if (s < 0 || s > this.length) break;
      const [x, y] = this.at(s);
      const [ax, ay] = this.at(s - 1);
      const [bx, by] = this.at(s + 1);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      // Normalna po prawej stronie kierunku marszu.
      const nx = ((by - ay) / len) * dir;
      const ny = (-(bx - ax) / len) * dir;
      out.push(toLL([x + nx * offset, y + ny * offset]));
    }
    return out;
  }
}

const raw = JSON.parse(readFileSync(resolve(__dirname, 'seed-streets.json'), 'utf8')) as Record<
  string,
  { name: string; points: LL[] }
>;
const streets = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, new Street(v.name, v.points)]));
type StreetKey = keyof typeof raw;

function displayStreet(name: string) {
  if (name === 'Rynek') return 'Rynek';
  if (name.startsWith('Aleja ')) return `al. ${name.slice(6)}`;
  if (name.startsWith('Osiedle ')) return `os. ${name.slice(8)}`;
  return `ul. ${name}`;
}

/* ---------- Opis sieci ---------- */

interface FixtureSpec {
  model: string;
  powerW: number;
}

interface LineSpec {
  street: StreetKey;
  count: number;
  /** Punkt startowy (domyślnie: poprzedni słup / szafa). */
  near?: LL;
  /** Kierunek marszu wzdłuż ulicy. */
  towards?: LL;
  spacing?: number;
  /** Druga oprawa (indeksy a/b) na co n-tym słupie; 1 = na każdym. */
  doubleEvery?: number;
  second?: FixtureSpec;
  planned?: boolean;
  /** Odgałęzienia od n-tego słupa tej linii (licząc od 1). */
  branches?: { at: number; line: LineSpec }[];
  /** Linia biegnie dalej inną ulicą z ciągłą numeracją. */
  then?: LineSpec;
}

interface CircuitSpec {
  number: number;
  description: string;
  fixture: FixtureSpec;
  cable: string;
  spacing: number;
  line: LineSpec;
}

interface CabinetSpec {
  number: string;
  name: string;
  at: LL;
  notes: string;
  circuits: CircuitSpec[];
}

const LED = (w: number, extra = ''): FixtureSpec => ({ model: `LED ${w} W${extra}`, powerW: w });
const SON = (w: number): FixtureSpec => ({ model: `SON-T ${w} W (sodowa)`, powerW: w });
const CROSSING = LED(40, ', doświetlenie przejścia');
const SIDEWALK = LED(24, ', chodnikowa');

const NETWORK: CabinetSpec[] = [
  {
    number: '84',
    name: 'ul. Wodzisławska',
    at: [50.04305, 18.68915],
    notes: 'Szafa wolnostojąca SOU, sterownik astronomiczny, zabezpieczenia obwodów C10.',
    circuits: [
      {
        number: 1,
        description: 'ul. Wodzisławska kier. zachód',
        fixture: LED(56),
        cable: 'YAKXS 4x35',
        spacing: 34,
        line: {
          street: 'wodzislawska',
          count: 14,
          towards: [50.0413, 18.6822],
          doubleEvery: 5,
          second: CROSSING,
          branches: [
            {
              // Odgałęzienie w ul. Księcia Leszka: 8/1, 8/2…
              at: 8,
              line: {
                street: 'ksLeszka',
                count: 7,
                towards: [50.0409, 18.6849],
                spacing: 32,
                branches: [
                  {
                    // Projektowane przedłużenie w os. Księcia Władysława: 8/7/1…8/7/4 (jak 84/I/8/2/1… na schemacie)
                    at: 7,
                    line: { street: 'osKsWladyslawa', count: 4, towards: [50.0408, 18.6873], spacing: 34, planned: true },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        number: 2,
        description: 'ul. Folwarecka',
        fixture: SON(70),
        cable: 'YAKY 4x25',
        spacing: 36,
        line: { street: 'folwarecka', count: 16, towards: [50.0503, 18.6672] },
      },
      {
        number: 3,
        description: 'al. Niepodległości',
        fixture: LED(36),
        cable: 'YAKXS 4x35',
        spacing: 30,
        line: { street: 'niepodleglosci', count: 8, towards: [50.0453, 18.6886] },
      },
      {
        number: 4,
        description: 'ul. Boryńska',
        fixture: LED(56),
        cable: 'YAKXS 4x35',
        spacing: 35,
        line: { street: 'borynska', count: 12, towards: [50.0343, 18.6867], doubleEvery: 6, second: CROSSING },
      },
    ],
  },
  {
    number: '12',
    name: 'Rynek',
    at: [50.04532, 18.69318],
    notes: 'Szafa przy ul. Moniuszki, sterowanie zmierzch/świt + zegar, 6 obwodów. Oprawy stylizowane na Rynku.',
    circuits: [
      {
        number: 1,
        description: 'Rynek',
        fixture: LED(40, ', stylizowana'),
        cable: 'YAKXS 4x35',
        spacing: 26,
        line: { street: 'rynek', count: 13, doubleEvery: 4, second: LED(40, ', stylizowana') },
      },
      {
        number: 2,
        description: 'ul. Moniuszki – Ogrodowa',
        fixture: LED(36),
        cable: 'YAKXS 4x35',
        spacing: 30,
        line: {
          street: 'moniuszki',
          count: 7,
          towards: [50.04445, 18.69106],
          then: {
            street: 'ogrodowa',
            count: 12,
            towards: [50.04418, 18.69605],
            branches: [
              {
                at: 4,
                line: { street: 'bramkowa', count: 3, towards: [50.04542, 18.69718], spacing: 28, planned: true },
              },
            ],
          },
        },
      },
      {
        number: 3,
        description: 'ul. Szeroka – Dworcowa',
        fixture: LED(56),
        cable: 'YAKXS 4x35',
        spacing: 32,
        line: {
          street: 'szeroka',
          count: 8,
          near: [50.04545, 18.69534],
          towards: [50.04685, 18.69806],
          doubleEvery: 4,
          second: CROSSING,
          then: { street: 'dworcowa', count: 14, near: [50.04704, 18.6983], towards: [50.051, 18.70418], doubleEvery: 7, second: CROSSING },
        },
      },
      {
        number: 4,
        description: 'ul. Bramkowa',
        fixture: LED(36),
        cable: 'YAKXS 4x35',
        spacing: 30,
        line: { street: 'bramkowa', count: 7, near: [50.04542, 18.69718], towards: [50.04407, 18.69314] },
      },
      {
        number: 5,
        description: 'ul. Garncarska',
        fixture: SON(100),
        cable: 'YAKY 4x25',
        spacing: 33,
        line: { street: 'garncarska', count: 14, near: [50.04477, 18.69189], towards: [50.04642, 18.69711] },
      },
      {
        number: 6,
        description: 'ul. Kościuszki – Huloki',
        fixture: LED(72),
        cable: 'YAKXS 4x35',
        spacing: 35,
        line: {
          street: 'kosciuszkiCentrum',
          count: 6,
          near: [50.04535, 18.69505],
          towards: [50.04355, 18.69664],
          then: {
            street: 'kosciuszki',
            count: 10,
            near: [50.04339, 18.69667],
            towards: [50.029, 18.705],
            doubleEvery: 5,
            second: CROSSING,
            branches: [{ at: 1, line: { street: 'huloki', count: 4, towards: [50.04406, 18.69829], spacing: 32 } }],
          },
        },
      },
    ],
  },
  {
    number: '04',
    name: 'al. Zjednoczonej Europy',
    at: [50.03452, 18.68805],
    notes: 'Szafa przy skrzyżowaniu z al. Jana Pawła II. Obwód 2: oprawy drogowe + chodnikowe na każdym słupie.',
    circuits: [
      {
        number: 1,
        description: 'al. Zjednoczonej Europy kier. zachód',
        fixture: LED(90),
        cable: 'YAKXS 4x35',
        spacing: 38,
        line: { street: 'europy', count: 14, towards: [50.0354, 18.67365] },
      },
      {
        number: 2,
        description: 'al. Zjednoczonej Europy kier. wschód',
        fixture: LED(90),
        cable: 'YAKXS 4x35',
        spacing: 38,
        line: { street: 'europy', count: 20, towards: [50.03384, 18.70266], doubleEvery: 1, second: SIDEWALK },
      },
      {
        number: 3,
        description: 'al. Jana Pawła II',
        fixture: LED(72),
        cable: 'YAKXS 4x35',
        spacing: 36,
        line: { street: 'janaPawla', count: 14, towards: [50.0428, 18.6898], doubleEvery: 7, second: CROSSING },
      },
    ],
  },
];

/* ---------- Generowanie ---------- */

type PointRow = typeof points.$inferInsert;
type FixtureRow = typeof fixtures.$inferInsert;
interface Pole {
  row: PointRow;
  pos: LL;
}

const PHASES: Phase[] = ['L1', 'L2', 'L3'];
let inventorySeq = 14_500;

function generate() {
  const cabinetRows: (typeof cabinets.$inferInsert)[] = [];
  const circuitRows: (typeof circuits.$inferInsert)[] = [];
  const poles: Pole[] = [];
  const fixtureRows: FixtureRow[] = [];
  const now = Date.now();

  for (const cab of NETWORK) {
    const cabinetId = randomUUID();
    cabinetRows.push({
      id: cabinetId,
      number: cab.number,
      name: cab.name,
      lat: cab.at[0],
      lng: cab.at[1],
      address: `${cab.name}, Żory`,
      notes: cab.notes,
    });

    for (const c of cab.circuits) {
      const circuitId = randomUUID();
      circuitRows.push({ id: circuitId, cabinetId, number: c.number, description: c.description });
      let phaseIdx = 0;

      const buildLine = (spec: LineSpec, base: string | null, counter: { n: number }, parent: Pole | null, from: LL) => {
        const street = streets[spec.street];
        const spacing = spec.spacing ?? c.spacing;
        const positions = street.walk(spec.near ?? from, spec.count, spacing, parent ? spacing * 0.6 : spacing * 0.35, spec.towards);
        let prev = parent;
        positions.forEach((pos, i) => {
          const number = `${base ? `${base}/` : ''}${++counter.n}`;
          const planned = !!spec.planned;
          const origin = prev?.pos ?? cab.at;
          const id = randomUUID();
          const label = poleLabel(cab.number, c.number, number);
          const row: PointRow = {
            id,
            name: displayStreet(street.name),
            lat: pos[0],
            lng: pos[1],
            address: `${displayStreet(street.name)}, Żory`,
            content: planned
              ? `Słup projektowany ${label}. Planowane podłączenie do ${cabinetLabelOf(cab)}, obwód ${c.number}.`
              : `Zgłaszając awarię oświetlenia, podaj numer z tabliczki na słupie: ${label}.`,
            circuitId,
            parentId: prev?.row.id ?? null,
            number,
            inventoryId: planned ? null : `OU-${++inventorySeq}`,
            status: planned ? 'planned' : 'existing',
            cableLength: Math.round(dist(origin, pos) * 1.05),
            cableType: planned ? 'YAKXS 4x35' : c.cable,
            // Kolejność tworzenia = kolejność na listach (najnowsze u góry).
            createdAt: new Date(now - 1_000_000 + poles.length * 1000),
            updatedAt: new Date(now),
          };
          const pole = { row, pos };
          poles.push(pole);

          const double = spec.doubleEvery && spec.second && (i + 1) % spec.doubleEvery === 0;
          const main = planned ? LED(36, ' (proj.)') : c.fixture;
          const list = double ? [main, spec.second!] : [main];
          list.forEach((f, k) =>
            fixtureRows.push({
              pointId: id,
              suffix: double ? String.fromCharCode(97 + k) : null,
              phase: PHASES[phaseIdx++ % 3],
              powerW: f.powerW,
              model: f.model,
              position: k,
            }),
          );

          for (const b of spec.branches?.filter((x) => x.at === i + 1) ?? []) {
            buildLine(b.line, number, { n: 0 }, pole, pos);
          }
          prev = pole;
        });
        if (spec.then && prev) buildLine(spec.then, base, counter, prev, prev.pos);
      };

      buildLine(c.line, null, { n: 0 }, null, cab.at);
    }
  }
  return { cabinetRows, circuitRows, poles, fixtureRows };
}

const cabinetLabelOf = (c: { number: string }) => `SOU-${c.number}`;

/* ---------- Zapis ---------- */

async function main() {
  const reset = process.argv.includes('--reset');
  await runMigrations();
  const db = createDb();

  const existing = await db.select({ id: cabinets.id }).from(cabinets);
  if (existing.length && !reset) {
    console.error(`W bazie są już szafy (${existing.length}). Uruchom z --reset, aby wyczyścić sieć i zaseedować od nowa.`);
    process.exit(1);
  }

  // Zachowujemy nazwane punkty i wszystko, co ma skany; resztę sieci czyścimy.
  const allPoints = await db.select().from(points);
  const scanned = new Set((await db.select({ pointId: scans.pointId }).from(scans)).map((s) => s.pointId));
  const keep = allPoints.filter((p) => (p.name.trim() && !p.circuitId) || scanned.has(p.id));
  const drop = allPoints.filter((p) => !keep.includes(p)).map((p) => p.id);

  await db.batch([
    db.delete(fixtures),
    ...(drop.length ? [db.delete(points).where(inArray(points.id, drop))] : []),
    db.update(points).set({ circuitId: null, parentId: null, number: null }),
    db.delete(circuits),
    db.delete(cabinets),
  ]);

  const { cabinetRows, circuitRows, poles, fixtureRows } = generate();

  // Istniejące punkty → słupy podpięte do najbliższego słupa sieci (odgałęzienie X/1, X/2…).
  const childCount = new Map<string, number>();
  for (const p of poles) if (p.row.parentId) childCount.set(p.row.parentId, (childCount.get(p.row.parentId) ?? 0) + 1);
  const attached: { id: string; set: Partial<PointRow>; fixture: FixtureRow }[] = [];
  const existingPoles = poles.filter((p) => p.row.status === 'existing');
  for (const p of keep) {
    const pos: LL = [p.lat, p.lng];
    const parent = existingPoles.reduce((a, b) => (dist(b.pos, pos) < dist(a.pos, pos) ? b : a));
    let k = 1;
    const taken = new Set(poles.map((x) => `${x.row.circuitId}|${x.row.number}`));
    while (taken.has(`${parent.row.circuitId}|${parent.row.number}/${k}`)) k++;
    const number = `${parent.row.number}/${k}`;
    poles.push({ row: { ...parent.row, id: p.id, number }, pos }); // tylko do kontroli zajętych numerów
    const parentPhase = fixtureRows.filter((f) => f.pointId === parent.row.id).at(-1)?.phase ?? 'L3';
    attached.push({
      id: p.id,
      set: {
        circuitId: parent.row.circuitId,
        parentId: parent.row.id,
        number,
        inventoryId: p.inventoryId ?? `OU-${++inventorySeq}`,
        status: 'existing',
        cableLength: Math.round(dist(parent.pos, pos) * 1.05),
        cableType: parent.row.cableType,
        updatedAt: new Date(),
      },
      fixture: {
        pointId: p.id,
        suffix: null,
        phase: PHASES[(PHASES.indexOf(parentPhase) + 1) % 3],
        powerW: 40,
        model: 'LED 40 W, stylizowana',
        position: 0,
      },
    });
  }

  const newPoles = poles.filter((p) => !keep.some((k) => k.id === p.row.id)).map((p) => p.row);
  const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

  await db.insert(cabinets).values(cabinetRows);
  await db.insert(circuits).values(circuitRows);
  for (const part of chunk(newPoles, 40)) await db.insert(points).values(part);
  for (const a of attached) await db.update(points).set(a.set).where(eq(points.id, a.id));
  const allFixtures = [...fixtureRows, ...attached.map((a) => a.fixture)];
  for (const part of chunk(allFixtures, 80)) await db.insert(fixtures).values(part);

  const planned = newPoles.filter((p) => p.status === 'planned').length;
  console.log(
    `Gotowe: ${cabinetRows.length} szafy, ${circuitRows.length} obwodów, ${newPoles.length + attached.length} słupów ` +
      `(${planned} projektowanych, ${attached.length} istniejących podpiętych), ${allFixtures.length} opraw.`,
  );
  for (const a of attached) {
    const p = keep.find((k) => k.id === a.id)!;
    const c = circuitRows.find((x) => x.id === a.set.circuitId)!;
    const cab = cabinetRows.find((x) => x.id === c.cabinetId)!;
    console.log(`  „${p.name}” → ${poleLabel(cab.number, c.number, a.set.number!)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
