'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EventDTO } from '@shared/contracts';
import { AppHeader } from '../../components/app-header';
import { useToast } from '../../components/toast-provider';
import { eventShortDescription, eventStatusLabel, formatLabel, levelLabel, seatSummary } from '../../lib/session';

type EditState = {
  id: string;
  title: string;
  description: string;
  sportType: string;
  location: string;
  startAt: string;
  capacity: number;
};

type EventRequestDTO = {
  id: string;
  createdAt: string;
  sportType: string;
  level: string;
  format: string;
  location: string;
  preferredDate?: string | null;
  comment?: string | null;
  status: string;
  user?: { id: string; name: string; email: string };
};

type DemandSummaryEntry = {
  event: { id: string; title: string };
  items: Array<{ type: string; value: string; count: number; users: string[]; comments: string[] }>;
};

function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function requestStatusLabel(status: string) {
  switch (status) {
    case 'OPEN': return 'Новий запит';
    case 'PLANNED': return 'Взято в план';
    case 'CLOSED': return 'Закрито';
    default: return status;
  }
}

function voteTypeLabel(type: string) {
  switch (type) {
    case 'DATE': return 'Додаткова дата';
    case 'LOCATION': return 'Інша локація';
    case 'TIME': return 'Інший час';
    default: return type;
  }
}

