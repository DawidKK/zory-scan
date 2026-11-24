import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Cable, Crosshair, MapPin, Navigation, Plus, QrCode, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { fullDate, timeAgo } from '../lib/format';
import { distanceMeters, formatDistance, nearestPoint } from '../lib/geo';
import {
  cabinetLabel,
  circuitColor,
  circuitLabel,
  compareNumbers,
  descendants,
  feedOrigin,
  nextPhase,
  nextSuffix,
  PHASES,
  pathFromCabinet,
  poleLabel,
  pointTitle,
  suggestNumber,
  suggestPhase,
  toRoman,
} from '../lib/network';
import { useNetwork } from '../lib/queries';
import type { FixtureInput, Phase, Point, PointInput, PointStatus } from '../lib/types';
import { useToast } from './Toast';

export interface Coords {
  lat: number;
  lng: number;
}

export interface PointDefaults {
  circuitId?: string | null;
  parentId?: string | null;
}

interface Props {
  /** null = tworzenie nowego słupa */
  point: Point | null;
  coords: Coords;
  onCoordsChange: (c: Coords) => void;
  onClose: () => void;
  onSaved?: (p: Point) => void;
  /** Kliknięcie w słup (najbliższy, droga zasilania). */
  onSelectPoint?: (p: Point) => void;
  /** Wartości startowe dla nowego słupa. */
  defaults?: PointDefaults;
  /** Wskazanie słupa poprzedzającego na mapie (dostępne tylko na mapie). */
  onRequestPick?: (cb: (p: Point) => void) => void;
  onCancelPick?: () => void;
  picking?: boolean;
}

type FixtureRow = FixtureInput & { key: number };
let rowKey = 0;
const toRow = (f: FixtureInput): FixtureRow => ({
  key: ++rowKey,
  suffix: f.suffix,
  phase: f.phase,
  powerW: f.powerW,
  model: f.model,
});

