import { distanceMeters } from './geo';
import type { Cabinet, Circuit, Phase, Point } from './types';

/* ---------- Formatowanie ---------- */

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) (out += s), (n -= v);
  return out;
}

export const cabinetLabel = (c: Pick<Cabinet, 'number'>) => `SOU-${c.number}`;
export const circuitLabel = (c: Pick<Circuit, 'number'>) => `Obw. ${toRoman(c.number)}`;

/**
 * Kolory linii obwodów. Celowo bez czerwieni (oprawy) i niebieskiego (szafy SOU),
 * żeby linie nie zlewały się z markerami. Kolor wynika z numeru obwodu.
 */
export const CIRCUIT_COLORS = ['#E08A1E', '#2A9AA3', '#3E9650', '#8C7F22', '#9A5B34', '#5E6672', '#4E8F7C', '#B7791F'];
export const circuitColor = (n: number) => CIRCUIT_COLORS[(Math.max(1, n) - 1) % CIRCUIT_COLORS.length];

export const PHASES: Phase[] = ['L1', 'L2', 'L3'];
export const nextPhase = (p: Phase | null | undefined): Phase => (p ? PHASES[(PHASES.indexOf(p) + 1) % 3] : 'L1');

/** Porównanie numerów słupów po segmentach: 2 < 8 < 8/1 < 8/2 < 8/2/1 < 9 < 10. */
export function compareNumbers(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const sa = a.split('/');
  const sb = b.split('/');
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    const c = sa[i].localeCompare(sb[i], 'pl', { numeric: true });
    if (c) return c;
  }
  return sa.length - sb.length;
}

/* ---------- Indeks sieci ---------- */

export interface CircuitInfo extends Circuit {
  cabinet: Cabinet;
}

export interface NetworkIndex {
  cabinets: Map<string, Cabinet>;
  circuits: Map<string, CircuitInfo>;
  points: Map<string, Point>;
  /** id słupa → słupy przez niego zasilane (posortowane po numerze) */
  children: Map<string, Point[]>;
  /** id obwodu → słupy zasilane bezpośrednio z szafy */
  roots: Map<string, Point[]>;
  /** id obwodu → wszystkie jego słupy */
  byCircuit: Map<string, Point[]>;
  unassigned: Point[];
}

export function buildIndex(cabinets: Cabinet[], points: Point[]): NetworkIndex {
  const idx: NetworkIndex = {
    cabinets: new Map(cabinets.map((c) => [c.id, c])),
    circuits: new Map(),
    points: new Map(points.map((p) => [p.id, p])),
    children: new Map(),
    roots: new Map(),
    byCircuit: new Map(),
    unassigned: [],
  };
  for (const cab of cabinets) for (const c of cab.circuits) idx.circuits.set(c.id, { ...c, cabinet: cab });

  const push = <K>(m: Map<K, Point[]>, k: K, p: Point) => {
    const list = m.get(k);
    if (list) list.push(p);
    else m.set(k, [p]);
  };
  for (const p of points) {
    if (!p.circuitId || !idx.circuits.has(p.circuitId)) {
      idx.unassigned.push(p);
      continue;
    }
    push(idx.byCircuit, p.circuitId, p);
    const parent = p.parentId ? idx.points.get(p.parentId) : undefined;
    if (parent && parent.circuitId === p.circuitId) push(idx.children, parent.id, p);
    else push(idx.roots, p.circuitId, p);
  }
  const byNumber = (a: Point, b: Point) => compareNumbers(a.number, b.number);
  for (const m of [idx.children, idx.roots, idx.byCircuit]) for (const list of m.values()) list.sort(byNumber);
  return idx;
}

export const circuitOf = (p: Point, idx: NetworkIndex) => (p.circuitId ? idx.circuits.get(p.circuitId) : undefined);

/** "84/I/8/2/1" albo null, gdy słup nie jest przypisany do obwodu. */
export function poleLabel(p: Point, idx: NetworkIndex): string | null {
  const c = circuitOf(p, idx);
  if (!c) return null;
  return [c.cabinet.number, toRoman(c.number), p.number ?? '?'].join('/');
}

/** Tytuł słupa do list: oznaczenie eksploatacyjne, a jeśli go brak — nazwa. */
export function pointTitle(p: Point, idx: NetworkIndex): string {
  return poleLabel(p, idx) ?? (p.name || 'Słup bez numeru');
}

/** Słupy od szafy do podanego (włącznie). */
export function pathFromCabinet(p: Point, idx: NetworkIndex): Point[] {
  const path: Point[] = [];
  const seen = new Set<string>();
  let cur: Point | undefined = p;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    const parent: Point | undefined = cur.parentId ? idx.points.get(cur.parentId) : undefined;
    cur = parent && parent.circuitId === p.circuitId ? parent : undefined;
  }
  return path;
}

/** Wszystkie słupy zasilane (pośrednio lub bezpośrednio) z podanego. */
export function descendants(id: string, idx: NetworkIndex): Set<string> {
  const out = new Set<string>();
  const stack = [...(idx.children.get(id) ?? [])];
  while (stack.length) {
    const p = stack.pop()!;
    if (out.has(p.id)) continue;
    out.add(p.id);
    stack.push(...(idx.children.get(p.id) ?? []));
  }
  return out;
}