export default function OrganizerEventsPage() {
  const [items, setItems] = useState<EventDTO[]>([]);
  const [eventRequests, setEventRequests] = useState<EventRequestDTO[]>([]);
  const [demandSummary, setDemandSummary] = useState<DemandSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const { showToast } = useToast();

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [eventsRes, requestsRes, demandRes] = await Promise.all([
        fetch('/api/proxy/events/my'),
        fetch('/api/proxy/user-features/event-requests'),
        fetch('/api/proxy/user-features/organizer/demand-summary'),
      ]);
      const eventsData = await eventsRes.json().catch(() => null);
      const requestsData = await requestsRes.json().catch(() => []);
      const demandData = await demandRes.json().catch(() => []);
      if (!eventsRes.ok) {
        setError(eventsData?.message ?? 'Не вдалося завантажити події організатора');
        setItems([]);
        return;
      }
      setItems(Array.isArray(eventsData) ? eventsData : []);
      setEventRequests(Array.isArray(requestsData) ? requestsData : []);
      setDemandSummary(Array.isArray(demandData) ? demandData : []);
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити події організатора');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((e) => e.status === 'PUBLISHED').length,
    seats: items.reduce((sum, e) => sum + e.capacity, 0),
    free: items.reduce((sum, e) => sum + (e.freeSeats ?? e.available), 0),
    pending: items.reduce((sum, e) => sum + (e.pendingCount ?? 0), 0),
    openRequests: eventRequests.filter((r) => r.status === 'OPEN').length,
  }), [items, eventRequests]);

  function startEdit(e: EventDTO) {
    setEdit({ id: e.id, title: e.title, description: e.description ?? '', sportType: e.sportType, location: e.location, startAt: toDateTimeLocal(e.startAt), capacity: e.capacity });
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(edit.id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/events/${edit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: edit.title, description: edit.description, sportType: edit.sportType, location: edit.location, startAt: new Date(edit.startAt).toISOString(), capacity: Number(edit.capacity) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося оновити подію';
        setError(message);
        showToast({ kind: 'error', title: 'Подію не оновлено', message });
        return;
      }
      setEdit(null);
      showToast({ kind: 'success', title: 'Подію оновлено', message: 'Зміни збережено в каталозі організатора.' });
      await load();
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося оновити подію';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally { setBusy(null); }
  }

  async function cancelEvent(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/events/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося скасувати подію';
        setError(message);
        showToast({ kind: 'error', title: 'Подію не скасовано', message });
        return;
      }
      showToast({ kind: 'success', title: 'Подію скасовано', message: 'Подія більше недоступна для нових заявок.' });
      await load();
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося скасувати подію';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally { setBusy(null); }
  }

  async function updateRequestStatus(id: string, status: 'PLANNED' | 'CLOSED' | 'OPEN') {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/user-features/event-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося оновити статус запиту';
        setError(message);
        showToast({ kind: 'error', title: 'Запит не оновлено', message });
        return;
      }
      showToast({ kind: 'success', title: 'Статус запиту оновлено', message: `Новий статус: ${requestStatusLabel(status)}.` });
      await load();
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося оновити статус запиту';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally { setBusy(null); }
  }

  return (
    <div className="page-shell">
      <AppHeader title="Панель організатора" subtitle="Керування подіями, заявками та попитом користувачів" />
      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <h1 style={{ fontSize: '2.2rem' }}>Контроль життєвого циклу спортивних заходів</h1>
          <p>Тут зібрано всі події організатора з коротким описом, статистикою місць, очікувань, запитами користувачів на нові події та голосами за додаткові варіанти проведення.</p>
          <div className="kpi-row organizer-kpis">
            <div className="kpi"><div className="muted">Усього подій</div><div className="value">{stats.total}</div></div>
            <div className="kpi"><div className="muted">Активні</div><div className="value">{stats.active}</div></div>
            <div className="kpi"><div className="muted">Вільні місця</div><div className="value">{stats.free}</div></div>
            <div className="kpi"><div className="muted">Очікують</div><div className="value">{stats.pending}</div></div>
            <div className="kpi"><div className="muted">Нові запити</div><div className="value">{stats.openRequests}</div></div>
          </div>
        </section>
        {error ? <div className="error-box">{error}</div> : null}

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Події організатора</h2>
          <div className="grid grid-2">
            {loading ? <div className="notice">Завантаження...</div> : items.map((e) => {
              const seats = seatSummary(e);
              return (
                <div key={e.id} className="card"><div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{e.title}</div>
                      <div className="muted" style={{ marginTop: 6 }}>{e.sportType} • {levelLabel(e.level)} • {formatLabel(e.format)}</div>
                    </div>
                    <span className={`badge ${e.status === 'CANCELED' ? 'danger' : 'success'}`}>{eventStatusLabel(e.status)}</span>
                  </div>
                  <div style={{ marginTop: 10 }}>{new Date(e.startAt).toLocaleString()} — {e.location}</div>
                  <p style={{ marginTop: 12 }}>{eventShortDescription(e)}</p>
                  <div className="badges">
                    <span className="badge success">Підтверджено: {seats.confirmed}/{e.capacity}</span>
                    <span className="badge warning">Очікують: {seats.pending}</span>
                    <span className="badge info">Вільно: {seats.free}</span>
                    <span className="badge">Черга: {seats.waitlist}</span>
                    <span className="badge">👁 {e.views ?? 0}</span>
                  </div>
                  <div className="inline-actions">
                    <button className="secondary-btn" onClick={() => startEdit(e)} disabled={busy !== null}>Редагувати</button>
                    <button className="danger-btn" onClick={() => cancelEvent(e.id)} disabled={busy !== null}>{busy === e.id ? '...' : 'Скасувати'}</button>
                    <a className="secondary-btn" href={`/events/${e.id}`}>Деталі</a>
                    <a className="primary-btn" href={`/organizer/events/${e.id}/participants`}>Керувати заявками</a>
                  </div>
                </div></div>
              );
            })}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Запити користувачів на нові події</h2>
          <p className="muted" style={{ marginTop: -4 }}>Цей блок демонструє, як користувачі можуть самостійно формувати попит на нові спортивні події.</p>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            {eventRequests.length === 0 ? <div className="notice">Поки що немає користувацьких запитів.</div> : eventRequests.map((request) => (
              <div key={request.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{request.sportType} у {request.location}</div>
                  <span className={`badge ${request.status === 'PLANNED' ? 'success' : request.status === 'CLOSED' ? 'danger' : 'warning'}`}>{requestStatusLabel(request.status)}</span>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>Автор: {request.user?.name ?? 'Користувач'}{request.user?.email ? ` • ${request.user.email}` : ''}</div>
                <div className="badges"><span className="badge">{levelLabel(request.level)}</span><span className="badge">{formatLabel(request.format)}</span>{request.preferredDate ? <span className="badge info">Бажана дата: {new Date(request.preferredDate).toLocaleDateString()}</span> : null}<span className="badge">Створено: {new Date(request.createdAt).toLocaleDateString()}</span></div>
                {request.comment ? <div className="notice">{request.comment}</div> : null}
                <div className="inline-actions"><button className="primary-btn" onClick={() => updateRequestStatus(request.id, 'PLANNED')} disabled={busy !== null || request.status === 'PLANNED'}>Взяти в план</button><button className="secondary-btn" onClick={() => updateRequestStatus(request.id, 'OPEN')} disabled={busy !== null || request.status === 'OPEN'}>Повернути в нові</button><button className="danger-btn" onClick={() => updateRequestStatus(request.id, 'CLOSED')} disabled={busy !== null || request.status === 'CLOSED'}>Закрити</button></div>
              </div></div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Голоси за додаткову дату, локацію або час</h2>
          <p className="muted" style={{ marginTop: -4 }}>Ці дані формуються з голосів користувачів у кабінеті «Моя участь» і допомагають організатору приймати рішення щодо повторного проведення або зміни параметрів події.</p>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            {demandSummary.length === 0 ? <div className="notice">Поки що немає голосів за додаткові варіанти.</div> : demandSummary.map((entry) => (
              <div key={entry.event.id} className="card"><div className="card-body">
                <a href={`/organizer/events/${entry.event.id}/participants`} style={{ fontWeight: 700, fontSize: 18 }}>{entry.event.title}</a>
                <div className="badges">
                  {entry.items.map((item) => <span key={`${item.type}-${item.value}`} className="badge info">{voteTypeLabel(item.type)}: {item.value} · {item.count}</span>)}
                </div>
                {entry.items[0]?.comments?.length ? <div className="notice">{entry.items[0].comments.slice(0, 2).join(' • ')}</div> : null}
              </div></div>
            ))}
          </div>
        </section>

        {edit ? (
          <section style={{ marginTop: 24 }}>
            <div className="card"><div className="card-body">
              <h2 className="section-title" style={{ marginTop: 0 }}>Редагування події</h2>
              <div className="form-grid">
                <label><div className="muted" style={{ marginBottom: 6 }}>Назва</div><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
                <label><div className="muted" style={{ marginBottom: 6 }}>Вид спорту</div><input value={edit.sportType} onChange={(e) => setEdit({ ...edit, sportType: e.target.value })} /></label>
                <label><div className="muted" style={{ marginBottom: 6 }}>Локація</div><input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></label>
                <label><div className="muted" style={{ marginBottom: 6 }}>Дата і час</div><input type="datetime-local" value={edit.startAt} onChange={(e) => setEdit({ ...edit, startAt: e.target.value })} /></label>
                <label><div className="muted" style={{ marginBottom: 6 }}>Місткість</div><input type="number" min={1} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} /></label>
                <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Опис</div><textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
              </div>
              <div className="inline-actions">
                <button className="primary-btn" onClick={saveEdit} disabled={busy !== null}>{busy === edit.id ? 'Збереження...' : 'Зберегти'}</button>
                <button className="secondary-btn" onClick={() => setEdit(null)} disabled={busy !== null}>Скасувати</button>
              </div>
            </div></div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
