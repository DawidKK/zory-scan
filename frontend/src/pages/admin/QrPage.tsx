import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Shuffle } from 'lucide-react';
import { useNetwork } from '../../lib/queries';
import { compareNumbers, pointTitle } from '../../lib/network';
import { qrPayload } from '../../lib/qr';
import { useToast } from '../../components/Toast';

export function QrPage() {
  const { idx, points: rawPoints, isLoading } = useNetwork();
  const points = [...rawPoints].sort(
    (a, b) => pointTitle(a, idx).localeCompare(pointTitle(b, idx), 'pl', { numeric: true }) || compareNumbers(a.number, b.number),
  );
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string>(params.get('p') ?? '');

  // Domyślnie pierwszy punkt na liście
  useEffect(() => {
    if (points.length && !points.some((p) => p.id === selectedId)) setSelectedId(points[0].id);
  }, [points, selectedId]);

  function select(id: string) {
    setSelectedId(id);
    setParams(id ? { p: id } : {}, { replace: true });
  }

  function random() {
    const pool = points.length > 1 ? points.filter((p) => p.id !== selectedId) : points;
    if (pool.length) select(pool[Math.floor(Math.random() * pool.length)].id);
  }

  const point = points.find((p) => p.id === selectedId);
  const payload = point ? qrPayload(point.id) : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      toast('Skopiowano link');
    } catch {
      toast('Nie udało się skopiować', 'red');
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="topbar-title">QR Code</h1>
        <span className="badge badge-orange">Test</span>
      </header>

      {!isLoading && points.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Brak słupów</p>
          <p>
            Najpierw dodaj słup na <Link to="/admin">mapie</Link>.
          </p>
        </div>
      ) : (
        <div className="qr-page">
          <div className="qr-controls">
            <label className="field qr-select">
              <span className="label">Słup</span>
              <select className="select" value={selectedId} onChange={(e) => select(e.target.value)}>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pointTitle(p, idx)}
                    {p.name && pointTitle(p, idx) !== p.name ? ` · ${p.name}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary" onClick={random} disabled={points.length === 0}>
              <Shuffle size={14} strokeWidth={1.75} />
              Losowy
            </button>
          </div>

          {point && (
            <div className="qr-card">
              <div className="qr-code">
                <QRCodeSVG value={payload} size={280} level="M" marginSize={0} />
              </div>
              <div className="qr-info">
                <h2 className="qr-name tabular">{pointTitle(point, idx)}</h2>
                {point.name && pointTitle(point, idx) !== point.name && <p className="qr-payload">{point.name}</p>}
                <p className="qr-payload">{payload}</p>
                <button className="btn btn-ghost btn-sm" onClick={copy}>
                  <Copy size={14} strokeWidth={1.75} />
                  Kopiuj link
                </button>
              </div>
              <p className="qr-help">
                Zeskanuj ten kod skanerem w aplikacji albo aparatem telefonu. Link otworzy skaner i pokaże dane słupa.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
