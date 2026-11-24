export type Role = 'scanner' | 'admin';

export type Phase = 'L1' | 'L2' | 'L3';
export type PointStatus = 'existing' | 'planned';

export interface Fixture {
  id: string;
  suffix: string | null;
  phase: Phase | null;
  powerW: number | null;
  model: string;
}

export interface FixtureInput {
  suffix: string | null;
  phase: Phase | null;
  powerW: number | null;
  model: string;
}

/** Słup oświetleniowy. */
export interface Point {
  id: string;
  name: string;
  lat: number;
  lng: number;
  content: string;
  address: string | null;
  circuitId: string | null;
  parentId: string | null;
  number: string | null;
  inventoryId: string | null;
  status: PointStatus;
  cableLength: number | null;
  cableType: string | null;
  fixtures: Fixture[];
  createdAt: string;
  updatedAt: string;
  scanCount: number;
  lastScanAt: string | null;
}

export interface PointInput {
  name: string;
  lat: number;
  lng: number;
  content: string;
  circuitId: string | null;
  parentId: string | null;
  number: string | null;
  inventoryId: string | null;
  status: PointStatus;
  cableLength: number | null;
  cableType: string | null;
  fixtures: FixtureInput[];
}

export interface Circuit {
  id: string;
  cabinetId: string;
  number: number;
  description: string;
}

/** Szafa oświetlenia ulicznego (SOU). */
export interface Cabinet {
  id: string;
  number: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  notes: string;
  circuits: Circuit[];
  createdAt: string;
  updatedAt: string;
}

export interface CabinetInput {
  number: string;
  name: string;
  lat: number;
  lng: number;
  notes: string;
  circuits: { id?: string; number: number; description: string }[];
}

export interface ScanResult {
  id: string;
  name: string;
  content: string;
  address: string | null;
  label: string | null;
  cabinetNumber: string | null;
  circuitNumber: number | null;
  number: string | null;
  inventoryId: string | null;
  status: PointStatus;
  fixtures: Omit<Fixture, 'id'>[];
}

export interface ScanRow {
  id: string;
  scannedAt: string;
  userAgent: string | null;
  lat: number | null;
  lng: number | null;
  pointId: string;
  pointName: string;
  pointLabel: string | null;
}
