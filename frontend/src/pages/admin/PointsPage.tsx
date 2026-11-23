import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { usePoints } from '../../lib/queries';
import { fullDate, isFresh, timeAgo } from '../../lib/format';
import { PointPanel, type Coords } from '../../components/PointPanel';

export function PointsPage() {
  const { data: points = [], isLoading, error } = usePoints();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: string; coords: Coords } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? points.filter((p) => [p.name, p.content, p.address ?? ''].some((t) => t.toLowerCase().includes(q))) : points;
  }, [points, query]);

  const selectedPoint = selected ? points.find((p) => p.id === selected.id) ?? null : null;
  const close = useCallback(() => setSelected(null), []);
  const setCoords = useCallback((coords: Coords) => setSelected((s) => (s ? { ...s, coords } : s)), []);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="topbar-title">Punkty</h1>
        <span className="topbar-meta tabular">{points.length}</span>
        <span className="spacer" />
        <label className="search">
          <Search size={14} strokeWidth={1.75} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj…" />
        </label>
        <Link className="btn btn-secondary btn-sm" to="/admin">
          <Plus size={14} strokeWidth={1.75} />
          Dodaj na mapie
        </Link>
      </header>

      <div className="list">
        {isLoading && <div className="empty">Wczytywanie…</div>}
        {error && <div className="empty form-error">{error.message}</div>}
        {!isLoading && !error && points.length === 0 && (
          <div className="empty">
            <p className="empty-title">Brak punktów</p>
            <p>
              Dodaj pierwszy punkt, klikając na <Link to="/admin">mapie</Link>.
            </p>
          </div>
        )}

        {filtered.map((p) => (
          <button
            key={p.id}
            className={`row ${selected?.id === p.id ? 'row-active' : ''}`}
            onClick={() => setSelected({ id: p.id, coords: { lat: p.lat, lng: p.lng } })}
          >
            <span className={`dot ${isFresh(p.lastScanAt) ? 'dot-teal' : 'dot-orange'}`} />
            <span className="row-title">{p.name}</span>
            <span className="row-meta row-content">{p.address ?? p.content.split('\n')[0]}</span>
            <span className="spacer" />
            <span className="badge badge-orange tabular" title="Liczba skanów">
              {p.scanCount}
            </span>
            <span className="row-time row-hide-sm tabular" title={`Ostatni skan: ${fullDate(p.lastScanAt)}`}>
              {timeAgo(p.lastScanAt)}
            </span>
          </button>
        ))}
      </div>

      {selected && selectedPoint && (
        <PointPanel
          key={selected.id}
          point={selectedPoint}
          coords={selected.coords}
          onCoordsChange={setCoords}
          onClose={close}
          onSelectPoint={(p) => setSelected({ id: p.id, coords: { lat: p.lat, lng: p.lng } })}
        />
      )}
    </div>
  );
}
