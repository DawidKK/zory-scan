import { randomUUID } from 'node:crypto';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const points = sqliteTable('points', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  content: text('content').notNull().default(''),
  /** Adres z reverse geocodingu (Nominatim/OSM). null = jeszcze nie pobrany albo brak wyniku. */
  address: text('address'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const scans = sqliteTable(
  'scans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    pointId: text('point_id')
      .notNull()
      .references(() => points.id, { onDelete: 'cascade' }),
    scannedAt: integer('scanned_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    userAgent: text('user_agent'),
    lat: real('lat'),
    lng: real('lng'),
  },
  (t) => [index('scans_scanned_at_idx').on(t.scannedAt), index('scans_point_id_idx').on(t.pointId)],
);

export type Point = typeof points.$inferSelect;
export type Scan = typeof scans.$inferSelect;
