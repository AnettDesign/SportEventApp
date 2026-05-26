'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BookingWithEventDTO, NotificationDTO, WaitlistWithEventDTO } from '@shared/contracts';
import { AppHeader } from '../components/app-header';
import { useToast } from '../components/toast-provider';
import { bookingStatusLabel, formatLabel, levelLabel } from '../lib/session';

type ReviewDraft = { rating: number; comment: string; recommend: boolean };
type VoteDraft = { type: 'DATE' | 'LOCATION' | 'TIME'; value: string; comment: string };

function voteTypeLabel(type: string) {
  switch (type) {
    case 'DATE': return 'додаткова дата';
    case 'LOCATION': return 'інша локація';
    case 'TIME': return 'інший час';
    default: return type;
  }
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithEventDTO[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistWithEventDTO[]>([]);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [voteDrafts, setVoteDrafts] = useState<Record<string, VoteDraft>>({});
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  function defaultReview(eventId: string): ReviewDraft {
    return reviewDrafts[eventId] ?? { rating: 5, comment: '', recommend: true };
  }

  function defaultVote(eventId: string): VoteDraft {
    return voteDrafts[eventId] ?? { type: 'DATE', value: '', comment: '' };
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [bookingsRes, waitlistRes, notificationsRes] = await Promise.all([
        fetch('/api/proxy/bookings/my'),
        fetch('/api/proxy/bookings/my-waitlist'),
        fetch('/api/proxy/notifications/my'),
      ]);
      const bookingsData = bookingsRes.ok ? await bookingsRes.json() : [];
      const waitlistData = waitlistRes.ok ? await waitlistRes.json() : [];
      const notificationsData = notificationsRes.ok ? await notificationsRes.json() : [];
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setWaitlist(Array.isArray(waitlistData) ? waitlistData : []);
      setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
      if (!bookingsRes.ok && bookingsRes.status !== 401) setError('Не вдалося завантажити заявки');
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function cancel(eventId: string) {
    setBusy(eventId);
    setError(null);
    try {
      const res = await fetch('/api/proxy/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося скасувати заявку';
        setError(message);
        showToast({ kind: 'error', title: 'Помилка', message });
        return;
      }
      showToast({ kind: 'success', title: 'Заявку скасовано', message: 'Запис оновлено в історії участі.' });
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося скасувати заявку');
    } finally {
      setBusy(null);
    }
  }

  async function submitReview(eventId: string) {
    const draft = defaultReview(eventId);
    setBusy(`review-${eventId}`);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/user-features/events/${eventId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося зберегти оцінку';
        setError(message);
        showToast({ kind: 'error', title: 'Оцінку не збережено', message });
        return;
      }
      showToast({ kind: 'success', title: 'Оцінку збережено', message: 'Ваш відгук враховано в рейтингу події.' });
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося зберегти оцінку';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally {
      setBusy(null);
    }
  }

  async function submitVote(eventId: string) {
    const draft = defaultVote(eventId);
    if (!draft.value.trim()) {
      showToast({ kind: 'error', title: 'Заповніть значення', message: 'Вкажіть бажану дату, локацію або час.' });
      return;
    }
    setBusy(`vote-${eventId}`);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/user-features/events/${eventId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося зберегти голос';
        setError(message);
        showToast({ kind: 'error', title: 'Голос не збережено', message });
        return;
      }
      showToast({ kind: 'success', title: 'Голос враховано', message: `Організатор побачить запит на ${voteTypeLabel(draft.type)}.` });
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося зберегти голос';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally {
      setBusy(null);
    }
  }

  const summary = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
    attended: bookings.filter((b) => b.status === 'ATTENDED').length,
    pending: bookings.filter((b) => b.status === 'PENDING').length,
    canceled: bookings.filter((b) => b.status === 'CANCELED').length,
    unread: notifications.filter((n) => !n.readAt).length,
  }), [bookings, notifications]);

  return (
    <div className="page-shell">
      <AppHeader title="Моя участь" subtitle="Історія заявок, оцінювання подій, голосування та сповіщення" />
      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <h1 style={{ fontSize: '2.2rem' }}>Персональний кабінет учасника спортивних подій</h1>
          <p>На цій сторінці зібрано повну історію участі. Додатково користувач може оцінити відвідану подію та проголосувати за додаткову дату, локацію або час проведення схожої активності.</p>
          <div className="kpi-row organizer-kpis">
            <div className="kpi"><div className="muted">Усього записів</div><div className="value">{summary.total}</div></div>
            <div className="kpi"><div className="muted">Підтверджено</div><div className="value">{summary.confirmed}</div></div>
            <div className="kpi"><div className="muted">Відвідано</div><div className="value">{summary.attended}</div></div>
            <div className="kpi"><div className="muted">Очікують</div><div className="value">{summary.pending}</div></div>
            <div className="kpi"><div className="muted">Скасовано</div><div className="value">{summary.canceled}</div></div>
            <div className="kpi"><div className="muted">Нові сповіщення</div><div className="value">{summary.unread}</div></div>
          </div>
        </section>

        {error && <div className="error-box">{error}</div>}
        {loading && <div className="notice">Завантаження даних...</div>}

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Історія участі</h2>
          <div className="grid grid-2">
            {bookings.map((b) => {
              const review = defaultReview(b.eventId);
              const vote = defaultVote(b.eventId);
              const canReview = b.status === 'ATTENDED';
              const canVote = b.status !== 'CANCELED';

              return (
                <div key={b.id} className="card"><div className="card-body">
                  <a href={`/events/${b.eventId}`} style={{ fontWeight: 700, fontSize: 18 }}>{b.event.title}</a>
                  <div className="muted" style={{ marginTop: 6 }}>{b.event.location} • {new Date(b.event.startAt).toLocaleString()}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{levelLabel(b.event.level)} • {formatLabel(b.event.format)}</div>
                  <div className="badges">
                    <span className={`badge ${b.status === 'CANCELED' ? 'danger' : b.status === 'ATTENDED' ? 'success' : b.status === 'PENDING' ? 'warning' : 'info'}`}>{bookingStatusLabel(b.status)}</span>
                    <span className="badge">Створено: {new Date(b.createdAt).toLocaleDateString()}</span>
                    {b.checkedInAt ? <span className="badge success">Відмітка присутності: {new Date(b.checkedInAt).toLocaleString()}</span> : null}
                  </div>
                  {b.rejectReason ? <div className="notice" style={{ marginTop: 12 }}>Причина відхилення: {b.rejectReason}</div> : null}

                  {canReview ? (
                    <div className="notice" style={{ marginTop: 14 }}>
                      <div style={{ fontWeight: 700 }}>Оцінити подію після участі</div>
                      <div className="form-grid" style={{ marginTop: 12 }}>
                        <label><div className="muted" style={{ marginBottom: 6 }}>Оцінка</div><select value={review.rating} onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [b.eventId]: { ...review, rating: Number(e.target.value) } }))}><option value={5}>5 — відмінно</option><option value={4}>4 — добре</option><option value={3}>3 — нормально</option><option value={2}>2 — слабко</option><option value={1}>1 — погано</option></select></label>
                        <label><div className="muted" style={{ marginBottom: 6 }}>Рекомендація іншим</div><select value={review.recommend ? 'yes' : 'no'} onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [b.eventId]: { ...review, recommend: e.target.value === 'yes' } }))}><option value="yes">Так</option><option value="no">Ні</option></select></label>
                        <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Коментар</div><textarea rows={3} value={review.comment} onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [b.eventId]: { ...review, comment: e.target.value } }))} placeholder="Що сподобалось або що варто покращити?" /></label>
                      </div>
                      <button className="primary-btn" style={{ marginTop: 12 }} onClick={() => submitReview(b.eventId)} disabled={busy === `review-${b.eventId}`}>{busy === `review-${b.eventId}` ? 'Збереження...' : 'Зберегти оцінку'}</button>
                    </div>
                  ) : null}

                  {canVote ? (
                    <div className="notice" style={{ marginTop: 14 }}>
                      <div style={{ fontWeight: 700 }}>Проголосувати за додатковий варіант</div>
                      <p className="muted" style={{ marginTop: 6 }}>Голос показує організатору, який попит існує на іншу дату, локацію або час.</p>
                      <div className="form-grid" style={{ marginTop: 12 }}>
                        <label><div className="muted" style={{ marginBottom: 6 }}>Тип запиту</div><select value={vote.type} onChange={(e) => setVoteDrafts((prev) => ({ ...prev, [b.eventId]: { ...vote, type: e.target.value as VoteDraft['type'] } }))}><option value="DATE">Додаткова дата</option><option value="LOCATION">Інша локація</option><option value="TIME">Інший час</option></select></label>
                        <label><div className="muted" style={{ marginBottom: 6 }}>Бажане значення</div><input value={vote.value} onChange={(e) => setVoteDrafts((prev) => ({ ...prev, [b.eventId]: { ...vote, value: e.target.value } }))} placeholder="Наприклад: Vinnytsia або 18:00" /></label>
                        <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Коментар</div><textarea rows={2} value={vote.comment} onChange={(e) => setVoteDrafts((prev) => ({ ...prev, [b.eventId]: { ...vote, comment: e.target.value } }))} placeholder="Чому цей варіант зручніший?" /></label>
                      </div>
                      <button className="secondary-btn" style={{ marginTop: 12 }} onClick={() => submitVote(b.eventId)} disabled={busy === `vote-${b.eventId}`}>{busy === `vote-${b.eventId}` ? 'Збереження...' : 'Надіслати голос'}</button>
                    </div>
                  ) : null}

                  <div className="inline-actions">
                    <button className="secondary-btn" onClick={() => cancel(b.eventId)} disabled={busy === b.eventId || b.status === 'CANCELED' || b.status === 'ATTENDED'}>
                      {busy === b.eventId ? 'Скасування...' : 'Скасувати заявку'}
                    </button>
                  </div>
                </div></div>
              );
            })}
            {!loading && bookings.length === 0 && <div className="notice">У вас поки немає активних заявок або підтверджених участей.</div>}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Лист очікування</h2>
          <div className="grid grid-2">
            {waitlist.map((w) => (
              <div key={w.id} className="card"><div className="card-body">
                <a href={`/events/${w.eventId}`} style={{ fontWeight: 700, fontSize: 18 }}>{w.event.title}</a>
                <div className="muted" style={{ marginTop: 6 }}>{w.event.location} • {new Date(w.event.startAt).toLocaleString()}</div>
                <div className="badges"><span className="badge warning">Позиція #{w.position}</span><span className="badge">Додано: {new Date(w.createdAt).toLocaleDateString()}</span></div>
              </div></div>
            ))}
            {!loading && waitlist.length === 0 && <div className="notice">Ви не перебуваєте у листі очікування.</div>}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Останні сповіщення</h2>
          <div className="grid grid-2">
            {notifications.slice(0, 6).map((n) => (
              <div key={n.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{n.title}</div>
                  <span className={`badge ${n.readAt ? 'success' : 'warning'}`}>{n.readAt ? 'Прочитано' : 'Нове'}</span>
                </div>
                <p style={{ marginTop: 10 }}>{n.message}</p>
                <div className="badges">
                  <span className="badge">{new Date(n.createdAt).toLocaleString()}</span>
                  {n.eventId ? <a className="badge info" href={`/events/${n.eventId}`}>До події</a> : null}
                </div>
              </div></div>
            ))}
            {!loading && notifications.length === 0 && <div className="notice">Поки що системних сповіщень немає.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
