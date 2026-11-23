export type Role = 'scanner' | 'admin';

export interface Point {
  id: string;
  name: string;
  lat: number;
  lng: number;
  content: string;
  address: string | null;
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
}

export interface ScanResult {
  id: string;
  name: string;
  content: string;
  address: string | null;
}

export interface ScanRow {
  id: string;
  scannedAt: string;
  userAgent: string | null;
  lat: number | null;
  lng: number | null;
  pointId: string;
  pointName: string;
}
