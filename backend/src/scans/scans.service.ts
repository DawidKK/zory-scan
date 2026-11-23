import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { points, scans } from '../db/schema';

@Injectable()
export class ScansService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Zapisuje skan i zwraca treść punktu do pokazania użytkownikowi. */
  async scan(pointId: string, meta: { userAgent?: string; lat?: number; lng?: number }) {
    const point = await this.db.query.points.findFirst({ where: eq(points.id, pointId) });
    if (!point) throw new NotFoundException('Nieznany kod QR');

    await this.db.insert(scans).values({
      pointId,
      userAgent: meta.userAgent?.slice(0, 500),
      lat: meta.lat,
      lng: meta.lng,
    });

    return { id: point.id, name: point.name, content: point.content, address: point.address };
  }

  list(limit = 100) {
    return this.db
      .select({
        id: scans.id,
        scannedAt: scans.scannedAt,
        userAgent: scans.userAgent,
        lat: scans.lat,
        lng: scans.lng,
        pointId: scans.pointId,
        pointName: points.name,
      })
      .from(scans)
      .innerJoin(points, eq(points.id, scans.pointId))
      .orderBy(desc(scans.scannedAt))
      .limit(limit);
  }
}
