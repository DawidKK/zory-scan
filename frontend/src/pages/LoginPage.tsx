import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getScannerToken, getToken } from '../lib/auth';
import type { Role } from '../lib/types';
import { LogoMark } from '../components/Logo';

const copy: Record<Role, { title: string; subtitle: string; home: string }> = {
  scanner: { title: 'Skaner', subtitle: 'Zaloguj się, aby skanować kody QR.', home: '/scan' },
  admin: { title: 'Panel administratora', subtitle: 'Zaloguj się do dashboardu.', home: '/admin' },
};

export function LoginPage({ role }: { role: Role }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || copy[role].home;
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const alreadyIn = role === 'admin' ? getToken('admin') : getScannerToken();
  if (alreadyIn) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(role, login.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-form" onSubmit={submit}>
        <div className="login-head">
          <LogoMark size={32} />
          <h1 className="login-title">{copy[role].title}</h1>
          <p className="login-subtitle">{copy[role].subtitle}</p>
        </div>
        <label className="field">
          <span className="label">Login</span>
          <input
            className="input"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="label">Hasło</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block login-submit" disabled={busy}>
          {busy ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  );
}
