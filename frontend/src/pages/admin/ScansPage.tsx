import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useScans } from '../../lib/queries';
import { deviceLabel, fmtCoord, fullDate, isFresh, timeAgo } from '../../lib/format';

export function ScansPage() {
  const navigate = useNavigate();
  const { data: scans = [], isLoading, error } = useScans();

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="topbar-title">Ostatnie skany</h1>
        <span className="topbar-meta tabular">{scans.length}</span>
        <span className="spacer" />
        <span className="live">
          <span className="dot dot-teal live-dot" />
          Na żywo
        </span>
      </header>

      <div className="list">
        {isLoading && <div className="empty">Wczytywanie…</div>}
        {error && <div className="empty form-error">{error.message}</div>}
        {!isLoading && !error && scans.length === 0 && (
          <div className="empty">
            <p className="empty-title">Brak skanów</p>
            <p>Zeskanuj kod z zakładki QR Code, żeby zobaczyć pierwszy wpis.</p>
          </div>
        )}

        {scans.map((s) => (
          <button key={s.id} className="row" onClick={() => navigate(`/admin?point=${s.pointId}`)}>
            <span className={`dot ${isFresh(s.scannedAt) ? 'dot-teal' : 'dot-muted'}`} />
            <span className="row-title">{s.pointName}</span>
            <span className="row-meta">{deviceLabel(s.userAgent)}</span>
            {s.lat != null && s.lng != null && (
              <span className="row-meta row-hide-sm tabular">
                <MapPin size={12} strokeWidth={1.75} />
                {fmtCoord(s.lat)}, {fmtCoord(s.lng)}
              </span>
            )}
            <span className="spacer" />
            <span className="row-time tabular" title={fullDate(s.scannedAt)}>
              {timeAgo(s.scannedAt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
