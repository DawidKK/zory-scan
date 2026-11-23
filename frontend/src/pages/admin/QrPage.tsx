import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Shuffle } from 'lucide-react';
import { usePoints } from '../../lib/queries';
import { qrPayload } from '../../lib/qr';
import { useToast } from '../../components/Toast';

export function QrPage() {
  const { data: points = [], isLoading } = usePoints();
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
          <p className="empty-title">Brak punktów</p>
          <p>
            Najpierw dodaj punkt na <Link to="/admin">mapie</Link>.
          </p>
        </div>
      ) : (
        <div className="qr-page">
          <div className="qr-controls">
            <label className="field qr-select">
              <span className="label">Punkt</span>
              <select className="select" value={selectedId} onChange={(e) => select(e.target.value)}>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
                <h2 className="qr-name">{point.name}</h2>
                <p className="qr-payload">{payload}</p>
                <button className="btn btn-ghost btn-sm" onClick={copy}>
                  <Copy size={14} strokeWidth={1.75} />
                  Kopiuj link
                </button>
              </div>
              <p className="qr-help">
                Zeskanuj ten kod skanerem w aplikacji albo aparatem telefonu. Link otworzy skaner i pokaże treść punktu.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
