'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EventDTO } from '@shared/contracts';
import { AppHeader } from '../components/app-header';
import { eventShortDescription, formatLabel, levelLabel, seatSummary } from '../lib/session';

type AnalyticsOverview = {
  totals: { events: number; bookings: number; occupied: number; pending: number; waitlist: number };
  bySport: Record<string, number>;
  byLocation: Record<string, number>;
  bookingByDay: Record<string, number>;
  usersByRole: Record<string, number>;
  topEvents: EventDTO[];
  activity: Array<{ id: string; createdAt: string; message: string; details?: string | null; actor?: { name: string; role: string } | null; event?: { id: string; title: string } | null }>;
};

function ChartBars({ title, values, suffix = '' }: { title: string; values: Record<string, number>; suffix?: string }) {
  const entries = Object.entries(values);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="card"><div className="card-body">
      <h3 className="section-title" style={{ marginTop: 0 }}>{title}</h3>
      {!entries.length ? <div className="notice">Даних ще недостатньо</div> : entries.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div className="chart-row-head"><div style={{ fontWeight: 600 }}>{label}</div><div className="muted">{value}{suffix}</div></div>
          <div className="metric-bar"><span style={{ width: `${Math.max(8, (value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div></div>
  );
}

export default function AnalyticsPage() {
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, overviewRes] = await Promise.all([fetch('/api/events'), fetch('/api/proxy/analytics')]);
      const data = await eventsRes.json().catch(() => []);
      const overviewData = await overviewRes.json().catch(() => null);
      setEvents(Array.isArray(data) ? data : []);
      setOverview(overviewData && typeof overviewData === 'object' ? overviewData : null);
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити аналітику');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => {
    const totalViews = events.reduce((sum, e) => sum + (e.views ?? 0), 0);
    const totalCapacity = events.reduce((sum, e) => sum + e.capacity, 0);
    const totalConfirmed = events.reduce((sum, e) => sum + ((e.confirmedCount ?? 0) + (e.attendedCount ?? 0)), 0);
    const totalPending = events.reduce((sum, e) => sum + (e.pendingCount ?? 0), 0);
    const totalWaitlist = events.reduce((sum, e) => sum + (e.waitlistCount ?? 0), 0);
    const published = events.filter((e) => e.status === 'PUBLISHED').length;
    const occupancy = totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : 0;
    return { totalViews, totalCapacity, totalConfirmed, totalPending, totalWaitlist, published, occupancy };
  }, [events]);

  const maxViews = useMemo(() => Math.max(...events.map((e) => e.views ?? 0), 1), [events]);
  const topEvents = useMemo(() => [...(overview?.topEvents ?? events)].sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0)).slice(0, 5), [events, overview]);
  const newestEvents = useMemo(() => [...events].sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt)).slice(0, 5), [events]);

  return (
    <div className="page-shell">
      <AppHeader title="Адмін-панель" subtitle="Аналітика каталогу, рольової активності та звітності" />
      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <div className="badge info" style={{ display: 'inline-flex' }}>Administrator dashboard</div>
          <h1 style={{ fontSize: '2.2rem' }}>Операційний огляд стану системи спортивних подій</h1>
          <p>Панель адміністратора показує не лише перегляди, а й реальну участь: заповнюваність подій, активність користувачів, структуру каталогу за видами спорту та журнал останніх дій у системі.</p>
          <div className="hero-actions">
            <a className="primary-btn" href="/organizer/events">До панелі організатора</a>
            <a className="secondary-btn" href="/create-event">Створити нову подію</a>
            <button className="secondary-btn" onClick={load}>Оновити дані</button>
          </div>
        </section>

        {error ? <div className="error-box">{error}</div> : null}

        <div className="kpi-row">
          <div className="kpi"><div className="muted">Подій у каталозі</div><div className="value">{events.length}</div></div>
          <div className="kpi"><div className="muted">Опубліковані</div><div className="value">{totals.published}</div></div>
          <div className="kpi"><div className="muted">Підтверджені місця</div><div className="value">{totals.totalConfirmed}</div></div>
          <div className="kpi"><div className="muted">Очікують</div><div className="value">{totals.totalPending}</div></div>
          <div className="kpi"><div className="muted">Лист очікування</div><div className="value">{totals.totalWaitlist}</div></div>
          <div className="kpi"><div className="muted">Заповнюваність</div><div className="value">{totals.occupancy}%</div></div>
        </div>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Графік інтересу до подій</h2>
          <div className="card"><div className="card-body">
            {loading ? <p className="muted">Завантаження...</p> : (
              <div className="grid">
                {events.map((e) => {
                  const seats = seatSummary(e);
                  const width = `${Math.max(6, ((e.views ?? 0) / maxViews) * 100)}%`;
                  return (
                    <div key={e.id}>
                      <div className="chart-row-head"><div style={{ fontWeight: 600 }}>{e.title}</div><div className="muted">👁 {e.views ?? 0} • підтверджено {seats.confirmed}/{e.capacity} • очікують {seats.pending}</div></div>
                      <div className="metric-bar"><span style={{ width }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div></div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="grid grid-2">
            <ChartBars title="Події за видами спорту" values={overview?.bySport ?? {}} />
            <ChartBars title="Події за локаціями" values={overview?.byLocation ?? {}} />
            <ChartBars title="Заявки за днями" values={overview?.bookingByDay ?? {}} />
            <ChartBars title="Користувачі за ролями" values={overview?.usersByRole ?? {}} />
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Найпопулярніші події</h2>
          <div className="grid grid-2">
            {topEvents.map((e) => {
              const seats = seatSummary(e);
              return (
                <div key={e.id} className="card"><div className="card-body">
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{e.title}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{e.location} • {new Date(e.startAt).toLocaleString()}</div>
                  <p style={{ marginTop: 12 }}>{eventShortDescription(e)}</p>
                  <div className="badges">
                    <span className="badge info">👁 {e.views ?? 0} переглядів</span>
                    <span className="badge success">★ {e.popularityScore ?? 0} популярність</span>
                    <span className="badge">{levelLabel(e.level)}</span>
                    <span className="badge">{formatLabel(e.format)}</span>
                    <span className="badge success">Підтверджено: {seats.confirmed}</span>
                    <span className="badge warning">Очікують: {seats.pending}</span>
                  </div>
                  <div className="inline-actions"><a className="secondary-btn" href={`/events/${e.id}`}>Відкрити</a><a className="secondary-btn" href={`/organizer/events/${e.id}/participants`}>Учасники</a></div>
                </div></div>
              );
            })}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Останні дії в системі</h2>
          <div className="grid grid-2">
            {(overview?.activity ?? []).map((item) => (
              <div key={item.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{item.message}</div>
                  <span className="badge">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {item.actor ? <div className="muted" style={{ marginTop: 8 }}>Ініціатор: {item.actor.name} • {item.actor.role}</div> : null}
                {item.event ? <div className="muted" style={{ marginTop: 8 }}>Подія: <a href={`/events/${item.event.id}`}>{item.event.title}</a></div> : null}
                {item.details ? <div className="notice" style={{ marginTop: 12 }}>{item.details}</div> : null}
              </div></div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Останні події в системі</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Подія</th><th>Дата</th><th>Локація</th><th>Інтерес</th><th>Участь</th></tr></thead>
              <tbody>
                {newestEvents.map((e) => {
                  const seats = seatSummary(e);
                  return (
                    <tr key={e.id}>
                      <td><a href={`/events/${e.id}`}>{e.title}</a></td>
                      <td>{new Date(e.startAt).toLocaleString()}</td>
                      <td>{e.location}</td>
                      <td>👁 {e.views ?? 0} / ★ {e.popularityScore ?? 0}</td>
                      <td>{seats.confirmed}/{e.capacity} • pending {seats.pending}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
