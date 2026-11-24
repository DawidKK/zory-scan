import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { cabinets, circuits, fixtures, points, scans } from '../db/schema';
import { poleLabel } from '../network/label';

@Injectable()
export class ScansService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Zapisuje skan i zwraca dane słupa do pokazania użytkownikowi. */
  async scan(pointId: string, meta: { userAgent?: string; lat?: number; lng?: number }) {
    const [row] = await this.db
      .select({ point: points, circuit: circuits, cabinet: cabinets })
      .from(points)
      .leftJoin(circuits, eq(circuits.id, points.circuitId))
      .leftJoin(cabinets, eq(cabinets.id, circuits.cabinetId))
      .where(eq(points.id, pointId));
    if (!row) throw new NotFoundException('Nieznany kod QR');
    const { point, circuit, cabinet } = row;

    const [, fx] = await Promise.all([
      this.db.insert(scans).values({
        pointId,
        userAgent: meta.userAgent?.slice(0, 500),
        lat: meta.lat,
        lng: meta.lng,
      }),
      this.db.select().from(fixtures).where(eq(fixtures.pointId, pointId)).orderBy(asc(fixtures.position)),
    ]);

    return {
      id: point.id,
      name: point.name,
      content: point.content,
      address: point.address,
      label: cabinet && circuit ? poleLabel(cabinet.number, circuit.number, point.number) : null,
      cabinetNumber: cabinet?.number ?? null,
      circuitNumber: circuit?.number ?? null,
      number: point.number,
      inventoryId: point.inventoryId,
      status: point.status,
      fixtures: fx.map((f) => ({ suffix: f.suffix, phase: f.phase, powerW: f.powerW, model: f.model })),
    };
  }

  async list(limit = 100) {
    const rows = await this.db
      .select({
        id: scans.id,
        scannedAt: scans.scannedAt,
        userAgent: scans.userAgent,
        lat: scans.lat,
        lng: scans.lng,
        pointId: scans.pointId,
        pointName: points.name,
        pointNumber: points.number,
        circuitNumber: circuits.number,
        cabinetNumber: cabinets.number,
      })
      .from(scans)
      .innerJoin(points, eq(points.id, scans.pointId))
      .leftJoin(circuits, eq(circuits.id, points.circuitId))
      .leftJoin(cabinets, eq(cabinets.id, circuits.cabinetId))
      .orderBy(desc(scans.scannedAt))
      .limit(limit);

    return rows.map(({ pointNumber, circuitNumber, cabinetNumber, ...r }) => ({
      ...r,
      pointLabel:
        cabinetNumber != null && circuitNumber != null ? poleLabel(cabinetNumber, circuitNumber, pointNumber) : null,
    }));
  }
}
