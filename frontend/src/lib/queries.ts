import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const usePoints = () =>
  useQuery({ queryKey: ['points'], queryFn: api.points, refetchInterval: 15_000 });

export const useScans = () =>
  useQuery({ queryKey: ['scans'], queryFn: () => api.scans(100), refetchInterval: 10_000 });
