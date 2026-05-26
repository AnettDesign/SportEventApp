'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/app-header';
import { useToast } from '../components/toast-provider';
import { formatLabel, levelLabel } from '../lib/session';

type ProfileDTO = {
  favoriteSport?: string | null;
  level?: string | null;
  preferredFormat?: string | null;
  preferredLocation?: string | null;
  maxParticipants?: number | null;
  preferredTime?: string | null;
  notes?: string | null;
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
};

const emptyProfile: ProfileDTO = {
  favoriteSport: '',
  level: '',
  preferredFormat: '',
  preferredLocation: '',
  maxParticipants: null,
  preferredTime: '',
  notes: '',
};

const emptyRequest = {
  sportType: '',
  level: 'BEGINNER',
  format: 'TRAINING',
  location: '',
  preferredDate: '',
  comment: '',
};

function requestStatusLabel(status: string) {
  switch (status) {
    case 'OPEN': return 'Новий запит';
    case 'PLANNED': return 'Взято в план';
    case 'CLOSED': return 'Закрито';
    default: return status;
  }
}

export default function InterestsPage() {
  const [profile, setProfile] = useState<ProfileDTO>(emptyProfile);
  const [eventRequest, setEventRequest] = useState(emptyRequest);
  const [requests, setRequests] = useState<EventRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, requestsRes] = await Promise.all([
        fetch('/api/proxy/user-features/profile/my'),
        fetch('/api/proxy/user-features/event-requests/my'),
      ]);
      const profileData = profileRes.ok ? await profileRes.json() : null;
      const requestsData = requestsRes.ok ? await requestsRes.json() : [];
      setProfile({ ...emptyProfile, ...(profileData ?? {}) });
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      if (!profileRes.ok && profileRes.status !== 401) setError('Не вдалося завантажити профіль інтересів');
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveProfile() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/user-features/profile/my', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося зберегти профіль';
        setError(message);
        showToast({ kind: 'error', title: 'Профіль не збережено', message });
        return;
      }
      setProfile({ ...emptyProfile, ...data });
      showToast({ kind: 'success', title: 'Профіль збережено', message: 'Рекомендації подій тепер враховують ваші спортивні інтереси.' });
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося зберегти профіль';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally {
      setBusy(false);
    }
  }

  async function createRequest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/user-features/event-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventRequest),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося створити запит';
        setError(message);
        showToast({ kind: 'error', title: 'Запит не створено', message });
        return;
      }
      setEventRequest(emptyRequest);
      showToast({ kind: 'success', title: 'Запит створено', message: 'Організатор побачить попит на нову подію у своїй панелі.' });
      await load();
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося створити запит';
      setError(message);
      showToast({ kind: 'error', title: 'Помилка', message });
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => ({
    total: requests.length,
    open: requests.filter((r) => r.status === 'OPEN').length,
    planned: requests.filter((r) => r.status === 'PLANNED').length,
    closed: requests.filter((r) => r.status === 'CLOSED').length,
  }), [requests]);

  return (
    <div className="page-shell">
      <AppHeader title="Мої інтереси" subtitle="Персоналізація рекомендацій і запити на нові спортивні події" />
      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <div className="badge info" style={{ display: 'inline-flex' }}>Personal demand profile</div>
          <h1 style={{ fontSize: '2.2rem' }}>Профіль спортивних інтересів користувача</h1>
          <p>Користувач не лише переглядає каталог, а сам уточнює власні спортивні інтереси та створює запити на події, яких бракує в системі. Ці дані використовуються для персоналізованих рекомендацій і для формування попиту для організатора.</p>
          <div className="kpi-row organizer-kpis">
            <div className="kpi"><div className="muted">Мої запити</div><div className="value">{summary.total}</div></div>
            <div className="kpi"><div className="muted">Нові</div><div className="value">{summary.open}</div></div>
            <div className="kpi"><div className="muted">У плані</div><div className="value">{summary.planned}</div></div>
            <div className="kpi"><div className="muted">Закриті</div><div className="value">{summary.closed}</div></div>
          </div>
        </section>

        {error ? <div className="error-box">{error}</div> : null}
        {loading ? <div className="notice">Завантаження...</div> : null}

        <section style={{ marginTop: 24 }}>
          <div className="card"><div className="card-body">
            <h2 className="section-title" style={{ marginTop: 0 }}>Анкета спортивних інтересів</h2>
            <p className="muted">Після збереження анкети блок рекомендованих подій у каталозі враховує вид спорту, рівень, формат, локацію та бажану місткість.</p>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <label><div className="muted" style={{ marginBottom: 6 }}>Улюблений вид спорту</div><input value={profile.favoriteSport ?? ''} onChange={(e) => setProfile({ ...profile, favoriteSport: e.target.value })} placeholder="Tennis, Football..." /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Бажана локація</div><input value={profile.preferredLocation ?? ''} onChange={(e) => setProfile({ ...profile, preferredLocation: e.target.value })} placeholder="Kyiv, Vinnytsia..." /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Рівень підготовки</div><select value={profile.level ?? ''} onChange={(e) => setProfile({ ...profile, level: e.target.value })}><option value="">Не обрано</option><option value="BEGINNER">Початковий</option><option value="INTERMEDIATE">Середній</option><option value="ADVANCED">Просунутий</option></select></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Зручний формат</div><select value={profile.preferredFormat ?? ''} onChange={(e) => setProfile({ ...profile, preferredFormat: e.target.value })}><option value="">Не обрано</option><option value="TRAINING">Тренування</option><option value="TOURNAMENT">Турнір</option><option value="SECTION">Секція</option><option value="MATCH">Матч</option></select></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Максимальна кількість учасників</div><input type="number" min={1} value={profile.maxParticipants ?? ''} onChange={(e) => setProfile({ ...profile, maxParticipants: e.target.value ? Number(e.target.value) : null })} placeholder="Наприклад, 20" /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Зручний час</div><input value={profile.preferredTime ?? ''} onChange={(e) => setProfile({ ...profile, preferredTime: e.target.value })} placeholder="Вечір, вихідні, ранок..." /></label>
              <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Додаткові побажання</div><textarea rows={4} value={profile.notes ?? ''} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} placeholder="Що ще важливо для участі у подіях?" /></label>
            </div>
            <div className="inline-actions"><button className="primary-btn" onClick={saveProfile} disabled={busy}>{busy ? 'Збереження...' : 'Зберегти анкету'}</button><a className="secondary-btn" href="/events">Переглянути рекомендації</a></div>
          </div></div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="card"><div className="card-body">
            <h2 className="section-title" style={{ marginTop: 0 }}>Запропонувати нову подію</h2>
            <p className="muted">Якщо потрібної події немає в каталозі, користувач може сформувати запит. Це показує організатору реальний попит на нові спортивні активності.</p>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <label><div className="muted" style={{ marginBottom: 6 }}>Вид спорту</div><input value={eventRequest.sportType} onChange={(e) => setEventRequest({ ...eventRequest, sportType: e.target.value })} placeholder="Boxing, Tennis..." /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Локація</div><input value={eventRequest.location} onChange={(e) => setEventRequest({ ...eventRequest, location: e.target.value })} placeholder="Vinnytsia, Kyiv..." /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Рівень</div><select value={eventRequest.level} onChange={(e) => setEventRequest({ ...eventRequest, level: e.target.value })}><option value="BEGINNER">Початковий</option><option value="INTERMEDIATE">Середній</option><option value="ADVANCED">Просунутий</option></select></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Формат</div><select value={eventRequest.format} onChange={(e) => setEventRequest({ ...eventRequest, format: e.target.value })}><option value="TRAINING">Тренування</option><option value="TOURNAMENT">Турнір</option><option value="SECTION">Секція</option><option value="MATCH">Матч</option></select></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Бажана дата</div><input type="date" value={eventRequest.preferredDate} onChange={(e) => setEventRequest({ ...eventRequest, preferredDate: e.target.value })} /></label>
              <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Коментар</div><textarea rows={3} value={eventRequest.comment} onChange={(e) => setEventRequest({ ...eventRequest, comment: e.target.value })} placeholder="Опишіть, яку подію хотіли б бачити" /></label>
            </div>
            <div className="inline-actions"><button className="primary-btn" onClick={createRequest} disabled={busy}>{busy ? 'Створення...' : 'Надіслати запит організатору'}</button></div>
          </div></div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">Мої запити на події</h2>
          <div className="grid grid-2">
            {requests.map((request) => (
              <div key={request.id} className="card"><div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{request.sportType} у {request.location}</div>
                  <span className={`badge ${request.status === 'PLANNED' ? 'success' : request.status === 'CLOSED' ? 'danger' : 'warning'}`}>{requestStatusLabel(request.status)}</span>
                </div>
                <div className="badges"><span className="badge">{levelLabel(request.level)}</span><span className="badge">{formatLabel(request.format)}</span>{request.preferredDate ? <span className="badge info">Бажана дата: {new Date(request.preferredDate).toLocaleDateString()}</span> : null}<span className="badge">Створено: {new Date(request.createdAt).toLocaleDateString()}</span></div>
                {request.comment ? <div className="notice">{request.comment}</div> : null}
              </div></div>
            ))}
            {!loading && requests.length === 0 ? <div className="notice">Ви ще не створювали запити на нові спортивні події.</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
