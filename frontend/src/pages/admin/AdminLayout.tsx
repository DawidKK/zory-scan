import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, LogOut, Map as MapIcon, MapPin, Moon, QrCode, ScanLine, Sun } from 'lucide-react';
import { clearToken } from '../../lib/auth';
import { usePoints, useScans } from '../../lib/queries';
import { useTheme } from '../../lib/theme';
import { LogoMark } from '../../components/Logo';

const ICON = { size: 16, strokeWidth: 1.75 };

export function AdminLayout() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const points = usePoints();
  const scans = useScans();

  function logout() {
    clearToken('admin');
    navigate('/admin/login', { replace: true });
  }

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'nav-item-active' : ''}`;

  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="sidebar-head">
          <LogoMark size={20} />
          <span className="sidebar-title">Zory Scan</span>
        </div>

        <div className="sidebar-section">Panel</div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end className={navClass}>
            <MapIcon {...ICON} />
            <span>Mapa</span>
          </NavLink>
          <NavLink to="/admin/scans" className={navClass}>
            <Activity {...ICON} />
            <span>Skany</span>
            {scans.data && <span className="nav-count tabular">{scans.data.length}</span>}
          </NavLink>
          <NavLink to="/admin/points" className={navClass}>
            <MapPin {...ICON} />
            <span>Punkty</span>
            {points.data && <span className="nav-count tabular">{points.data.length}</span>}
          </NavLink>
          <NavLink to="/admin/qr" className={navClass}>
            <QrCode {...ICON} />
            <span>QR Code</span>
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <a className="nav-item" href="/scan" target="_blank" rel="noreferrer">
            <ScanLine {...ICON} />
            <span>Otwórz skaner</span>
          </a>
          <button className="nav-item" onClick={toggle}>
            {theme === 'dark' ? <Sun {...ICON} /> : <Moon {...ICON} />}
            <span>{theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}</span>
          </button>
          <button className="nav-item" onClick={logout}>
            <LogOut {...ICON} />
            <span>Wyloguj</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
