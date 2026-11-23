import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { usePoints, useScans } from '../../lib/queries';
import { deviceLabel, fullDate, isFresh, timeAgo } from '../../lib/format';
import type { Point } from '../../lib/types';
import { PointPanel, type Coords } from '../../components/PointPanel';
import { HeatLayer } from '../../components/HeatLayer';

const HEAT_KEY = 'zs_map_heat';
function readHeatPref(): boolean {
  try {
    return localStorage.getItem(HEAT_KEY) === '1';
  } catch {
    return false;
  }
}

// Domyślny widok: Żory
const DEFAULT_CENTER: [number, number] = [50.0449, 18.7];
const DEFAULT_ZOOM = 14;

// Pinezka: kształt kropli z białym środkiem. Kolor sterowany klasą CSS (.pin-body).
const PIN_SVG =
  '<svg width="26" height="34" viewBox="-1 -1 26 34" aria-hidden="true">' +
  '<path class="pin-body" d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/>' +
  '<circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>';

const icon = (cls: string) =>
  L.divIcon({
    className: '',
    html: `<span class="pin ${cls}">${PIN_SVG}</span>`,
    iconSize: [26, 34],
    iconAnchor: [13, 33],
  });

const ICONS = {
  normal: icon(''),
  fresh: icon('pin-fresh'),
  selected: icon('pin-selected'),
  draft: icon('pin-draft'),
};

type Selection = { mode: 'create'; coords: Coords } | { mode: 'edit'; id: string; coords: Coords } | null;

function ClickHandler({ onClick }: { onClick: (c: Coords) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FitOnce({ points, focusId }: { points: Point[]; focusId: string | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    const focus = focusId && points.find((p) => p.id === focusId);
    if (focus) map.setView([focus.lat, focus.lng], 17);
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 16);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 17 });
  }, [map, points, focusId]);
  return null;
}

