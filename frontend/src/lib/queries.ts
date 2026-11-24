import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { buildIndex } from './network';

export const usePoints = () =>
  useQuery({ queryKey: ['points'], queryFn: api.points, refetchInterval: 15_000 });

export const useScans = () =>
  useQuery({ queryKey: ['scans'], queryFn: () => api.scans(100), refetchInterval: 10_000 });

export const useCabinets = () =>
  useQuery({ queryKey: ['cabinets'], queryFn: api.cabinets, refetchInterval: 30_000 });

/** Szafy + słupy + zbudowany indeks sieci (drzewa obwodów). */
export function useNetwork() {
  const points = usePoints();
  const cabinets = useCabinets();
  const p = points.data;
  const c = cabinets.data;
  const idx = useMemo(() => buildIndex(c ?? [], p ?? []), [c, p]);
  return {
    idx,
    points: p ?? [],
    cabinets: c ?? [],
    isLoading: points.isLoading || cabinets.isLoading,
    error: points.error ?? cabinets.error,
  };
}
