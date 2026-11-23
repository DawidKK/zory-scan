import type { Role } from './types';

const key = (role: Role) => `zs_token_${role}`;

function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function getToken(role: Role): string | null {
  return read(key(role));
}

export function setToken(role: Role, token: string) {
  try {
    localStorage.setItem(key(role), token);
  } catch {
    /* tryb prywatny itp. */
  }
}

export function clearToken(role: Role) {
  try {
    localStorage.removeItem(key(role));
  } catch {
    /* ignore */
  }
}

/** Token do skanera: własny albo adminowy (admin może też skanować). */
export function getScannerToken(): string | null {
  return getToken('scanner') ?? getToken('admin');
}
