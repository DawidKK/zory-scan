import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PenLine, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useNetwork, useScans } from '../../lib/queries';
import { deviceLabel, fullDate, isFresh, timeAgo } from '../../lib/format';
import {
  cabinetLabel,
  circuitColor,
  circuitLabel,
  descendants,
  feedOrigin,
  pathFromCabinet,
  pointTitle,
  suggestNumber,
  suggestPhase,
  toRoman,
} from '../../lib/network';
import type { Cabinet, Point } from '../../lib/types';
import { PointPanel, type Coords, type PointDefaults } from '../../components/PointPanel';
import { CabinetPanel } from '../../components/CabinetPanel';
import { NetworkTree } from '../../components/NetworkTree';
import { HeatLayer } from '../../components/HeatLayer';
import { useToast } from '../../components/Toast';

/* ---------- Preferencje widoku (per przeglądarka) ---------- */

function usePref<T extends string | boolean>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initial;
      return (typeof initial === 'boolean' ? raw === '1' : raw) as T;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, typeof v === 'boolean' ? (v ? '1' : '0') : v);
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set] as const;
}

// Domyślny widok: Żory
const DEFAULT_CENTER: [number, number] = [50.0449, 18.7];
const DEFAULT_ZOOM = 14;
/** Od tego przybliżenia przy słupach widać numery. */
const LABEL_ZOOM = 17;

/* ---------- Znaczniki ---------- */

// Słup (oprawa): czerwona pinezka. Kolor sterowany klasą CSS (.pin-body).
const PIN_SVG =
  '<svg width="26" height="34" viewBox="-1 -1 26 34" aria-hidden="true">' +
  '<path class="pin-body" d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/>' +
  '<circle class="pin-eye" cx="12" cy="12" r="4.5"/></svg>';

const poleIcons = new Map<string, L.DivIcon>();
function poleIcon(state: 'normal' | 'fresh' | 'selected' | 'draft', planned: boolean, count: number, dim: boolean) {
  const key = `${state}|${planned}|${count}|${dim}`;
  let icon = poleIcons.get(key);
  if (!icon) {
    const cls = ['pin', state !== 'normal' && `pin-${state}`, planned && 'pin-planned', dim && 'pin-dim']
      .filter(Boolean)
      .join(' ');
    const badge = count > 1 ? `<span class="pin-count">${count}</span>` : '';
    icon = L.divIcon({
      className: '',
      html: `<span class="${cls}">${PIN_SVG}${badge}</span>`,
      iconSize: [26, 34],
      iconAnchor: [13, 33],
    });
    poleIcons.set(key, icon);
  }
  return icon;
}

// Szafa SOU: niebieski kwadrat z błyskawicą — inny kształt niż pinezka słupa.
const SOU_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>';

