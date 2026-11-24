import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, max, ne } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { circuits, fixtures, points, scans, type Fixture } from '../db/schema';
import { GeocodeService } from './geocode.service';
import { CreatePointDto, FixtureInputDto, UpdatePointDto } from './points.dto';

const emptyToNull = (s: string | null | undefined) => (s == null ? s : s.trim() || null);

@Injectable()
export class PointsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly geocode: GeocodeService,
  ) {}

  async list() {
    const stats = this.db
      .select({
        pointId: scans.pointId,
        scanCount: count().as('scan_count'),
        lastScanAt: max(scans.scannedAt).as('last_scan_at'),
      })
      .from(scans)
      .groupBy(scans.pointId)
      .as('stats');

    const [rows, allFixtures] = await Promise.all([
      this.db
        .select({ point: points, scanCount: stats.scanCount, lastScanAt: stats.lastScanAt })
        .from(points)
        .leftJoin(stats, eq(stats.pointId, points.id))
        .orderBy(desc(points.createdAt)),
      this.db.select().from(fixtures).orderBy(asc(fixtures.position)),
    ]);

    const byPoint = new Map<string, Fixture[]>();
    for (const f of allFixtures) {
      const list = byPoint.get(f.pointId) ?? [];
      list.push(f);
      byPoint.set(f.pointId, list);
    }

    return rows.map((r) => ({
      ...r.point,
      fixtures: byPoint.get(r.point.id) ?? [],
      scanCount: r.scanCount ?? 0,
      // max() na kolumnie timestamp zwraca surową liczbę ms
      lastScanAt: r.lastScanAt != null ? new Date(Number(r.lastScanAt)) : null,
    }));
  }

  async get(id: string) {
    const point = await this.db.query.points.findFirst({ where: eq(points.id, id) });
    if (!point) throw new NotFoundException('Nie znaleziono słupa');
    const fx = await this.db.select().from(fixtures).where(eq(fixtures.pointId, id)).orderBy(asc(fixtures.position));
    return { ...point, fixtures: fx };
  }

  async create(dto: CreatePointDto) {
    const network = await this.resolveNetwork(null, {
      circuitId: dto.circuitId ?? null,
      parentId: dto.parentId ?? null,
      number: emptyToNull(dto.number) ?? null,
    });
    const address = await this.geocode.reverse(dto.lat, dto.lng);
    const [point] = await this.db
      .insert(points)
      .values({
        name: dto.name?.trim() ?? '',
        lat: dto.lat,
        lng: dto.lng,
        content: dto.content ?? '',
        address,
        ...network,
        inventoryId: emptyToNull(dto.inventoryId) ?? null,
        status: dto.status ?? 'existing',
        cableLength: dto.cableLength ?? null,
        cableType: emptyToNull(dto.cableType) ?? null,
      })
      .returning();
    if (dto.fixtures) await this.replaceFixtures(point.id, dto.fixtures);
    return this.get(point.id);
  }

  async update(id: string, dto: UpdatePointDto) {
    const current = await this.get(id);
    const moved =
      (dto.lat !== undefined && dto.lat !== current.lat) || (dto.lng !== undefined && dto.lng !== current.lng);
    // Adres pobieramy ponownie tylko wtedy, gdy słup się przesunął (albo jeszcze go nie ma).
    const address =
      moved || current.address == null
        ? await this.geocode.reverse(dto.lat ?? current.lat, dto.lng ?? current.lng)
        : current.address;

    const network = await this.resolveNetwork(current, {
      circuitId: dto.circuitId !== undefined ? dto.circuitId : current.circuitId,
      parentId: dto.parentId !== undefined ? dto.parentId : current.parentId,
      number: dto.number !== undefined ? emptyToNull(dto.number) ?? null : current.number,
    });

    // Słup przechodzi do innego obwodu → słupy, które zasilał, podpinamy pod jego dotychczasowego poprzednika.
    if (network.circuitId !== current.circuitId) {
      await this.db
        .update(points)
        .set({ parentId: current.parentId, updatedAt: new Date() })
        .where(eq(points.parentId, id));
    }

    const { fixtures: fixtureList, ...fields } = dto;
    await this.db
      .update(points)
      .set({
        ...fields,
        ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
        ...(fields.inventoryId !== undefined ? { inventoryId: emptyToNull(fields.inventoryId) } : {}),
        ...(fields.cableType !== undefined ? { cableType: emptyToNull(fields.cableType) } : {}),
        ...network,
        address,
        updatedAt: new Date(),
      })
      .where(eq(points.id, id));

    if (fixtureList) await this.replaceFixtures(id, fixtureList);
    return this.get(id);
  }

  /** Sprawdza spójność drzewa zasilania: obwód istnieje, poprzednik w tym samym obwodzie, brak cykli, numer wolny. */
  private async resolveNetwork(
    current: { id: string } | null,
    next: { circuitId: string | null; parentId: string | null; number: string | null },
  ) {
    const { circuitId } = next;
    if (!circuitId) return { circuitId: null, parentId: null, number: next.number };

    const circuit = await this.db.query.circuits.findFirst({ where: eq(circuits.id, circuitId) });
    if (!circuit) throw new BadRequestException('Wybrany obwód nie istnieje');

    let { parentId } = next;
    if (parentId) {
      if (current && parentId === current.id) throw new BadRequestException('Słup nie może zasilać sam siebie');
      const circuitPoles = await this.db
        .select({ id: points.id, parentId: points.parentId, circuitId: points.circuitId })
        .from(points)
        .where(eq(points.circuitId, circuitId));
      const parent = circuitPoles.find((p) => p.id === parentId);
      if (!parent) throw new BadRequestException('Słup poprzedzający musi należeć do tego samego obwodu');
      if (current) {
        // Idziemy od poprzednika w górę drzewa — jeśli trafimy na edytowany słup, powstałby cykl.
        const byId = new Map(circuitPoles.map((p) => [p.id, p]));
        let cursor: string | null = parentId;
        for (let guard = 0; cursor && guard < 10_000; guard++) {
          if (cursor === current.id) throw new BadRequestException('Nie można podpiąć słupa pod słup, który sam zasila');
          cursor = byId.get(cursor)?.parentId ?? null;
        }
      }
    } else {
      parentId = null;
    }

    if (next.number) {
      const clash = await this.db.query.points.findFirst({
        where: and(
          eq(points.circuitId, circuitId),
          eq(points.number, next.number),
          ...(current ? [ne(points.id, current.id)] : []),
        ),
      });
      if (clash) throw new ConflictException(`Numer ${next.number} jest już zajęty w tym obwodzie`);
    }

    return { circuitId, parentId, number: next.number };
  }

  private async replaceFixtures(pointId: string, list: FixtureInputDto[]) {
    const del = this.db.delete(fixtures).where(eq(fixtures.pointId, pointId));
    if (!list.length) {
      await del;
      return;
    }
    await this.db.batch([
      del,
      this.db.insert(fixtures).values(
        list.map((f, i) => ({
          pointId,
          suffix: emptyToNull(f.suffix) ?? null,
          phase: f.phase ?? null,
          powerW: f.powerW ?? null,
          model: f.model?.trim() ?? '',
          position: i,
        })),
      ),
    ]);
  }

  /** Uzupełnia adresy słupów, które ich nie mają (np. dodanych przed tą funkcją). Leci w tle. */
  async backfillAddresses() {
    const missing = await this.db.select().from(points).where(isNull(points.address));
    if (missing.length === 0) return;
    this.logger.log(`Uzupełniam adresy dla ${missing.length} słupów…`);
    for (const p of missing) {
      const address = await this.geocode.reverse(p.lat, p.lng);
      if (address) await this.db.update(points).set({ address }).where(eq(points.id, p.id));
    }
  }

  onApplicationBootstrap() {
    void this.backfillAddresses().catch((err) => this.logger.warn(`Backfill: ${err.message}`));
  }

  async remove(id: string) {
    const current = await this.get(id);
    // FK nie muszą być egzekwowane na każdym połączeniu — sprzątamy jawnie.
    // Słupy zasilane z usuwanego podpinamy pod jego poprzednika, żeby nie zerwać linii.
    const [, , , deleted] = await this.db.batch([
      this.db.update(points).set({ parentId: current.parentId }).where(eq(points.parentId, id)),
      this.db.delete(scans).where(eq(scans.pointId, id)),
      this.db.delete(fixtures).where(eq(fixtures.pointId, id)),
      this.db.delete(points).where(eq(points.id, id)).returning({ id: points.id }),
    ]);
    if (deleted.length === 0) throw new NotFoundException('Nie znaleziono słupa');
  }
}
