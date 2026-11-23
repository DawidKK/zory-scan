const rtf = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('pl', { dateStyle: 'medium', timeStyle: 'short' });

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'przed chwilą';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return dtf.format(new Date(iso));
}

export function fullDate(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : '—';
}

export function isFresh(iso: string | null | undefined, minutes = 5): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < minutes * 60_000;
}

/** Krótki opis urządzenia z user-agenta. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return 'Nieznane urządzenie';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Inne';
  const browser = /EdgA?\//.test(ua)
    ? 'Edge'
    : /CriOS|Chrome\//.test(ua)
      ? 'Chrome'
      : /FxiOS|Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : '';
  return browser ? `${os} · ${browser}` : os;
}

export const fmtCoord = (n: number) => n.toFixed(5);