const souIcons = new Map<string, L.DivIcon>();
function souIcon(state: 'normal' | 'selected' | 'draft', dim: boolean) {
  const key = `${state}|${dim}`;
  let icon = souIcons.get(key);
  if (!icon) {
    const cls = ['sou', state !== 'normal' && `sou-${state}`, dim && 'sou-dim'].filter(Boolean).join(' ');
    icon = L.divIcon({
      className: '',
      html: `<span class="${cls}">${SOU_SVG}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    souIcons.set(key, icon);
  }
  return icon;
}

/* ---------- Stan ---------- */

type Selection =
  | { kind: 'point'; mode: 'create'; coords: Coords; defaults?: PointDefaults }
  | { kind: 'point'; mode: 'edit'; id: string; coords: Coords }
  | { kind: 'cabinet'; mode: 'create'; coords: Coords }
  | { kind: 'cabinet'; mode: 'edit'; id: string; coords: Coords }
  | null;

type AddMode = 'point' | 'cabinet';
type Draw = { circuitId: string; fromId: string | null } | null;

function ClickHandler({ onClick }: { onClick: (c: Coords) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

/** Podgląd odcinka kabla od słupa „zasilającego” do kursora w trybie rysowania. */
function DrawGhost({ from, color }: { from: Coords | null; color: string }) {
  const [cursor, setCursor] = useState<Coords | null>(null);
  useMapEvents({
    mousemove: (e) => setCursor({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout: () => setCursor(null),
  });
  if (!from || !cursor) return null;
  return (
    <Polyline
      positions={[
        [from.lat, from.lng],
        [cursor.lat, cursor.lng],
      ]}
      pathOptions={{ color, weight: 2, dashArray: '4 6', opacity: 0.9, interactive: false }}
    />
  );
}

function FitOnce({ coords, focus, ready }: { coords: Coords[]; focus: Coords | null; ready: boolean }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ready || coords.length === 0) return;
    done.current = true;
    if (focus) map.setView([focus.lat, focus.lng], 17);
    else if (coords.length === 1) map.setView([coords[0].lat, coords[0].lng], 16);
    else map.fitBounds(L.latLngBounds(coords.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 17 });
  }, [map, coords, focus, ready]);
  return null;
}

export function MapPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { idx, points, cabinets, isLoading } = useNetwork();
  const { data: scans = [], isLoading: scansLoading } = useScans();
  const [params, setParams] = useSearchParams();
  const focusId = params.get('point');
  const [selection, setSelection] = useState<Selection>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [addMode, setAddMode] = useState<AddMode>('point');
  const [draw, setDraw] = useState<Draw>(null);
  const [pick, setPick] = useState<((p: Point) => void) | null>(null);

  const [showHeat, setShowHeat] = usePref<boolean>('zs_map_heat', false);
  const [showLines, setShowLines] = usePref<boolean>('zs_map_lines', true);
  const [showLabels, setShowLabels] = usePref<boolean>('zs_map_labels', true);
  const [scope, setScope] = usePref<string>('zs_map_scope', 'all');
  const [sideTab, setSideTab] = usePref<string>('zs_map_side', 'network');

  // Zakres widoczności: cała sieć / jedna szafa / nieprzypisane.
  const scopeValid = scope === 'all' || scope === 'unassigned' || idx.cabinets.has(scope);
  const activeScope = scopeValid ? scope : 'all';
  const visiblePoints = useMemo(() => {
    if (activeScope === 'all') return points;
    if (activeScope === 'unassigned') return idx.unassigned;
    return points.filter((p) => p.circuitId && idx.circuits.get(p.circuitId)?.cabinetId === activeScope);
  }, [activeScope, points, idx]);
  const visibleCabinets = useMemo(
    () => (activeScope === 'all' ? cabinets : cabinets.filter((c) => c.id === activeScope)),
    [activeScope, cabinets],
  );

  // Heatmapa: każdy słup ważony liczbą wszystkich swoich skanów (względem najczęściej skanowanego).
  const heatPoints = useMemo(() => {
    const max = Math.max(0, ...points.map((p) => p.scanCount));
    return points
      .filter((p) => p.scanCount > 0)
      .map((p) => [p.lat, p.lng, max ? p.scanCount / max : 0] as [number, number, number]);
  }, [points]);
  const totalScans = useMemo(() => points.reduce((sum, p) => sum + p.scanCount, 0), [points]);

  const selectedPoint = selection?.kind === 'point' && selection.mode === 'edit' ? idx.points.get(selection.id) ?? null : null;
  const selectedCabinet =
    selection?.kind === 'cabinet' && selection.mode === 'edit' ? idx.cabinets.get(selection.id) ?? null : null;
  const selectedId = selection && selection.mode === 'edit' ? selection.id : null;

  // Podświetlenie: droga zasilania i słupy zasilane z zaznaczonego / obwody zaznaczonej szafy / rysowany obwód.
  const highlight = useMemo(() => {
    if (draw) return { circuits: new Set([draw.circuitId]), points: null as Set<string> | null };
    if (selectedPoint?.circuitId && idx.circuits.has(selectedPoint.circuitId)) {
      const set = descendants(selectedPoint.id, idx);
      for (const p of pathFromCabinet(selectedPoint, idx)) set.add(p.id);
      return { circuits: null, points: set };
    }
    if (selectedCabinet) return { circuits: new Set(selectedCabinet.circuits.map((c) => c.id)), points: null };
    return null;
  }, [draw, selectedPoint, selectedCabinet, idx]);

  const isHighlighted = (p: Point) =>
    !highlight ||
    (highlight.points ? highlight.points.has(p.id) : !!p.circuitId && !!highlight.circuits?.has(p.circuitId));

  /* ---------- Akcje ---------- */

  const flyTo = useCallback(
    (c: Coords) => map?.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 16), { duration: 0.4 }),
    [map],
  );

  const selectPoint = useCallback(
    (p: Point, pan = false) => {
      setSelection({ kind: 'point', mode: 'edit', id: p.id, coords: { lat: p.lat, lng: p.lng } });
      if (pan) flyTo(p);
    },
    [flyTo],
  );

  const selectCabinet = useCallback(
    (c: Cabinet, pan = false) => {
      setSelection({ kind: 'cabinet', mode: 'edit', id: c.id, coords: { lat: c.lat, lng: c.lng } });
      if (pan) flyTo(c);
    },
    [flyTo],
  );

  // ?point=<id> (np. z listy skanów) → otwórz panel słupa
  useEffect(() => {
    if (!focusId || points.length === 0) return;
    const p = idx.points.get(focusId);
    if (p) selectPoint(p);
    setParams({}, { replace: true });
  }, [focusId, points.length, idx, setParams, selectPoint]);

  const close = useCallback(() => {
    setSelection(null);
    setPick(null);
  }, []);

  const startDraw = useCallback(
    (circuitId: string) => {
      const poles = idx.byCircuit.get(circuitId) ?? [];
      // Kontynuujemy od ostatnio dodanego słupa obwodu (albo od szafy, gdy obwód jest pusty).
      const last = poles.reduce<Point | null>((a, p) => (!a || p.createdAt > a.createdAt ? p : a), null);
      setSelection(null);
      setPick(null);
      setDraw({ circuitId, fromId: last?.id ?? null });
      const c = idx.circuits.get(circuitId);
      const target = last ?? c?.cabinet;
      if (target) flyTo(target);
    },
    [idx, flyTo],
  );

  const drawCreate = useMutation({
    mutationFn: ({ coords, circuitId, fromId }: { coords: Coords; circuitId: string; fromId: string | null }) =>
      api.createPoint({
        name: '',
        content: '',
        lat: coords.lat,
        lng: coords.lng,
        circuitId,
        parentId: fromId,
        number: suggestNumber(circuitId, fromId, idx).preferred,
        inventoryId: null,
        status: 'existing',
        cableLength: null,
        cableType: null,
        fixtures: [{ suffix: null, phase: suggestPhase(fromId, idx), powerW: null, model: '' }],
      }),
    onSuccess: (saved) => {
      // Od razu do cache, żeby kolejna podpowiedź numeru uwzględniła nowy słup.
      qc.setQueryData<Point[]>(['points'], (old = []) => [{ ...saved, scanCount: 0, lastScanAt: null }, ...old]);
      qc.invalidateQueries({ queryKey: ['points'] });
      setDraw((d) => (d ? { ...d, fromId: saved.id } : d));
    },
    onError: (err) => toast(err.message, 'red'),
  });

  const onMapClick = useCallback(
    (coords: Coords) => {
      if (pick) return setPick(null);
      if (draw) {
        if (!drawCreate.isPending) drawCreate.mutate({ coords, ...draw });
        return;
      }
      setSelection((s) => {
        if (s?.mode === 'create' && s.kind === addMode) return { ...s, coords };
        if (s) return null;
        return { kind: addMode, mode: 'create', coords };
      });
    },
    [pick, draw, drawCreate, addMode],
  );

  const onPointClick = useCallback(
    (p: Point) => {
      if (pick) {
        pick(p);
        setPick(null);
        return;
      }
      if (draw) {
        if (p.circuitId === draw.circuitId) setDraw({ ...draw, fromId: p.id });
        else toast('Ten słup należy do innego obwodu', 'red');
        return;
      }
      selectPoint(p);
    },
    [pick, draw, selectPoint, toast],
  );

  const onCabinetClick = useCallback(
    (c: Cabinet) => {
      if (pick) return;
      if (draw) {
        if (c.circuits.some((x) => x.id === draw.circuitId)) setDraw({ ...draw, fromId: null });
        return;
      }
      selectCabinet(c);
    },
    [pick, draw, selectCabinet],
  );

  // Esc: najpierw anuluje wskazywanie, potem kończy rysowanie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pick) setPick(null);
      else if (draw) setDraw(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, draw]);

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

  const requestPick = useCallback((cb: (p: Point) => void) => setPick(() => cb), []);
  const cancelPick = useCallback(() => setPick(null), []);

  /* ---------- Linie kablowe ---------- */

  const lines = useMemo(() => {
    if (!showLines) return [];
    return visiblePoints.flatMap((p) => {
      const c = p.circuitId ? idx.circuits.get(p.circuitId) : undefined;
      const origin = c && feedOrigin(p, idx);
      if (!c || !origin) return [];
      // Pozycja zaznaczonego słupa podąża za przeciąganiem.
      const pos = selection?.kind === 'point' && selection.mode === 'edit' && selection.id === p.id ? selection.coords : p;
      const parentSel =
        selection?.kind === 'point' && selection.mode === 'edit' && selection.id === p.parentId ? selection.coords : null;
      const cabSel =
        !p.parentId && selection?.kind === 'cabinet' && selection.mode === 'edit' && selection.id === c.cabinetId
          ? selection.coords
          : null;
      const from = parentSel ?? cabSel ?? origin;
      return [
        {
          id: p.id,
          positions: [
            [from.lat, from.lng],
            [pos.lat, pos.lng],
          ] as [number, number][],
          color: circuitColor(c.number),
          planned: p.status === 'planned',
          active: isHighlighted(p),
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLines, visiblePoints, idx, selection, highlight]);

  const labelsOn = showLabels && zoom >= LABEL_ZOOM;
  const drawCircuit = draw ? idx.circuits.get(draw.circuitId) : undefined;
  const drawFrom = draw?.fromId ? idx.points.get(draw.fromId) : undefined;
  const drawNext = draw ? suggestNumber(draw.circuitId, draw.fromId, idx).preferred : null;
  const drawOrigin: Coords | null = drawFrom ?? drawCircuit?.cabinet ?? null;

  // Rysowany obwód zniknął (np. usunięty w innej karcie) → kończymy rysowanie.
  useEffect(() => {
    if (draw && !isLoading && !drawCircuit) setDraw(null);
  }, [draw, drawCircuit, isLoading]);

  const fitCoords = useMemo<Coords[]>(() => [...points, ...cabinets], [points, cabinets]);
  const focusPoint = focusId ? idx.points.get(focusId) ?? null : null;

  return (
    <div className="page page-full">
      <header className="topbar">
        <h1 className="topbar-title">Mapa</h1>
        <span className="topbar-meta tabular">
          {isLoading ? '…' : `${cabinets.length} SOU · ${points.length} słupów`}
        </span>
        <span className="spacer" />
        <span className="topbar-hint">Kliknij na mapie, aby dodać</span>
        <div className="segmented" role="group" aria-label="Co dodaje kliknięcie na mapie">
          <button
            className={`segmented-item ${addMode === 'point' ? 'segmented-item-active' : ''}`}
            aria-pressed={addMode === 'point'}
            onClick={() => setAddMode('point')}
          >
            <span className="seg-pin" aria-hidden="true" />
            Słup
          </button>
          <button
            className={`segmented-item ${addMode === 'cabinet' ? 'segmented-item-active' : ''}`}
            aria-pressed={addMode === 'cabinet'}
            onClick={() => setAddMode('cabinet')}
          >
            <span className="sou-swatch" aria-hidden="true" />
            SOU
          </button>
        </div>
      </header>

      <div className="map-layout">
        <div className={`map-wrap ${draw || pick ? 'map-wrap-crosshair' : ''}`}>
          <MapContainer ref={setMap} center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="map" zoomControl>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <ClickHandler onClick={onMapClick} />
            <ZoomWatcher onZoom={setZoom} />
            <FitOnce coords={fitCoords} focus={focusPoint} ready={!isLoading} />
            {showHeat && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

            {lines.map((l) => (
              <Polyline
                key={`${l.id}-${l.active}-${l.planned}`}
                positions={l.positions}
                pathOptions={{
                  color: l.color,
                  weight: highlight && l.active ? 5 : 3,
                  opacity: l.active ? 0.95 : 0.3,
                  dashArray: l.planned ? '7 6' : undefined,
                  lineCap: 'round',
                  interactive: false,
                }}
              />
            ))}

            {draw && drawCircuit && <DrawGhost from={drawOrigin} color={circuitColor(drawCircuit.number)} />}

            {visibleCabinets.map((c) => {
              const isSelected = selection?.kind === 'cabinet' && selection.mode === 'edit' && selection.id === c.id;
              const pos: [number, number] = isSelected ? [selection.coords.lat, selection.coords.lng] : [c.lat, c.lng];
              const dim = !!highlight && !c.circuits.some((x) => highlight.circuits?.has(x.id) || false) && !isSelected;
              return (
                <Marker
                  key={c.id}
                  position={pos}
                  icon={souIcon(isSelected ? 'selected' : 'normal', dim && !highlight?.points)}
                  draggable={isSelected}
                  zIndexOffset={isSelected ? 1100 : 500}
                  eventHandlers={{ click: () => onCabinetClick(c), ...(isSelected ? dragHandlers : {}) }}
                >
                  <Tooltip
                    permanent
                    direction="right"
                    offset={[14, 0]}
                    className="map-label map-label-sou"
                    interactive={false}
                  >
                    {cabinetLabel(c)}
                  </Tooltip>
                </Marker>
              );
            })}

            {visiblePoints.map((p) => {
              const isSelected = selection?.kind === 'point' && selection.mode === 'edit' && selection.id === p.id;
              const pos: [number, number] = isSelected ? [selection.coords.lat, selection.coords.lng] : [p.lat, p.lng];
              const state = isSelected ? 'selected' : draw?.fromId === p.id ? 'selected' : isFresh(p.lastScanAt) ? 'fresh' : 'normal';
              const title = pointTitle(p, idx);
              return (
                <Marker
                  key={p.id}
                  position={pos}
                  icon={poleIcon(state, p.status === 'planned', p.fixtures.length, !isHighlighted(p) && !isSelected)}
                  draggable={isSelected}
                  zIndexOffset={isSelected ? 1000 : 0}
                  eventHandlers={{ click: () => onPointClick(p), ...(isSelected ? dragHandlers : {}) }}
                >
                  {labelsOn && p.number ? (
                    <Tooltip
                      key="label"
                      permanent
                      direction="right"
                      offset={[10, -20]}
                      className="map-label"
                      interactive={false}
                    >
                      <span className="tabular">{p.number}</span>
                      {p.fixtures.some((f) => f.phase) && (
                        <span className="map-label-phase">{p.fixtures.map((f) => f.phase ?? '—').join(' ')}</span>
                      )}
                    </Tooltip>
                  ) : (
                    <Tooltip key="hover" direction="top" offset={[0, -32]} className="map-tooltip">
                      {title}
                      {(p.name || p.address) && (
                        <span className="map-tooltip-address">{[p.name, p.address].filter(Boolean).join(' · ')}</span>
                      )}
                    </Tooltip>
                  )}
                </Marker>
              );
            })}

            {selection?.mode === 'create' && (
              <Marker
                position={[selection.coords.lat, selection.coords.lng]}
                icon={selection.kind === 'cabinet' ? souIcon('draft', false) : poleIcon('draft', false, 0, false)}
                draggable
                zIndexOffset={1200}
                eventHandlers={dragHandlers}
              />
            )}
          </MapContainer>

          {draw && drawCircuit && (
            <div className="draw-bar" role="status">
              <span className="circuit-swatch" style={{ background: circuitColor(drawCircuit.number) }} />
              <div className="draw-bar-text">
                <div className="draw-bar-title">
                  Rysowanie: {cabinetLabel(drawCircuit.cabinet)} · {circuitLabel(drawCircuit)}
                </div>
                <div className="draw-bar-meta">
                  Następny słup{' '}
                  <strong className="tabular">
                    {drawCircuit.cabinet.number}/{toRoman(drawCircuit.number)}/{drawNext ?? '?'}
                  </strong>{' '}
                  zasilany z{' '}
                  <strong className="tabular">{drawFrom ? drawFrom.number ?? '?' : cabinetLabel(drawCircuit.cabinet)}</strong>
                  <span className="draw-bar-hint">
                    {' '}
                    · klik na mapie dodaje słup · klik na słup obwodu = odgałęzienie od niego · Esc kończy
                  </span>
                </div>
              </div>
              {draw.fromId && (
                <button className="btn btn-secondary btn-sm" onClick={() => setDraw({ ...draw, fromId: null })}>
                  Od szafy
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setDraw(null)}>
                <X size={14} strokeWidth={1.75} />
                Zakończ
              </button>
            </div>
          )}

          {pick && (
            <div className="draw-bar" role="status">
              <div className="draw-bar-text">
                <div className="draw-bar-title">Wskaż słup zasilający</div>
                <div className="draw-bar-meta">Kliknij słup na mapie · Esc anuluje</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={cancelPick}>
                Anuluj
              </button>
            </div>
          )}

          <div className="map-filters">
            <label className="map-filter map-filter-select">
              <select className="select select-sm" value={activeScope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">Cała sieć</option>
                {cabinets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cabinetLabel(c)}
                    {c.name ? ` · ${c.name}` : ''}
                  </option>
                ))}
                <option value="unassigned">Nieprzypisane słupy</option>
              </select>
            </label>
            <label className="map-filter">
              <input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} />
              Linie kablowe
            </label>
            <label className="map-filter" title={`Widoczne od przybliżenia ${LABEL_ZOOM}`}>
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              Numery słupów
              {showLabels && zoom < LABEL_ZOOM && <span className="map-filter-meta">przybliż</span>}
            </label>
            <label className="map-filter">
              <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
              Heatmapa skanów
              <span className="map-filter-meta tabular">{totalScans}</span>
            </label>
          </div>
        </div>

        <aside className="map-side" aria-label="Sieć i skany">
          <div className="side-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={sideTab === 'network'}
              className={`side-tab ${sideTab === 'network' ? 'side-tab-active' : ''}`}
              onClick={() => setSideTab('network')}
            >
              Sieć
              <span className="tabular side-tab-count">{cabinets.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={sideTab === 'scans'}
              className={`side-tab ${sideTab === 'scans' ? 'side-tab-active' : ''}`}
              onClick={() => setSideTab('scans')}
            >
              <span className="dot dot-teal live-dot" />
              Ostatnie skany
              <span className="tabular side-tab-count">{scans.length}</span>
            </button>
          </div>

          <div className="map-side-list">
            {sideTab === 'network' ? (
              isLoading ? (
                <div className="empty">Wczytywanie…</div>
              ) : (
                <NetworkTree
                  idx={idx}
                  cabinets={cabinets}
                  selectedId={selectedId}
                  drawingCircuitId={draw?.circuitId ?? null}
                  onSelectPoint={(p) => (draw || pick ? onPointClick(p) : selectPoint(p, true))}
                  onSelectCabinet={(c) => {
                    setDraw(null);
                    selectCabinet(c, true);
                  }}
                  onDrawCircuit={startDraw}
                />
              )
            ) : (
              <>
                {scansLoading && <div className="empty">Wczytywanie…</div>}
                {!scansLoading && scans.length === 0 && <div className="empty">Brak skanów</div>}
                {scans.map((s) => {
                  const p = idx.points.get(s.pointId);
                  const active = selectedId === s.pointId;
                  return (
                    <button
                      key={s.id}
                      className={`scan-item ${active ? 'scan-item-active' : ''}`}
                      onClick={() => p && selectPoint(p, true)}
                    >
                      <span className={`dot ${isFresh(s.scannedAt) ? 'dot-teal' : 'dot-muted'}`} />
                      <span className="scan-item-title">
                        {p ? pointTitle(p, idx) : s.pointLabel ?? (s.pointName || 'Słup')}
                      </span>
                      <span className="scan-item-time tabular" title={fullDate(s.scannedAt)}>
                        {timeAgo(s.scannedAt)}
                      </span>
                      <span className="scan-item-meta">{deviceLabel(s.userAgent)}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          {sideTab === 'network' && cabinets.length > 0 && !draw && (
            <div className="side-foot">
              <PenLine size={12} strokeWidth={1.75} />
              Ikona przy obwodzie włącza rysowanie: każde kliknięcie na mapie to kolejny słup.
            </div>
          )}
        </aside>

        {selection?.kind === 'point' && (selection.mode === 'create' || selectedPoint) && (
          <PointPanel
            key={selection.mode === 'edit' ? selection.id : 'new'}
            point={selectedPoint}
            coords={selection.coords}
            defaults={selection.mode === 'create' ? selection.defaults : undefined}
            onCoordsChange={setCoords}
            onClose={close}
            onSelectPoint={(p) => selectPoint(p, true)}
            onRequestPick={requestPick}
            onCancelPick={cancelPick}
            picking={!!pick}
            onSaved={(p) =>
              // Po dodaniu nowego słupa zamykamy formularz; po edycji zostajemy w panelu.
              selection.mode === 'create'
                ? close()
                : setSelection({ kind: 'point', mode: 'edit', id: p.id, coords: { lat: p.lat, lng: p.lng } })
            }
          />
        )}

        {selection?.kind === 'cabinet' && (selection.mode === 'create' || selectedCabinet) && (
          <CabinetPanel
            key={selection.mode === 'edit' ? selection.id : 'new-cabinet'}
            cabinet={selectedCabinet}
            coords={selection.coords}
            onCoordsChange={setCoords}
            onClose={close}
            onDrawCircuit={startDraw}
            onSaved={(c) => setSelection({ kind: 'cabinet', mode: 'edit', id: c.id, coords: { lat: c.lat, lng: c.lng } })}
          />
        )}
      </div>
    </div>
  );
}
