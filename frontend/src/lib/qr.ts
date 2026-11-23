/** Treść kodu QR: URL do skanera. Zeskanowany aparatem systemowym otwiera od razu aplikację. */
export function qrPayload(pointId: string): string {
  return `${window.location.origin}/scan?p=${pointId}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Wyciąga ID punktu z zeskanowanej treści (URL z ?p= albo gołe UUID). */
export function parsePointId(raw: string): string | null {
  const text = raw.trim();
  if (UUID_RE.test(text)) return text;
  try {
    const id = new URL(text).searchParams.get('p');
    return id && UUID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}