/** Skąd przychodzi kabel do słupa: słup poprzedzający albo szafa. */
export function feedOrigin(
  p: Pick<Point, 'circuitId' | 'parentId'>,
  idx: NetworkIndex,
): { lat: number; lng: number } | null {
  if (!p.circuitId) return null;
  const parent = p.parentId ? idx.points.get(p.parentId) : undefined;
  if (parent) return parent;
  return idx.circuits.get(p.circuitId)?.cabinet ?? null;
}

/** Kolejność słupów obwodu jak w drzewie (DFS, odgałęzienia przed kontynuacją linii). */
export function circuitTree(circuitId: string, idx: NetworkIndex): { point: Point; depth: number }[] {
  const out: { point: Point; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (list: Point[], depth: number) => {
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      // Wcięcie = poziom odgałęzienia (liczba segmentów numeru), a gdy brak numeru — głębokość w drzewie.
      out.push({ point: p, depth: p.number ? p.number.split('/').length - 1 : depth });
      walk(idx.children.get(p.id) ?? [], depth + 1);
    }
  };
  walk(idx.roots.get(circuitId) ?? [], 0);
  return out;
}

/* ---------- Podpowiedzi przy wprowadzaniu ---------- */

export interface NumberSuggestion {
  /** Kolejny słup w tej samej linii (np. po 8 → 9, po 8/2 → 8/3). */
  continuation: string | null;
  /** Nowe odgałęzienie od poprzednika (np. od 8 → 8/1). */
  branch: string | null;
  preferred: string | null;
}

export function suggestNumber(
  circuitId: string | null,
  parentId: string | null,
  idx: NetworkIndex,
  excludeId?: string,
): NumberSuggestion {
  const none = { continuation: null, branch: null, preferred: null };
  if (!circuitId) return none;
  const taken = new Set(
    (idx.byCircuit.get(circuitId) ?? []).filter((p) => p.id !== excludeId && p.number).map((p) => p.number!),
  );

  if (!parentId) {
    let n = 1;
    while (taken.has(String(n))) n++;
    return { continuation: String(n), branch: null, preferred: String(n) };
  }

  const parent = idx.points.get(parentId);
  const pn = parent?.number;
  if (!pn) return none;

  const segs = pn.split('/');
  const last = segs[segs.length - 1];
  let continuation = /^\d+$/.test(last) ? [...segs.slice(0, -1), String(Number(last) + 1)].join('/') : null;
  if (continuation && taken.has(continuation)) continuation = null;

  let k = 1;
  while (taken.has(`${pn}/${k}`)) k++;
  const branch = `${pn}/${k}`;

  // Jeśli z poprzednika wychodzi już kontynuacja linii, kolejny słup to odgałęzienie.
  const hasContinuation = (idx.children.get(parentId) ?? []).some(
    (c) => c.id !== excludeId && c.number && c.number.split('/').length === segs.length,
  );
  return { continuation, branch, preferred: hasContinuation ? branch : continuation ?? branch };
}

/** Faza dla nowej oprawy: kolejna po ostatniej oprawie słupa poprzedzającego (L1 → L2 → L3 → L1). */
export function suggestPhase(parentId: string | null, idx: NetworkIndex): Phase {
  const parent = parentId ? idx.points.get(parentId) : undefined;
  const last = parent?.fixtures.at(-1)?.phase;
  return parent ? nextPhase(last) : 'L1';
}

/** Kolejny wolny indeks literowy oprawy na słupie: a, b, c… */
export function nextSuffix(used: (string | null)[]): string {
  for (let i = 0; i < 26; i++) {
    const s = String.fromCharCode(97 + i);
    if (!used.includes(s)) return s;
  }
  return '';
}

/* ---------- Statystyki ---------- */

export interface CircuitStats {
  poles: number;
  fixtures: number;
  powerW: number;
  phaseW: Record<Phase, number>;
  /** Suma długości kabli: wpisane + szacowane z mapy dla brakujących. */
  cableM: number;
  cableEstimated: boolean;
}

export function circuitStats(circuitId: string, idx: NetworkIndex): CircuitStats {
  const stats: CircuitStats = {
    poles: 0,
    fixtures: 0,
    powerW: 0,
    phaseW: { L1: 0, L2: 0, L3: 0 },
    cableM: 0,
    cableEstimated: false,
  };
  for (const p of idx.byCircuit.get(circuitId) ?? []) {
    stats.poles++;
    for (const f of p.fixtures) {
      stats.fixtures++;
      stats.powerW += f.powerW ?? 0;
      if (f.phase) stats.phaseW[f.phase] += f.powerW ?? 0;
    }
    if (p.cableLength != null) stats.cableM += p.cableLength;
    else {
      const origin = feedOrigin(p, idx);
      if (origin) {
        stats.cableM += distanceMeters(origin, p);
        stats.cableEstimated = true;
      }
    }
  }
  return stats;
}

export const formatPower = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(1).replace('.', ',')} kW` : `${w} W`);
