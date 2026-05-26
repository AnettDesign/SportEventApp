'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '../components/app-header';
import { useToast } from '../components/toast-provider';
import { getCurrentRole, roleHome } from '../lib/session';

export default function LoginPage() {
  const [email, setEmail] = useState('u1@test.com');
  const [password, setPassword] = useState('123456');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const role = getCurrentRole();
    if (role) {
      window.location.replace(roleHome(role));
    }
  }, []);

  async function onLogin() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Login failed';
        setErr(message);
        showToast({ kind: 'error', title: 'Вхід не виконано', message });
        return;
      }

      showToast({ kind: 'success', title: 'Успішний вхід', message: 'Перенаправляю на домашню сторінку ролі.' });
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      const role = data?.user?.role;
      const target = next || roleHome(role);
      window.location.href = target;
    } catch (e: any) {
      const message = e?.message ?? 'Login failed';
      setErr(message);
      showToast({ kind: 'error', title: 'Помилка авторизації', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <AppHeader title="Вхід до системи" subtitle="Авторизація та рольовий доступ" />
      <main style={{ maxWidth: 520, margin: '48px auto 0' }}>
        <div className="card"><div className="card-body">
          <div className="badge info" style={{ display: 'inline-flex' }}>Secure session</div>
          <h1 style={{ marginTop: 14, fontSize: '2rem' }}>Увійдіть у Sport Events App</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Після входу система перенаправить вас на відповідну панель залежно від ролі:
            користувач — до каталогу подій, організатор — до власних заходів, адміністратор — до аналітики.
          </p>

          <div className="notice" style={{ marginTop: 16 }}>
            Тестові входи: <strong>u1@test.com</strong>, <strong>organizer@test.com</strong>, <strong>admin@test.com</strong> / пароль <strong>123456</strong>
          </div>

          {err && <div className="error-box">{err}</div>}

          <div className="grid" style={{ marginTop: 18 }}>
            <label><div className="muted" style={{ marginBottom: 6 }}>Email</div><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={loading} /></label>
            <label><div className="muted" style={{ marginBottom: 6 }}>Пароль</div><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" disabled={loading} /></label>
            <button className="primary-btn" onClick={onLogin} disabled={loading}>{loading ? 'Вхід...' : 'Увійти'}</button>
            <a className="secondary-btn" href="/events">← До подій</a>
          </div>
        </div></div>
      </main>
    </div>
  );
}