export function PointPanel({
  point,
  coords,
  onCoordsChange,
  onClose,
  onSaved,
  onSelectPoint,
  defaults,
  onRequestPick,
  onCancelPick,
  picking,
}: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const { idx, points: allPoints, cabinets } = useNetwork();

  const initialCircuit = point ? point.circuitId : defaults?.circuitId ?? null;
  const initialParent = point ? point.parentId : defaults?.parentId ?? null;

  const [name, setName] = useState(point?.name ?? '');
  const [content, setContent] = useState(point?.content ?? '');
  const [cabinetId, setCabinetId] = useState<string | null>(
    (initialCircuit && idx.circuits.get(initialCircuit)?.cabinetId) || null,
  );
  const [circuitId, setCircuitId] = useState<string | null>(initialCircuit);
  const [parentId, setParentId] = useState<string | null>(initialParent);
  const [number, setNumber] = useState(
    point?.number ?? suggestNumber(initialCircuit, initialParent, idx).preferred ?? '',
  );
  // Dla nowego słupa numer podąża za podpowiedzią, dopóki użytkownik go nie zmieni.
  const [numberTouched, setNumberTouched] = useState(!!point);
  const [inventoryId, setInventoryId] = useState(point?.inventoryId ?? '');
  const [status, setStatus] = useState<PointStatus>(point?.status ?? 'existing');
  const [cableLength, setCableLength] = useState(point?.cableLength != null ? String(point.cableLength) : '');
  const [cableType, setCableType] = useState(point?.cableType ?? '');
  const [fixtures, setFixtures] = useState<FixtureRow[]>(() =>
    point
      ? point.fixtures.map(toRow)
      : [toRow({ suffix: null, phase: suggestPhase(initialParent, idx), powerW: null, model: '' })],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !picking && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, picking]);

  const cabinet = cabinetId ? idx.cabinets.get(cabinetId) : undefined;
  const circuit = circuitId ? idx.circuits.get(circuitId) : undefined;
  const suggestion = useMemo(() => suggestNumber(circuitId, parentId, idx, point?.id), [circuitId, parentId, idx, point?.id]);

  // Kandydaci na słup poprzedzający: ten sam obwód, bez siebie i słupów, które ten słup zasila (cykl).
  const parentOptions = useMemo(() => {
    if (!circuitId) return [];
    const blocked = point ? descendants(point.id, idx) : new Set<string>();
    if (point) blocked.add(point.id);
    return (idx.byCircuit.get(circuitId) ?? [])
      .filter((p) => !blocked.has(p.id))
      .sort((a, b) => compareNumbers(a.number, b.number));
  }, [circuitId, idx, point]);

  const nearest = nearestPoint(coords, allPoints, point?.id);
  const moved = !!point && (point.lat !== coords.lat || point.lng !== coords.lng);
  const addressText = !point
    ? 'Zostanie pobrany po zapisie'
    : moved
      ? 'Zaktualizuje się po zapisie'
      : point.address ?? 'Nie udało się ustalić adresu';

  const origin = feedOrigin({ circuitId, parentId }, idx);
  const estimatedCable = origin ? Math.round(distanceMeters(origin, coords)) : null;
  const path = point && point.circuitId === circuitId ? pathFromCabinet(point, idx).slice(0, -1) : [];
  const parentPoint = parentId ? idx.points.get(parentId) : undefined;
  const fedCount = point ? descendants(point.id, idx).size : 0;

  const fullLabel = cabinet && circuit ? `${cabinet.number}/${toRoman(circuit.number)}/${number || '?'}` : null;
  const title = point ? poleLabel(point, idx) ?? (point.name || 'Słup') : 'Nowy słup';

  function applySuggestion(cId: string | null, pId: string | null) {
    if (!numberTouched) setNumber(suggestNumber(cId, pId, idx, point?.id).preferred ?? '');
  }

  function changeCabinet(id: string) {
    const next = id || null;
    setCabinetId(next);
    const circs = next ? idx.cabinets.get(next)?.circuits ?? [] : [];
    const c = circs.length === 1 ? circs[0].id : null;
    setCircuitId(c);
    setParentId(null);
    applySuggestion(c, null);
  }

  function changeCircuit(id: string) {
    const c = id || null;
    setCircuitId(c);
    setParentId(null);
    applySuggestion(c, null);
  }

  function changeParent(id: string | null) {
    setParentId(id);
    applySuggestion(circuitId, id);
  }

  function pickOnMap() {
    onRequestPick?.((p) => {
      if (point && (p.id === point.id || descendants(point.id, idx).has(p.id))) {
        toast('Nie można podpiąć pod słup, który ten słup zasila', 'red');
        return;
      }
      const c = p.circuitId ? idx.circuits.get(p.circuitId) : undefined;
      if (!c) {
        toast('Wskazany słup nie jest przypisany do obwodu', 'red');
        return;
      }
      setCabinetId(c.cabinetId);
      setCircuitId(c.id);
      setParentId(p.id);
      applySuggestion(c.id, p.id);
    });
  }

  function updateFixture(key: number, patch: Partial<FixtureInput>) {
    setFixtures((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function addFixture() {
    setFixtures((list) => {
      const phase = list.length ? nextPhase(list[list.length - 1].phase) : suggestPhase(parentId, idx);
      const template = list[list.length - 1];
      // Druga oprawa na słupie → indeksy literowe (15a, 15b).
      const withSuffixes = list.map((f, i) => (list.length === 1 && i === 0 && !f.suffix ? { ...f, suffix: 'a' } : f));
      const suffix = list.length ? nextSuffix(withSuffixes.map((f) => f.suffix)) : null;
      return [
        ...withSuffixes,
        toRow({ suffix, phase, powerW: template?.powerW ?? null, model: template?.model ?? '' }),
      ];
    });
  }

  const save = useMutation({
    mutationFn: () => {
      const length = cableLength.trim() === '' ? null : Number(cableLength.replace(',', '.'));
      const input: PointInput = {
        name: name.trim(),
        content,
        lat: coords.lat,
        lng: coords.lng,
        circuitId,
        parentId: circuitId ? parentId : null,
        number: number.trim() || null,
        inventoryId: inventoryId.trim() || null,
        status,
        cableLength: length != null && Number.isFinite(length) ? length : null,
        cableType: cableType.trim() || null,
        fixtures: fixtures.map(({ key: _key, ...f }) => ({ ...f, suffix: f.suffix?.trim() || null })),
      };
      return point ? api.updatePoint(point.id, input) : api.createPoint(input);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['points'] });
      toast(point ? 'Zapisano zmiany' : 'Dodano słup');
      onSaved?.(saved);
    },
    onError: (err) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deletePoint(point!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points'] });
      qc.invalidateQueries({ queryKey: ['scans'] });
      toast('Usunięto słup', 'red');
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  function setCoord(key: keyof Coords, value: string) {
    const n = Number(value);
    if (value !== '' && Number.isFinite(n)) onCoordsChange({ ...coords, [key]: n });
  }

  const chips = [
    suggestion.continuation && { label: 'Dalej w linii', value: suggestion.continuation },
    suggestion.branch && { label: 'Odgałęzienie', value: suggestion.branch },
  ].filter((c): c is { label: string; value: string } => !!c && c.value !== number);

  return (
    <aside className="panel" aria-label={point ? 'Edycja słupa' : 'Nowy słup'}>
      <header className="panel-head">
        <h2 className="panel-title">
          {circuit && <span className="panel-title-dot" style={{ background: circuitColor(circuit.number) }} />}
          {title}
        </h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Zamknij">
          <X size={16} strokeWidth={1.75} />
        </button>
      </header>

      <form className="panel-body" onSubmit={submit}>
        {/* ---------- Zasilanie ---------- */}
        <section className="panel-section">
          <h3 className="panel-section-title">Zasilanie</h3>
          <div className="field-row">
            <label className="field">
              <span className="label">Szafa SOU</span>
              <select className="select" value={cabinetId ?? ''} onChange={(e) => changeCabinet(e.target.value)}>
                <option value="">— brak —</option>
                {cabinets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cabinetLabel(c)}
                    {c.name ? ` · ${c.name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Obwód</span>
              <select
                className="select"
                value={circuitId ?? ''}
                onChange={(e) => changeCircuit(e.target.value)}
                disabled={!cabinet}
              >
                <option value="">—</option>
                {cabinet?.circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {circuitLabel(c)}
                    {c.description ? ` · ${c.description}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {cabinets.length === 0 && (
            <p className="panel-hint">Brak szaf. Przełącz dodawanie na „SOU” i kliknij na mapie, aby dodać szafę.</p>
          )}

          {circuit && (
            <>
              <div className="field">
                <span className="label">Zasilany z</span>
                <div className="input-group">
                  <select
                    className="select"
                    value={parentId ?? ''}
                    onChange={(e) => changeParent(e.target.value || null)}
                  >
                    <option value="">Bezpośrednio z szafy {cabinetLabel(circuit.cabinet)}</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {pointTitle(p, idx)}
                        {p.name ? ` · ${p.name}` : ''}
                      </option>
                    ))}
                  </select>
                  {onRequestPick &&
                    (picking ? (
                      <button type="button" className="btn btn-secondary btn-active" onClick={onCancelPick}>
                        Anuluj
                      </button>
                    ) : (
                      <button type="button" className="btn btn-secondary" onClick={pickOnMap} title="Wskaż słup na mapie">
                        <Crosshair size={14} strokeWidth={1.75} />
                        Wskaż
                      </button>
                    ))}
                </div>
                {picking && <p className="panel-hint panel-hint-tight">Kliknij na mapie słup, z którego zasilany jest ten słup.</p>}
              </div>

              <div className="field">
                <span className="label">Numer słupa w obwodzie</span>
                <div className="input-group">
                  <span className="input-prefix tabular">
                    {circuit.cabinet.number}/{toRoman(circuit.number)}/
                  </span>
                  <input
                    className="input tabular"
                    value={number}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      setNumberTouched(true);
                    }}
                    placeholder="np. 8/2/1"
                    maxLength={40}
                  />
                </div>
                {chips.length > 0 && (
                  <div className="chips">
                    {chips.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        className="chip"
                        onClick={() => {
                          setNumber(c.value);
                          setNumberTouched(true);
                        }}
                      >
                        {c.label}: <span className="tabular">{c.value}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="panel-hint panel-hint-tight">
                  Numeracja rośnie od szafy. Odgałęzienie od słupa 8 to 8/1, 8/2…
                </p>
              </div>

              <div className="field-row">
                <label className="field">
                  <span className="label">Kabel — długość (m)</span>
                  <input
                    className="input tabular"
                    inputMode="decimal"
                    value={cableLength}
                    onChange={(e) => setCableLength(e.target.value)}
                    placeholder={estimatedCable != null ? `≈ ${estimatedCable} z mapy` : ''}
                  />
                </label>
                <label className="field">
                  <span className="label">Typ kabla</span>
                  <input
                    className="input"
                    value={cableType}
                    onChange={(e) => setCableType(e.target.value)}
                    placeholder="np. YAKXS 4x35"
                    maxLength={100}
                  />
                </label>
              </div>
            </>
          )}
        </section>

        {/* ---------- Oprawy ---------- */}
        <section className="panel-section">
          <h3 className="panel-section-title">
            Oprawy
            <span className="panel-section-meta tabular">{fixtures.length}</span>
          </h3>
          {fixtures.length > 0 && (
            <div className="fixtures">
              <div className="fixture-row fixture-head">
                <span>Indeks</span>
                <span>Faza</span>
                <span>Moc W</span>
                <span>Typ / model</span>
                <span />
              </div>
              {fixtures.map((f) => (
                <div key={f.key} className="fixture-row">
                  <input
                    className="input input-sm tabular"
                    value={f.suffix ?? ''}
                    onChange={(e) => updateFixture(f.key, { suffix: e.target.value || null })}
                    placeholder="—"
                    maxLength={5}
                    aria-label="Indeks oprawy"
                  />
                  <select
                    className="select select-sm"
                    value={f.phase ?? ''}
                    onChange={(e) => updateFixture(f.key, { phase: (e.target.value || null) as Phase | null })}
                    aria-label="Faza"
                  >
                    <option value="">—</option>
                    {PHASES.map((ph) => (
                      <option key={ph} value={ph}>
                        {ph}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input input-sm tabular"
                    type="number"
                    min={0}
                    value={f.powerW ?? ''}
                    onChange={(e) => updateFixture(f.key, { powerW: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="—"
                    aria-label="Moc w watach"
                  />
                  <input
                    className="input input-sm"
                    value={f.model}
                    onChange={(e) => updateFixture(f.key, { model: e.target.value })}
                    placeholder="np. LED"
                    maxLength={200}
                    aria-label="Typ oprawy"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setFixtures((list) => list.filter((x) => x.key !== f.key))}
                    aria-label="Usuń oprawę"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-sm btn-start" onClick={addFixture}>
            <Plus size={14} strokeWidth={1.75} />
            Dodaj oprawę
          </button>
        </section>

        {/* ---------- Identyfikacja ---------- */}
        <section className="panel-section">
          <h3 className="panel-section-title">Słup</h3>
          <div className="field-row">
            <label className="field">
              <span className="label">Stan</span>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as PointStatus)}>
                <option value="existing">Istniejący</option>
                <option value="planned">Projektowany</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Nr inwentarzowy</span>
              <input
                className="input tabular"
                value={inventoryId}
                onChange={(e) => setInventoryId(e.target.value)}
                placeholder="np. OU-14582"
                maxLength={60}
              />
            </label>
          </div>
          <label className="field">
            <span className="label">Opis / lokalizacja</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. ul. Wodzisławska, przy przejściu"
              maxLength={200}
            />
          </label>
          <label className="field">
            <span className="label">Treść wyświetlana po skanie</span>
            <textarea
              className="textarea textarea-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Dowolny tekst…"
              rows={4}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="label">Szerokość</span>
              <input
                className="input tabular"
                type="number"
                step="any"
                min={-90}
                max={90}
                defaultValue={coords.lat}
                key={`lat-${coords.lat}`}
                onBlur={(e) => setCoord('lat', e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="label">Długość</span>
              <input
                className="input tabular"
                type="number"
                step="any"
                min={-180}
                max={180}
                defaultValue={coords.lng}
                key={`lng-${coords.lng}`}
                onBlur={(e) => setCoord('lng', e.target.value)}
                required
              />
            </label>
          </div>
          {onRequestPick && (
            <p className="panel-hint">
              {point ? 'Przeciągnij marker na mapie, aby zmienić położenie.' : 'Kliknij na mapie albo przeciągnij marker.'}
            </p>
          )}
        </section>

        <div className="panel-info">
          {circuit && (
            <div className="panel-info-row">
              <Cable size={14} strokeWidth={1.75} />
              <div>
                <div className="panel-info-label">Droga zasilania</div>
                <div className="path">
                  <span className="path-node path-sou">{cabinetLabel(circuit.cabinet)}</span>
                  <span className="path-node path-circuit">{circuitLabel(circuit)}</span>
                  {(point ? path : parentPoint ? pathFromCabinet(parentPoint, idx) : []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="path-node path-link tabular"
                      onClick={() => onSelectPoint?.(p)}
                      disabled={!onSelectPoint}
                    >
                      {p.number ?? '?'}
                    </button>
                  ))}
                  <span className="path-node path-current tabular">{number || '?'}</span>
                </div>
                {point && fedCount > 0 && (
                  <div className="panel-info-muted">
                    Zasila dalej <span className="tabular">{fedCount}</span> {fedCount === 1 ? 'słup' : 'słupów'}
                  </div>
                )}
                {fullLabel && <div className="panel-info-muted tabular">Oznaczenie: {fullLabel}</div>}
              </div>
            </div>
          )}
          <div className="panel-info-row">
            <MapPin size={14} strokeWidth={1.75} />
            <div>
              <div className="panel-info-label">Adres</div>
              <div className={point?.address && !moved ? 'panel-info-value' : 'panel-info-muted'}>{addressText}</div>
            </div>
          </div>
          <div className="panel-info-row">
            <Navigation size={14} strokeWidth={1.75} />
            <div>
              <div className="panel-info-label">Najbliższy słup</div>
              {nearest ? (
                <button
                  type="button"
                  className="panel-info-link"
                  onClick={() => onSelectPoint?.(nearest.point)}
                  disabled={!onSelectPoint}
                >
                  {pointTitle(nearest.point, idx)}
                  <span className="panel-info-muted tabular"> · {formatDistance(nearest.distance)}</span>
                </button>
              ) : (
                <div className="panel-info-muted">Brak innych słupów</div>
              )}
            </div>
          </div>
        </div>

        {point && (
          <dl className="panel-meta">
            <div>
              <dt>Skany</dt>
              <dd className="tabular">{point.scanCount}</dd>
            </div>
            <div>
              <dt>Ostatni skan</dt>
              <dd title={fullDate(point.lastScanAt)}>{timeAgo(point.lastScanAt)}</dd>
            </div>
            <div>
              <dt>Utworzono</dt>
              <dd>{fullDate(point.createdAt)}</dd>
            </div>
            <div>
              <dt>ID</dt>
              <dd className="panel-id">{point.id}</dd>
            </div>
          </dl>
        )}

        {error && <p className="form-error">{error}</p>}
        {confirmDelete && fedCount > 0 && (
          <p className="panel-hint panel-hint-tight">
            Słupy zasilane z tego słupa zostaną podpięte pod jego poprzednika.
          </p>
        )}

        <div className="panel-actions">
          <button className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Zapisywanie…' : point ? 'Zapisz' : 'Dodaj słup'}
          </button>
          {point && (
            <Link className="btn btn-secondary" to={`/admin/qr?p=${point.id}`}>
              <QrCode size={14} strokeWidth={1.75} />
              Pokaż QR
            </Link>
          )}
          <span className="spacer" />
          {point &&
            (confirmDelete ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                Potwierdź usunięcie
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-icon"
                onClick={() => setConfirmDelete(true)}
                aria-label="Usuń słup"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            ))}
        </div>
      </form>
    </aside>
  );
}
