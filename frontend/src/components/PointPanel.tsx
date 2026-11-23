import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Navigation, QrCode, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { fullDate, timeAgo } from '../lib/format';
import { formatDistance, nearestPoint } from '../lib/geo';
import { usePoints } from '../lib/queries';
import type { Point } from '../lib/types';
import { useToast } from './Toast';

export interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  /** null = tworzenie nowego punktu */
  point: Point | null;
  coords: Coords;
  onCoordsChange: (c: Coords) => void;
  onClose: () => void;
  onSaved?: (p: Point) => void;
  /** Kliknięcie w „najbliższy punkt”. */
  onSelectPoint?: (p: Point) => void;
}

export function PointPanel({ point, coords, onCoordsChange, onClose, onSaved, onSelectPoint }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: allPoints = [] } = usePoints();
  const nearest = nearestPoint(coords, allPoints, point?.id);
  const moved = !!point && (point.lat !== coords.lat || point.lng !== coords.lng);
  const addressText = !point
    ? 'Zostanie pobrany po zapisie'
    : moved
      ? 'Zaktualizuje się po zapisie'
      : point.address ?? 'Nie udało się ustalić adresu';
  const [name, setName] = useState(point?.name ?? '');
  const [content, setContent] = useState(point?.content ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), content, lat: coords.lat, lng: coords.lng };
      return point ? api.updatePoint(point.id, input) : api.createPoint(input);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['points'] });
      toast(point ? 'Zapisano zmiany' : 'Dodano punkt');
      onSaved?.(saved);
    },
    onError: (err) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deletePoint(point!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points'] });
      qc.invalidateQueries({ queryKey: ['scans'] });
      toast('Usunięto punkt', 'red');
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

  return (
    <aside className="panel" aria-label={point ? 'Edycja punktu' : 'Nowy punkt'}>
      <header className="panel-head">
        <h2 className="panel-title">{point ? 'Edycja punktu' : 'Nowy punkt'}</h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Zamknij">
          <X size={16} strokeWidth={1.75} />
        </button>
      </header>

      <form className="panel-body" onSubmit={submit}>
        <label className="field">
          <span className="label">Nazwa</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Rynek, tablica przy fontannie"
            maxLength={200}
            autoFocus={!point}
            required
          />
        </label>

        <label className="field">
          <span className="label">Treść wyświetlana po skanie</span>
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Dowolny tekst…"
            rows={8}
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
        <p className="panel-hint">
          {point ? 'Przeciągnij marker na mapie, aby zmienić położenie.' : 'Kliknij na mapie albo przeciągnij marker.'}
        </p>

        <div className="panel-info">
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
              <div className="panel-info-label">Najbliższy punkt</div>
              {nearest ? (
                <button
                  type="button"
                  className="panel-info-link"
                  onClick={() => onSelectPoint?.(nearest.point)}
                  disabled={!onSelectPoint}
                >
                  {nearest.point.name}
                  <span className="panel-info-muted tabular"> · {formatDistance(nearest.distance)}</span>
                </button>
              ) : (
                <div className="panel-info-muted">Brak innych punktów</div>
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

        <div className="panel-actions">
          <button className="btn btn-primary" disabled={save.isPending || !name.trim()}>
            {save.isPending ? 'Zapisywanie…' : point ? 'Zapisz' : 'Dodaj punkt'}
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
              <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirmDelete(true)} aria-label="Usuń punkt">
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            ))}
        </div>
      </form>
    </aside>
  );
}
