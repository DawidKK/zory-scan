import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getScannerToken, getToken } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { ScannerPage } from './pages/scanner/ScannerPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { MapPage } from './pages/admin/MapPage';
import { ScansPage } from './pages/admin/ScansPage';
import { PointsPage } from './pages/admin/PointsPage';
import { QrPage } from './pages/admin/QrPage';

/** Przerysowuje drzewo, gdy API zwróci 401 (token wyczyszczony). */
function useAuthRefresh() {
  const [, setN] = useState(0);
  useEffect(() => {
    const onUnauthorized = () => setN((n) => n + 1);
    window.addEventListener('zs:unauthorized', onUnauthorized);
    return () => window.removeEventListener('zs:unauthorized', onUnauthorized);
  }, []);
}

function RequireScanner({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getScannerToken()) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getToken('admin')) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  return children;
}

export function App() {
  useAuthRefresh();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage role="scanner" />} />
      <Route path="/admin/login" element={<LoginPage role="admin" />} />
      <Route
        path="/scan"
        element={
          <RequireScanner>
            <ScannerPage />
          </RequireScanner>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<MapPage />} />
        <Route path="scans" element={<ScansPage />} />
        <Route path="points" element={<PointsPage />} />
        <Route path="qr" element={<QrPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/scan" replace />} />
    </Routes>
  );
}
