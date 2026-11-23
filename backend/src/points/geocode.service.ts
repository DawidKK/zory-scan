import { Injectable, Logger } from '@nestjs/common';

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  square?: string;
  house_number?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

/**
 * Reverse geocoding przez publiczny Nominatim (OSM).
 * Zasady użycia: max 1 zapytanie/s, identyfikujący User-Agent, atrybucja OSM.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  /** Zwraca czytelny adres albo null (brak wyniku / błąd / timeout). Nigdy nie rzuca. */
  reverse(lat: number, lng: number): Promise<string | null> {
    // Serializujemy wywołania, żeby trzymać się limitu 1 req/s.
    const job = this.queue.then(async () => {
      const wait = this.lastCall + 1100 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      return this.fetchAddress(lat, lng);
    });
    this.queue = job.catch(() => null);
    return job;
  }

  private async fetchAddress(lat: number, lng: number): Promise<string | null> {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '1',
      'accept-language': 'pl',
    }).toString();

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'zory-scan/0.1 (proof of concept)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { address?: NominatimAddress; display_name?: string; error?: string };
      if (data.error || !data.address) return null;
      return formatAddress(data.address) ?? data.display_name ?? null;
    } catch (err) {
      this.logger.warn(`Nominatim error: ${(err as Error).message}`);
      return null;
    }
  }
}

/** "Rynek 6, Śródmieście, Żory" */
function formatAddress(a: NominatimAddress): string | null {
  const street = a.road ?? a.pedestrian ?? a.square ?? a.footway;
  const line1 = street ? [street, a.house_number].filter(Boolean).join(' ') : null;
  const district = a.suburb ?? a.quarter ?? a.neighbourhood;
  const city = a.city ?? a.town ?? a.village ?? a.municipality;
  const parts = [line1, district !== city ? district : null, city].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
