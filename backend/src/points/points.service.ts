import { Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { count, desc, eq, isNull, max } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { points, scans } from '../db/schema';
import { GeocodeService } from './geocode.service';
import { CreatePointDto, UpdatePointDto } from './points.dto';

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

    const rows = await this.db
      .select({
        point: points,
        scanCount: stats.scanCount,
        lastScanAt: stats.lastScanAt,
      })
      .from(points)
      .leftJoin(stats, eq(stats.pointId, points.id))
      .orderBy(desc(points.createdAt));

    return rows.map((r) => ({
      ...r.point,
      scanCount: r.scanCount ?? 0,
      // max() na kolumnie timestamp zwraca surową liczbę ms
      lastScanAt: r.lastScanAt != null ? new Date(Number(r.lastScanAt)) : null,
    }));
  }

  async get(id: string) {
    const point = await this.db.query.points.findFirst({ where: eq(points.id, id) });
    if (!point) throw new NotFoundException('Nie znaleziono punktu');
    return point;
  }

  async create(dto: CreatePointDto) {
    const address = await this.geocode.reverse(dto.lat, dto.lng);
    const [point] = await this.db
      .insert(points)
      .values({ name: dto.name.trim(), lat: dto.lat, lng: dto.lng, content: dto.content ?? '', address })
      .returning();
    return point;
  }

  async update(id: string, dto: UpdatePointDto) {
    const current = await this.get(id);
    const moved =
      (dto.lat !== undefined && dto.lat !== current.lat) || (dto.lng !== undefined && dto.lng !== current.lng);
    // Adres pobieramy ponownie tylko wtedy, gdy punkt się przesunął (albo jeszcze go nie ma).
    const address =
      moved || current.address == null
        ? await this.geocode.reverse(dto.lat ?? current.lat, dto.lng ?? current.lng)
        : current.address;

    const [point] = await this.db
      .update(points)
      .set({ ...dto, ...(dto.name ? { name: dto.name.trim() } : {}), address, updatedAt: new Date() })
      .where(eq(points.id, id))
      .returning();
    if (!point) throw new NotFoundException('Nie znaleziono punktu');
    return point;
  }

  /** Uzupełnia adresy punktów, które ich nie mają (np. dodanych przed tą funkcją). Leci w tle. */
  async backfillAddresses() {
    const missing = await this.db.select().from(points).where(isNull(points.address));
    if (missing.length === 0) return;
    this.logger.log(`Uzupełniam adresy dla ${missing.length} punktów…`);
    for (const p of missing) {
      const address = await this.geocode.reverse(p.lat, p.lng);
      if (address) await this.db.update(points).set({ address }).where(eq(points.id, p.id));
    }
  }

  onApplicationBootstrap() {
    void this.backfillAddresses().catch((err) => this.logger.warn(`Backfill: ${err.message}`));
  }

  async remove(id: string) {
    // Kasujemy skany jawnie: PRAGMA foreign_keys nie musi być włączone na każdym połączeniu.
    const [, deleted] = await this.db.batch([
      this.db.delete(scans).where(eq(scans.pointId, id)),
      this.db.delete(points).where(eq(points.id, id)).returning({ id: points.id }),
    ]);
    if (deleted.length === 0) throw new NotFoundException('Nie znaleziono punktu');
  }
}
