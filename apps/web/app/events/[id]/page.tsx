'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createApiClient, type BookingWithEventDTO, type EventDTO } from '@shared/contracts';
import { AppHeader } from '../../components/app-header';
import { useToast } from '../../components/toast-provider';
import { bookingStatusLabel, eventShortDescription, eventStatusLabel, formatLabel, getCurrentRole, levelLabel, seatSummary, type UserRole } from '../../lib/session';

const api = createApiClient();

type ParticipantDTO = { id: string; createdAt: string; status: string; checkedInAt?: string | null; user: { id: string; name: string; email: string; role: string } };
type WaitlistDTO = { id: string; createdAt: string; position: number; user: { id: string; name: string; email: string } };
type ActivityItem = { id: string; createdAt: string; message: string; details?: string | null; actor?: { id: string; name: string; email: string; role: string } | null };
type ReviewSummary = { averageRating: number; count: number; reviews: Array<{ id: string; rating: number; comment?: string | null; recommend: boolean; createdAt: string; user?: { name: string } }> };
type VoteDraft = { type: 'DATE' | 'LOCATION' | 'TIME'; value: string; comment: string };

export default function EventDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [role, setRole] = useState<UserRole | null>(null);
  const [event, setEvent] = useState<EventDTO | null>(null);
  const [similar, setSimilar] = useState<EventDTO[]>([]);
  const [myBookings, setMyBookings] = useState<BookingWithEventDTO[]>([]);
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistDTO[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({ averageRating: 0, count: 0, reviews: [] });
  const [voteDraft, setVoteDraft] = useState<VoteDraft>({ type: 'DATE', value: '', comment: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  const myBooking = useMemo(() => myBookings.find((b) => b.eventId === id), [myBookings, id]);
  const seats = event ? seatSummary(event) : { confirmed: 0, free: 0, pending: 0, waitlist: 0 };
  const canManage = role === 'ORGANIZER' || role === 'ADMIN';

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const currentRole = getCurrentRole();
      const allowManage = currentRole === 'ORGANIZER' || currentRole === 'ADMIN';
      setRole(currentRole);
      const eventPromise = api.getEvent(id);
      const reviewsPromise = fetch(`/api/proxy/user-features/events/${id}/reviews`).then((r) => r.ok ? r.json() : { averageRating: 0, count: 0, reviews: [] });
      const myBookingsPromise = currentRole === 'USER' ? fetch('/api/proxy/bookings/my').then((r) => r.ok ? r.json() : []) : Promise.resolve([]);
      const managementPromise = allowManage
        ? Promise.all([
            fetch(`/api/proxy/events/${id}/bookings`).then((r) => r.ok ? r.json() : []),
            fetch(`/api/proxy/events/${id}/waitlist`).then((r) => r.ok ? r.json() : []),
            fetch(`/api/proxy/events/${id}/activity`).then((r) => r.ok ? r.json() : []),
          ])
        : Promise.resolve([[], [], []]);

      const [eventData, reviewsData, ownBookingsData, managementData] = await Promise.all([eventPromise, reviewsPromise, myBookingsPromise, managementPromise]);
      setEvent(eventData);
      setReviewSummary(reviewsData && typeof reviewsData === 'object' ? reviewsData : { averageRating: 0, count: 0, reviews: [] });
      setMyBookings(Array.isArray(ownBookingsData) ? ownBookingsData : []);
      const [bookingsData, waitlistData, activityData] = managementData as [ParticipantDTO[], WaitlistDTO[], ActivityItem[]];
      setParticipants(Array.isArray(bookingsData) ? bookingsData : []);
      setWaitlist(Array.isArray(waitlistData) ? waitlistData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);

      const sim = await api.getEvents({ sportType: eventData.sportType });
      setSimilar(sim.filter((x) => x.id !== eventData.id).slice(0, 4));
    } catch (err: any) {
      setError(err?.message ?? 'Не вдалося завантажити подію');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!id) return;
    setRole(getCurrentRole());
    void load();
    void fetch(`/api/proxy/events/${id}/view`, { method: 'POST' });
  }, [id]);

  async function action(path: string) {
    if (!id) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: id }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message ?? 'Операцію не виконано';
        setError(msg); showToast({ kind: 'error', title: 'Дію не виконано', message: msg }); return;
      }
      const successMessage = data?.kind === 'WAITLISTED' ? 'Місць немає — вас додано до листа очікування.' : data?.kind === 'REQUESTED' ? 'Заявку подано. Очікуйте підтвердження від організатора.' : path.includes('/cancel') ? 'Вашу заявку скасовано.' : 'Операцію успішно виконано.';
      setMessage(successMessage); showToast({ kind: 'success', title: 'Готово', message: successMessage }); await load();
    } catch (e: any) {
      const msg = e?.message ?? 'Операцію не виконано'; setError(msg); showToast({ kind: 'error', title: 'Помилка', message: msg });
    } finally { setBusy(false); }
  }



  async function submitVote() {
    if (!id) return;
    if (!voteDraft.value.trim()) {
      showToast({ kind: 'error', title: 'Заповніть значення', message: 'Вкажіть бажану дату, локацію або час.' });
      return;
    }
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch(`/api/proxy/user-features/events/${id}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteDraft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message ?? 'Голос не збережено';
        setError(msg); showToast({ kind: 'error', title: 'Голос не збережено', message: msg }); return;
      }
      const successMessage = 'Ваш голос за додатковий варіант події враховано.';
      setMessage(successMessage); showToast({ kind: 'success', title: 'Голос враховано', message: successMessage });
      setVoteDraft({ type: 'DATE', value: '', comment: '' });
    } catch (e: any) {
      const msg = e?.message ?? 'Голос не збережено'; setError(msg); showToast({ kind: 'error', title: 'Помилка', message: msg });
    } finally { setBusy(false); }
  }

  if (loading) return <main className="page-shell"><div className="notice">Завантаження...</div></main>;
  if (!event) return <main className="page-shell"><div className="error-box">Подію не знайдено</div></main>;

  return (
    <div className="page-shell">
      <AppHeader title="Деталі події" subtitle="Повна інформація, статистика, історія дій та дії за роллю" />
      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <div className="badges" style={{ marginTop: 0 }}>
            <span className="badge info">{event.sportType}</span><span className="badge">{levelLabel(event.level)}</span><span className="badge">{formatLabel(event.format)}</span><span className="badge">{eventStatusLabel(event.status)}</span>
          </div>
          <h1 style={{ fontSize: '2.3rem' }}>{event.title}</h1>
          <p>{eventShortDescription(event)}</p>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="card"><div className="card-body"><h3 className="section-title" style={{ marginTop: 0 }}>Основна інформація</h3><div className="muted">Дата і час</div><div>{new Date(event.startAt).toLocaleString()}</div><div className="muted" style={{ marginTop: 10 }}>Локація</div><div>{event.location}</div><div className="muted" style={{ marginTop: 10 }}>Організатор</div><div>{event.organizer?.name ?? 'Організатор'}{event.organizer?.email ? ` • ${event.organizer.email}` : ''}</div></div></div>
            <div className="card"><div className="card-body"><h3 className="section-title" style={{ marginTop: 0 }}>Статистика події</h3><div className="badges"><span className="badge success">Підтверджено: {seats.confirmed}/{event.capacity}</span><span className="badge warning">Очікують: {seats.pending}</span><span className="badge">Черга: {seats.waitlist}</span><span className="badge info">Вільно: {seats.free}</span><span className="badge">👁 {event.views ?? 0} переглядів</span></div></div></div>
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            {role === 'USER' ? <><button className="primary-btn" onClick={() => action('/api/proxy/bookings')} disabled={busy || (!!myBooking && myBooking.status !== 'CANCELED')}>{busy ? 'Обробка...' : myBooking && myBooking.status !== 'CANCELED' ? 'Заявку вже подано' : seats.free > 0 ? 'Подати заявку' : 'Стати в чергу'}</button><button className="secondary-btn" onClick={() => action('/api/proxy/bookings/cancel')} disabled={busy || !myBooking || myBooking.status === 'CANCELED' || myBooking.status === 'ATTENDED'}>Скасувати свою заявку</button></> : null}
            {canManage ? <><a className="primary-btn" href={`/organizer/events/${event.id}/participants`}>Керувати заявками</a><a className="secondary-btn" href="/organizer/events">До панелі організатора</a></> : null}
          </div>
        </section>

        {message ? <div className="success-box">{message}</div> : null}
        {error ? <div className="error-box">{error}</div> : null}

        {role === 'USER' ? <section style={{ marginTop: 24 }}><h2 className="section-title">Ваш статус у цій події</h2><div className="card"><div className="card-body">{myBooking ? <><div className="badges"><span className={`badge ${myBooking.status === 'CONFIRMED' || myBooking.status === 'ATTENDED' ? 'success' : myBooking.status === 'PENDING' ? 'warning' : 'danger'}`}>{bookingStatusLabel(myBooking.status)}</span><span className="badge">Створено: {new Date(myBooking.createdAt).toLocaleString()}</span></div>{myBooking.rejectReason ? <div className="notice" style={{ marginTop: 12 }}>Причина відхилення: {myBooking.rejectReason}</div> : null}</> : <div className="notice">Ви ще не подавали заявку на цю подію.</div>}</div></div></section> : null}



        {role === 'USER' ? <section style={{ marginTop: 24 }}><h2 className="section-title">Голосування за додатковий варіант події</h2><div className="card"><div className="card-body"><p className="muted">Якщо ця подія цікава, але вам потрібна інша дата, локація або час, залиште голос. Організатор побачить узагальнений попит у своїй панелі.</p><div className="form-grid" style={{ marginTop: 14 }}><label><div className="muted" style={{ marginBottom: 6 }}>Тип запиту</div><select value={voteDraft.type} onChange={(e) => setVoteDraft({ ...voteDraft, type: e.target.value as VoteDraft['type'] })}><option value="DATE">Додаткова дата</option><option value="LOCATION">Інша локація</option><option value="TIME">Інший час</option></select></label><label><div className="muted" style={{ marginBottom: 6 }}>Бажане значення</div><input value={voteDraft.value} onChange={(e) => setVoteDraft({ ...voteDraft, value: e.target.value })} placeholder="Наприклад: Vinnytsia, 18:00 або 20.05.2026" /></label><label className="full"><div className="muted" style={{ marginBottom: 6 }}>Коментар</div><textarea rows={2} value={voteDraft.comment} onChange={(e) => setVoteDraft({ ...voteDraft, comment: e.target.value })} placeholder="Поясніть, чому цей варіант був би зручнішим" /></label></div><button className="secondary-btn" style={{ marginTop: 12 }} onClick={submitVote} disabled={busy}>{busy ? 'Збереження...' : 'Надіслати голос'}</button></div></div></section> : null}

        <section style={{ marginTop: 24 }}><h2 className="section-title">Оцінки учасників</h2><div className="card"><div className="card-body"><div className="badges"><span className="badge success">Середня оцінка: {reviewSummary.count ? reviewSummary.averageRating.toFixed(1) : '—'}</span><span className="badge">Відгуків: {reviewSummary.count}</span></div>{reviewSummary.reviews.length === 0 ? <div className="notice">Відгуків поки немає. Оцінювання доступне користувачам після фіксації присутності на події.</div> : <div className="grid grid-2" style={{ marginTop: 14 }}>{reviewSummary.reviews.slice(0, 4).map((review) => <div key={review.id} className="notice"><div style={{ fontWeight: 700 }}>{review.user?.name ?? 'Учасник'} · {review.rating}/5</div>{review.comment ? <p style={{ marginTop: 8 }}>{review.comment}</p> : null}<div className="badges"><span className={`badge ${review.recommend ? 'success' : 'warning'}`}>{review.recommend ? 'Рекомендує' : 'Не рекомендує'}</span><span className="badge">{new Date(review.createdAt).toLocaleDateString()}</span></div></div>)}</div>}</div></div></section>

        {canManage ? <section style={{ marginTop: 24 }}><h2 className="section-title">Оперативна панель керування</h2><div className="grid grid-2"><div className="card"><div className="card-body"><div style={{ fontWeight: 700, fontSize: 18 }}>Заявки</div><div className="badges" style={{ marginTop: 10 }}><span className="badge warning">Очікують: {participants.filter((x) => x.status === 'PENDING').length}</span><span className="badge success">Підтверджено: {participants.filter((x) => x.status === 'CONFIRMED').length}</span><span className="badge">Відвідали: {participants.filter((x) => x.status === 'ATTENDED').length}</span></div><p style={{ marginTop: 12 }}>Організатор або адміністратор не подає заявку від себе, а керує вже поданими заявками інших користувачів.</p></div></div><div className="card"><div className="card-body"><div style={{ fontWeight: 700, fontSize: 18 }}>Черга та заповнюваність</div><div className="badges" style={{ marginTop: 10 }}><span className="badge info">Вільно: {seats.free}</span><span className="badge">Черга: {waitlist.length}</span><span className="badge">Популярність: {event.popularityScore ?? 0}</span></div><p style={{ marginTop: 12 }}>У журналі дій нижче фіксуються підтвердження, відхилення з причиною, фіксація присутності та зміни параметрів події.</p></div></div></div></section> : null}

        {canManage ? <section style={{ marginTop: 24 }}><h2 className="section-title">Останні дії по події</h2><div className="grid grid-2">{activity.length === 0 ? <div className="notice">Поки що журнал порожній.</div> : activity.map((item) => <div key={item.id} className="card"><div className="card-body"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div style={{ fontWeight: 700 }}>{item.message}</div><span className="badge">{new Date(item.createdAt).toLocaleString()}</span></div>{item.actor ? <div className="muted" style={{ marginTop: 8 }}>Ініціатор: {item.actor.name} • {item.actor.role}</div> : null}{item.details ? <div className="notice" style={{ marginTop: 12 }}>{item.details}</div> : null}</div></div>)}</div></section> : null}

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Схожі події</h2>
          <div className="grid grid-2">{similar.map((s) => { const simSeats = seatSummary(s); return <div key={s.id} className="card"><div className="card-body"><a href={`/events/${s.id}`} style={{ fontWeight: 700, fontSize: 18 }}>{s.title}</a><div className="muted" style={{ marginTop: 6 }}>{new Date(s.startAt).toLocaleString()} — {s.location}</div><div className="badges"><span className="badge success">Підтверджено: {simSeats.confirmed}/{s.capacity}</span><span className="badge info">Вільно: {simSeats.free}</span><span className="badge">👁 {s.views ?? 0}</span></div></div></div>; })}</div>
        </section>
      </main>
    </div>
  );
}
