import type { Point } from './types';

/** Odległość w metrach między dwoma punktami (wzór haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Najbliższy inny punkt względem podanych współrzędnych. */
export function nearestPoint(
  from: { lat: number; lng: number },
  points: Point[],
  excludeId?: string,
): { point: Point; distance: number } | null {
  let best: { point: Point; distance: number } | null = null;
  for (const p of points) {
    if (p.id === excludeId) continue;
    const distance = distanceMeters(from, p);
    if (!best || distance < best.distance) best = { point: p, distance };
  }
  return best;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`;
}