export function MapPage() {
  const { data: points = [], isLoading } = usePoints();
  const { data: scans = [], isLoading: scansLoading } = useScans();
  const [params, setParams] = useSearchParams();
  const focusId = params.get('point');
  const [selection, setSelection] = useState<Selection>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [showHeat, setShowHeat] = useState(readHeatPref);

  function toggleHeat(on: boolean) {
    setShowHeat(on);
    try {
      localStorage.setItem(HEAT_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  // Heatmapa: każdy punkt ważony liczbą wszystkich swoich skanów (względem najczęściej skanowanego).
  const heatPoints = useMemo(() => {
    const max = Math.max(0, ...points.map((p) => p.scanCount));
    return points
      .filter((p) => p.scanCount > 0)
      .map((p) => [p.lat, p.lng, max ? p.scanCount / max : 0] as [number, number, number]);
  }, [points]);
  const totalScans = useMemo(() => points.reduce((sum, p) => sum + p.scanCount, 0), [points]);

  const selectedPoint = selection?.mode === 'edit' ? points.find((p) => p.id === selection.id) ?? null : null;

  const selectPoint = useCallback(
    (p: Point, pan = false) => {
      setSelection({ mode: 'edit', id: p.id, coords: { lat: p.lat, lng: p.lng } });
      if (pan) map?.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.4 });
    },
    [map],
  );

  // ?point=<id> (np. z listy skanów) → otwórz panel punktu
  useEffect(() => {
    if (!focusId || points.length === 0) return;
    const p = points.find((x) => x.id === focusId);
    if (p) selectPoint(p);
    setParams({}, { replace: true });
  }, [focusId, points, setParams, selectPoint]);

  const close = useCallback(() => setSelection(null), []);

  const onMapClick = useCallback((coords: Coords) => {
    setSelection((s) => (s?.mode === 'create' ? { ...s, coords } : s ? null : { mode: 'create', coords }));
  }, []);

  const setCoords = useCallback((coords: Coords) => setSelection((s) => (s ? { ...s, coords } : s)), []);

  const dragHandlers = useMemo(
    () => ({
      dragend: (e: L.DragEndEvent) => {
        const { lat, lng } = (e.target as L.Marker).getLatLng();
        setCoords({ lat, lng });
      },
    }),
    [setCoords],
  );

  return (
    <div className="page page-full">
      <header className="topbar">
        <h1 className="topbar-title">Mapa</h1>
        <span className="topbar-meta tabular">{isLoading ? '…' : `${points.length} punktów`}</span>
        <span className="spacer" />
        <span className="topbar-hint">Kliknij na mapie, aby dodać punkt</span>
      </header>

      <div className="map-layout">
        <div className="map-wrap">
          <MapContainer ref={setMap} center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="map" zoomControl>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <ClickHandler onClick={onMapClick} />
            <FitOnce points={points} focusId={focusId} />
            {showHeat && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

            {points.map((p) => {
              const isSelected = selection?.mode === 'edit' && selection.id === p.id;
              const pos: [number, number] = isSelected ? [selection.coords.lat, selection.coords.lng] : [p.lat, p.lng];
              return (
                <Marker
                  key={p.id}
                  position={pos}
                  icon={isSelected ? ICONS.selected : isFresh(p.lastScanAt) ? ICONS.fresh : ICONS.normal}
                  draggable={isSelected}
                  zIndexOffset={isSelected ? 1000 : 0}
                  eventHandlers={{
                    click: () => selectPoint(p),
                    ...(isSelected ? dragHandlers : {}),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -32]} className="map-tooltip">
                    {p.name}
                    {p.address && <span className="map-tooltip-address">{p.address}</span>}
                  </Tooltip>
                </Marker>
              );
            })}

            {selection?.mode === 'create' && (
              <Marker
                position={[selection.coords.lat, selection.coords.lng]}
                icon={ICONS.draft}
                draggable
                zIndexOffset={1000}
                eventHandlers={dragHandlers}
              />
            )}
          </MapContainer>

          <div className="map-filters">
            <label className="map-filter">
              <input type="checkbox" checked={showHeat} onChange={(e) => toggleHeat(e.target.checked)} />
              Heatmapa skanów
              <span className="map-filter-meta tabular">{totalScans}</span>
            </label>
          </div>
        </div>

        <aside className="map-side" aria-label="Ostatnie skany">
          <div className="map-side-head">
            <span className="dot dot-teal live-dot" />
            Ostatnie skany
            <span className="spacer" />
            <span className="tabular">{scans.length}</span>
          </div>
          <div className="map-side-list">
            {scansLoading && <div className="empty">Wczytywanie…</div>}
            {!scansLoading && scans.length === 0 && <div className="empty">Brak skanów</div>}
            {scans.map((s) => {
              const p = points.find((x) => x.id === s.pointId);
              const active = selection?.mode === 'edit' && selection.id === s.pointId;
              return (
                <button
                  key={s.id}
                  className={`scan-item ${active ? 'scan-item-active' : ''}`}
                  onClick={() => p && selectPoint(p, true)}
                >
                  <span className={`dot ${isFresh(s.scannedAt) ? 'dot-teal' : 'dot-muted'}`} />
                  <span className="scan-item-title">{s.pointName}</span>
                  <span className="scan-item-time tabular" title={fullDate(s.scannedAt)}>
                    {timeAgo(s.scannedAt)}
                  </span>
                  <span className="scan-item-meta">{deviceLabel(s.userAgent)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {selection && (
          <PointPanel
            key={selection.mode === 'edit' ? selection.id : 'new'}
            point={selectedPoint}
            coords={selection.coords}
            onCoordsChange={setCoords}
            onClose={close}
            onSelectPoint={(p) => selectPoint(p, true)}
            onSaved={(p) =>
              // Po dodaniu nowego punktu zamykamy formularz; po edycji zostajemy w panelu.
              selection.mode === 'create'
                ? close()
                : setSelection({ mode: 'edit', id: p.id, coords: { lat: p.lat, lng: p.lng } })
            }
          />
        )}
      </div>
    </div>
  );
}
