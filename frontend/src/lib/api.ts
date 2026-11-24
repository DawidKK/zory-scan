import { clearToken, getScannerToken, getToken, setToken } from './auth';
import type { Cabinet, CabinetInput, Point, PointInput, Role, ScanResult, ScanRow } from './types';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type AuthMode = Role | 'scanner-or-admin' | 'none';

async function request<T>(path: string, init: RequestInit & { auth: AuthMode }): Promise<T> {
  const { auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (rest.body) headers.set('content-type', 'application/json');

  const token = auth === 'none' ? null : auth === 'scanner-or-admin' ? getScannerToken() : getToken(auth);
  if (token) headers.set('authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...rest, headers });
  } catch {
    throw new ApiError(0, 'Brak połączenia z serwerem');
  }

  if (res.status === 401 && auth !== 'none') {
    if (auth === 'admin') clearToken('admin');
    else {
      clearToken('scanner');
      if (auth === 'scanner-or-admin') clearToken('admin');
    }
    window.dispatchEvent(new Event('zs:unauthorized'));
  }

  if (!res.ok) {
    let message = `Błąd ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      /* brak JSON-a */
    }
    throw new ApiError(res.status, message);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  async login(role: Role, login: string, password: string) {
    const { token } = await request<{ token: string }>('/auth/login', {
      method: 'POST',
      auth: 'none',
      body: JSON.stringify({ role, login, password }),
    });
    setToken(role, token);
  },

  scan: (pointId: string, coords?: { lat: number; lng: number }) =>
    request<ScanResult>('/scans', {
      method: 'POST',
      auth: 'scanner-or-admin',
      body: JSON.stringify({ pointId, ...coords }),
    }),

  points: () => request<Point[]>('/points', { auth: 'admin' }),

  createPoint: (input: PointInput) =>
    request<Point>('/points', { method: 'POST', auth: 'admin', body: JSON.stringify(input) }),

  updatePoint: (id: string, input: Partial<PointInput>) =>
    request<Point>(`/points/${id}`, { method: 'PATCH', auth: 'admin', body: JSON.stringify(input) }),

  deletePoint: (id: string) => request<void>(`/points/${id}`, { method: 'DELETE', auth: 'admin' }),

  cabinets: () => request<Cabinet[]>('/cabinets', { auth: 'admin' }),

  createCabinet: (input: CabinetInput) =>
    request<Cabinet>('/cabinets', { method: 'POST', auth: 'admin', body: JSON.stringify(input) }),

  updateCabinet: (id: string, input: Partial<CabinetInput>) =>
    request<Cabinet>(`/cabinets/${id}`, { method: 'PATCH', auth: 'admin', body: JSON.stringify(input) }),

  deleteCabinet: (id: string) => request<void>(`/cabinets/${id}`, { method: 'DELETE', auth: 'admin' }),

  scans: (limit = 100) => request<ScanRow[]>(`/scans?limit=${limit}`, { auth: 'admin' }),
};
