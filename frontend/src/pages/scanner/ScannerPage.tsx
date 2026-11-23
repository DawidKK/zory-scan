import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { LogOut, MapPin, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { clearToken } from '../../lib/auth';
import { parsePointId } from '../../lib/qr';
import type { ScanResult } from '../../lib/types';
import { LogoMark } from '../../components/Logo';

type State =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'result'; result: ScanResult }
  | { kind: 'error'; message: string }
  | { kind: 'camera-error'; message: string };

export function ScannerPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const coordsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const [state, setState] = useState<State>({ kind: 'scanning' });

  // Lokalizacja telefonu (opcjonalna) — dołączana do skanu, jeśli użytkownik pozwoli.
  const refreshLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => (coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 },
    );
  }, []);

  const handlePointId = useCallback(async (pointId: string | null) => {
    if (busyRef.current) return;
    busyRef.current = true;
    scannerRef.current?.pause();

    if (!pointId) {
      setState({ kind: 'error', message: 'To nie jest kod z tej aplikacji.' });
      return;
    }

    setState({ kind: 'loading' });
    try {
      const result = await api.scan(pointId, coordsRef.current);
      navigator.vibrate?.(40);
      setState({ kind: 'result', result });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Coś poszło nie tak' });
    }
  }, []);

  // Kamera
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const scanner = new QrScanner(video, (res) => handlePointId(parsePointId(res.data)), {
      preferredCamera: 'environment',
      maxScansPerSecond: 8,
      returnDetailedScanResult: true,
    });
    scannerRef.current = scanner;

    // Wejście z linku /scan?p=<id> (np. QR zeskanowany aparatem systemowym)
    const linkId = params.get('p');
    if (linkId) {
      setParams({}, { replace: true });
      void handlePointId(parsePointId(linkId));
    } else {
      scanner.start().catch((err: unknown) => {
        const message =
          typeof err === 'string' && /not found/i.test(err)
            ? 'Nie znaleziono kamery w tym urządzeniu.'
            : 'Brak dostępu do kamery. Zezwól na użycie aparatu w ustawieniach przeglądarki.';
        setState({ kind: 'camera-error', message });
      });
    }

    refreshLocation();
    return () => {
      scanner.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scanAgain() {
    busyRef.current = false;
    setState({ kind: 'scanning' });
    refreshLocation();
    scannerRef.current?.start().catch(() =>
      setState({ kind: 'camera-error', message: 'Brak dostępu do kamery.' }),
    );
  }

  function logout() {
    clearToken('scanner');
    navigate('/login', { replace: true });
  }

  const sheetOpen = state.kind !== 'scanning';

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" muted playsInline />

      <header className="scanner-top">
        <div className="scanner-brand">
          <LogoMark size={20} />
          <span>Zory Scan</span>
        </div>
        <button className="scanner-icon-btn" onClick={logout} aria-label="Wyloguj">
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </header>

      {!sheetOpen && (
        <>
          <div className="viewfinder" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="scanner-hint">Skieruj aparat na kod QR</p>
        </>
      )}

      <div className={`sheet ${sheetOpen ? 'sheet-open' : ''}`} role="dialog" aria-live="polite">
        {state.kind === 'loading' && <p className="sheet-muted">Wczytywanie…</p>}

        {state.kind === 'result' && (
          <>
            <span className="badge badge-teal">
              <span className="dot dot-teal" />
              Zeskanowano
            </span>
            <h1 className="sheet-title">{state.result.name}</h1>
            {state.result.address && (
              <p className="sheet-address">
                <MapPin size={14} strokeWidth={1.75} />
                {state.result.address}
              </p>
            )}
            <div className="sheet-content">{state.result.content || 'Brak treści dla tego punktu.'}</div>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <span className="badge badge-red">
              <span className="dot dot-red" />
              Błąd
            </span>
            <h1 className="sheet-title">Nie udało się odczytać</h1>
            <p className="sheet-content">{state.message}</p>
          </>
        )}

        {state.kind === 'camera-error' && (
          <>
            <span className="badge badge-orange">
              <span className="dot dot-orange" />
              Kamera
            </span>
            <h1 className="sheet-title">Kamera niedostępna</h1>
            <p className="sheet-content">{state.message}</p>
          </>
        )}

        {state.kind !== 'loading' && (
          <button className="btn btn-primary btn-lg btn-block" onClick={scanAgain}>
            <RotateCcw size={16} strokeWidth={1.75} />
            {state.kind === 'camera-error' ? 'Spróbuj ponownie' : 'Skanuj ponownie'}
          </button>
        )}
      </div>
    </div>
  );
}
