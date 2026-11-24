import { randomUUID } from 'node:crypto';
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID());
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

/** Szafa oświetlenia ulicznego (SOU) — punkt zasilania i sterowania obwodami. */
export const cabinets = sqliteTable('cabinets', {
  id: id(),
  /** Numer eksploatacyjny szafy, np. "84" (wyświetlany jako SOU-84). */
  number: text('number').notNull().unique(),
  /** Opis / lokalizacja, np. "ul. Wodzisławska". */
  name: text('name').notNull().default(''),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  address: text('address'),
  notes: text('notes').notNull().default(''),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Obwód oświetleniowy wychodzący z szafy (zwykle do ~6 na szafę). */
export const circuits = sqliteTable(
  'circuits',
  {
    id: id(),
    cabinetId: text('cabinet_id')
      .notNull()
      .references(() => cabinets.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('circuits_cabinet_number_uq').on(t.cabinetId, t.number)],
);

export const POINT_STATUSES = ['existing', 'planned'] as const;
export type PointStatus = (typeof POINT_STATUSES)[number];

/** Słup oświetleniowy. Kod QR i skany są przypięte do słupa. */
export const points = sqliteTable(
  'points',
  {
    id: id(),
    /** Opis / lokalizacja (opcjonalny dla słupów z numerem). */
    name: text('name').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    content: text('content').notNull().default(''),
    /** Adres z reverse geocodingu (Nominatim/OSM). null = jeszcze nie pobrany albo brak wyniku. */
    address: text('address'),
    /** Obwód, z którego zasilany jest słup (szafa wynika z obwodu). null = nieprzypisany. */
    circuitId: text('circuit_id').references(() => circuits.id, { onDelete: 'set null' }),
    /** Słup poprzedzający w linii kablowej. null = zasilany bezpośrednio z szafy. */
    parentId: text('parent_id').references((): AnySQLiteColumn => points.id, { onDelete: 'set null' }),
    /** Numer kolejny w obwodzie z odgałęzieniami, np. "8/2/1". */
    number: text('number'),
    /** Unikalny identyfikator ewidencyjny, np. "OU-14582". */
    inventoryId: text('inventory_id'),
    status: text('status', { enum: POINT_STATUSES }).notNull().default('existing'),
    /** Długość odcinka kabla od słupa poprzedzającego (lub szafy), w metrach. */
    cableLength: real('cable_length'),
    /** Typ kabla zasilającego, np. "YAKXS 4x35". */
    cableType: text('cable_type'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('points_circuit_idx').on(t.circuitId), index('points_parent_idx').on(t.parentId)],
);

export const PHASES = ['L1', 'L2', 'L3'] as const;
export type Phase = (typeof PHASES)[number];

/** Oprawa oświetleniowa zamontowana na słupie (może ich być kilka: 15a, 15b). */
export const fixtures = sqliteTable(
  'fixtures',
  {
    id: id(),
    pointId: text('point_id')
      .notNull()
      .references(() => points.id, { onDelete: 'cascade' }),
    /** Indeks oprawy na słupie, np. "a", "b". null = jedyna oprawa. */
    suffix: text('suffix'),
    phase: text('phase', { enum: PHASES }),
    powerW: integer('power_w'),
    /** Typ / model oprawy, np. "LED 36W". */
    model: text('model').notNull().default(''),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('fixtures_point_idx').on(t.pointId)],
);

export const scans = sqliteTable(
  'scans',
  {
    id: id(),
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

export type Cabinet = typeof cabinets.$inferSelect;
export type Circuit = typeof circuits.$inferSelect;
export type Point = typeof points.$inferSelect;
export type Fixture = typeof fixtures.$inferSelect;
export type Scan = typeof scans.$inferSelect;
