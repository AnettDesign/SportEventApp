'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NotificationDTO } from '@shared/contracts';
import { AppHeader } from '../components/app-header';
import { useToast } from '../components/toast-provider';

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/proxy/notifications/my');
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError((data as any)?.message ?? 'Не вдалося завантажити сповіщення');
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити сповіщення');
    } finally { setLoading(false); }
  }

  async function markAllRead() {
    const res = await fetch('/api/proxy/notifications/read-all', { method: 'POST' });
    if (res.ok) {
      showToast({ kind: 'success', title: 'Сповіщення позначено', message: 'Усі сповіщення відмічено як прочитані.' });
      await load();
    }
  }

  useEffect(() => { void load(); }, []);

  const unread = useMemo(() => items.filter((x) => !x.readAt).length, [items]);

  return (
    <div className="page-shell">
      <AppHeader title="Сповіщення" subtitle="Оновлення щодо заявок, подій і відмітка присутності" />
      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <h1 style={{ fontSize: '2.1rem' }}>Журнал змін, який бачить користувач</h1>
          <p>Тут зібрано всі ключові системні повідомлення: подання заявки, підтвердження або відхилення участі, перехід із листа очікування, скасування події та відмітка присутності.</p>
          <div className="badges">
            <span className="badge info">Усього: {items.length}</span>
            <span className="badge warning">Непрочитаних: {unread}</span>
          </div>
          <div className="inline-actions"><button className="secondary-btn" onClick={markAllRead}>Позначити всі як прочитані</button></div>
        </section>
        {error ? <div className="error-box">{error}</div> : null}
        <section style={{ marginTop: 24 }}>
          <div className="grid grid-2">
            {loading ? <div className="notice">Завантаження...</div> : items.length === 0 ? <div className="notice">Сповіщень поки немає.</div> : items.map((n) => (
              <div key={n.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{n.title}</div>
                  <span className={`badge ${n.readAt ? 'success' : 'warning'}`}>{n.readAt ? 'Прочитано' : 'Нове'}</span>
                </div>
                <p style={{ marginTop: 12 }}>{n.message}</p>
                <div className="badges">
                  <span className="badge">{new Date(n.createdAt).toLocaleString()}</span>
                  {n.eventId ? <a className="badge info" href={`/events/${n.eventId}`}>Відкрити подію</a> : null}
                </div>
              </div></div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
