'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppHeader } from '../../../../components/app-header';
import { useToast } from '../../../../components/toast-provider';
import { bookingStatusLabel } from '../../../../lib/session';

type ParticipantDTO = {
  id: string;
  createdAt: string;
  status: string;
  checkedInAt?: string | null;
  rejectReason?: string | null;
  user: { id: string; name: string; email: string; role: string };
  event?: { id: string; title: string; available: number; capacity: number };
};

type WaitlistDTO = {
  id: string;
  createdAt: string;
  position: number;
  user: { id: string; name: string; email: string };
};

type ActivityItem = {
  id: string;
  createdAt: string;
  type: string;
  message: string;
  details?: string | null;
  actor?: { id: string; name: string; email: string; role: string } | null;
};

type VoteSummaryItem = {
  type: string;
  value: string;
  count: number;
  users: string[];
  comments: string[];
};

function voteTypeLabel(type: string) {
  switch (type) {
    case 'DATE': return 'Додаткова дата';
    case 'LOCATION': return 'Інша локація';
    case 'TIME': return 'Інший час';
    default: return type;
  }
}

export default function ParticipantsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [items, setItems] = useState<ParticipantDTO[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistDTO[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [voteSummary, setVoteSummary] = useState<VoteSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const stats = useMemo(() => ({
    pending: items.filter((x) => x.status === 'PENDING').length,
    confirmed: items.filter((x) => x.status === 'CONFIRMED').length,
    attended: items.filter((x) => x.status === 'ATTENDED').length,
    canceled: items.filter((x) => x.status === 'CANCELED').length,
  }), [items]);

  const eventTitle = items[0]?.event?.title ?? 'Подія';
  const occupied = stats.confirmed + stats.attended;
  const seatsInfo = items[0]?.event ? `${occupied}/${items[0].event.capacity}` : '—';
  const freeSeats = items[0]?.event ? Math.max(0, items[0].event.capacity - occupied) : 0;

  function exportCsv() { window.open(`/api/proxy/events/${id}/export`, '_blank'); }

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [bookingsRes, waitlistRes, activityRes, votesRes] = await Promise.all([
        fetch(`/api/proxy/events/${id}/bookings`),
        fetch(`/api/proxy/events/${id}/waitlist`),
        fetch(`/api/proxy/events/${id}/activity`),
        fetch(`/api/proxy/user-features/events/${id}/votes/summary`),
      ]);
      const bookingsData = await bookingsRes.json().catch(() => []);
      const waitlistData = await waitlistRes.json().catch(() => []);
      const activityData = await activityRes.json().catch(() => []);
      const votesData = await votesRes.json().catch(() => []);
      setItems(Array.isArray(bookingsData) ? bookingsData : []);
      setWaitlist(Array.isArray(waitlistData) ? waitlistData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);
      setVoteSummary(Array.isArray(votesData) ? votesData : []);
      if (!bookingsRes.ok) setError((bookingsData as any)?.message ?? 'Не вдалося завантажити учасників');
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити учасників');
    } finally { setLoading(false); }
  }

  async function mutateBooking(bookingId: string, action: 'approve' | 'reject') {
    setBusyId(bookingId);
    setError(null);
    setMessage(null);
    try {
      const body = action === 'reject' ? { reason: rejectReason[bookingId] || undefined } : undefined;
      const res = await fetch(`/api/proxy/bookings/${bookingId}/${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message ?? 'Операцію не виконано';
        setError(msg);
        showToast({ kind: 'error', title: 'Дію не виконано', message: msg });
        return;
      }
      const successMessage = action === 'approve' ? 'Заявку підтверджено.' : 'Заявку відхилено.';
      setMessage(successMessage);
      showToast({ kind: 'success', title: action === 'approve' ? 'Заявку підтверджено' : 'Заявку відхилено', message: successMessage });
      await load();
    } catch (e: any) {
      const msg = e?.message ?? 'Операцію не виконано';
      setError(msg);
      showToast({ kind: 'error', title: 'Помилка', message: msg });
    } finally { setBusyId(null); }
  }

  async function checkIn(bookingId: string) {
    setBusyId(bookingId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/proxy/events/${id}/bookings/${bookingId}/check-in`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message ?? 'Не вдалося зафіксувати присутність';
        setError(msg);
        showToast({ kind: 'error', title: 'Присутність не зафіксовано', message: msg });
        return;
      }
      setMessage('Учасника відмічено як присутнього.');
      showToast({ kind: 'success', title: 'Присутність зафіксовано', message: 'Статус учасника змінено на «Відвідано».' });
      await load();
    } catch (e: any) {
      const msg = e?.message ?? 'Не вдалося зафіксувати присутність';
      setError(msg);
      showToast({ kind: 'error', title: 'Помилка', message: msg });
    } finally { setBusyId(null); }
  }

  useEffect(() => { void load(); }, [id]);

  return (
    <div className="page-shell">
      <AppHeader title="Учасники події" subtitle="Модерація заявок, причини відхилення та журнал дій" />
      <main className="page-shell">
        {error ? <div className="error-box">{error}</div> : null}
        {message ? <div className="success-box">{message}</div> : null}
        <section className="hero" style={{ padding: 24 }}>
          <h1 style={{ fontSize: '2.1rem' }}>{eventTitle}: заявки, учасники та лист очікування</h1>
          <p>Організатор або адміністратор керує вже поданими заявками інших користувачів: підтверджує участь, відхиляє її з причиною, фіксує присутність та переглядає журнал подій.</p>
          <div className="badges">
            <span className="badge success">Зайнято місць: {seatsInfo}</span>
            <span className="badge info">Вільні місця: {freeSeats}</span>
            <span className="badge warning">Очікують: {stats.pending}</span>
            <span className="badge success">Підтверджено: {stats.confirmed}</span>
            <span className="badge">Відвідали: {stats.attended}</span>
            <span className="badge">Черга: {waitlist.length}</span>
          </div>
          <div className="inline-actions"><button className="secondary-btn" onClick={load}>Оновити</button><button className="primary-btn" onClick={exportCsv}>Експорт CSV</button></div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Заявки та підтверджені учасники</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Ім’я</th><th>Email</th><th>Роль</th><th>Статус</th><th>Дата заявки</th><th>Причина/коментар</th><th>Дії</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="muted">Завантаження...</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="muted">Поки що немає заявок</td></tr> : items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.user.name}</td>
                    <td>{b.user.email}</td>
                    <td>{b.user.role}</td>
                    <td><span className={`badge ${b.status === 'ATTENDED' ? 'success' : b.status === 'CANCELED' ? 'danger' : b.status === 'PENDING' ? 'warning' : 'info'}`}>{bookingStatusLabel(b.status)}</span></td>
                    <td>{new Date(b.createdAt).toLocaleString()}</td>
                    <td style={{ minWidth: 220 }}>
                      {b.status === 'CANCELED' && b.rejectReason ? <div className="notice">{b.rejectReason}</div> : (
                        <textarea rows={2} placeholder="Причина відхилення або внутрішній коментар" value={rejectReason[b.id] ?? ''} onChange={(e) => setRejectReason((prev) => ({ ...prev, [b.id]: e.target.value }))} />
                      )}
                    </td>
                    <td>
                      <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                        <button className="primary-btn" onClick={() => mutateBooking(b.id, 'approve')} disabled={busyId !== null || b.status !== 'PENDING'}>{busyId === b.id ? '...' : 'Підтвердити'}</button>
                        <button className="danger-btn" onClick={() => mutateBooking(b.id, 'reject')} disabled={busyId !== null || b.status === 'ATTENDED' || b.status === 'CANCELED'}>{busyId === b.id ? '...' : 'Відхилити'}</button>
                        <button className="secondary-btn" onClick={() => checkIn(b.id)} disabled={busyId !== null || b.status !== 'CONFIRMED'}>{b.status === 'ATTENDED' ? '✓ Відмічено' : 'Відмітити присутність'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Лист очікування</h2>
          <div className="grid grid-2">
            {waitlist.length === 0 ? <div className="notice">Черга порожня</div> : waitlist.map((x) => (
              <div key={x.id} className="card"><div className="card-body">
                <div style={{ fontWeight: 700, fontSize: 18 }}>{x.user.name}</div>
                <div className="muted" style={{ marginTop: 6 }}>{x.user.email}</div>
                <div className="badges"><span className="badge warning">Позиція #{x.position}</span><span className="badge">{new Date(x.createdAt).toLocaleString()}</span></div>
              </div></div>
            ))}
          </div>
        </section>


        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Попит на додаткові варіанти події</h2>
          <p className="muted" style={{ marginTop: -4 }}>Тут організатор бачить голоси учасників за додаткову дату, локацію або час. Цей блок можна використати як доказ роботи механізму колективного формування попиту.</p>
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            {voteSummary.length === 0 ? <div className="notice">Користувачі ще не голосували за додаткові варіанти цієї події.</div> : voteSummary.map((item) => (
              <div key={`${item.type}-${item.value}`} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{voteTypeLabel(item.type)}: {item.value}</div>
                  <span className="badge success">Голосів: {item.count}</span>
                </div>
                {item.users.length ? <div className="muted" style={{ marginTop: 8 }}>Користувачі: {item.users.join(', ')}</div> : null}
                {item.comments.length ? <div className="notice">{item.comments.slice(0, 3).join(' • ')}</div> : null}
              </div></div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Журнал дій по події</h2>
          <div className="grid grid-2">
            {activity.length === 0 ? <div className="notice">Записів журналу поки немає.</div> : activity.map((item) => (
              <div key={item.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{item.message}</div>
                  <span className="badge">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {item.actor ? <div className="muted" style={{ marginTop: 8 }}>Ініціатор: {item.actor.name} • {item.actor.role}</div> : null}
                {item.details ? <div className="notice" style={{ marginTop: 12 }}>{item.details}</div> : null}
              </div></div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
