'use client';

import { useState } from 'react';
import type { CreateEventDTO, EventFormat, SkillLevel } from '@shared/contracts';
import { AppHeader } from '../components/app-header';
import { useToast } from '../components/toast-provider';

export default function CreateEventPage() {
  const [title, setTitle] = useState('');
  const [sportType, setSportType] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState('');
  const [capacity, setCapacity] = useState<number>(20);
  const [level, setLevel] = useState<SkillLevel>('BEGINNER');
  const [format, setFormat] = useState<EventFormat>('TRAINING');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const { showToast } = useToast();

  async function submit() {
    setErr(null);
    setOk(null);
    if (!title.trim() || !sportType.trim() || !location.trim() || !startAt) {
      setErr('Заповніть усі обов’язкові поля');
      showToast({ kind: 'error', title: 'Не всі поля заповнені', message: 'Перевірте назву, вид спорту, локацію та дату.' });
      return;
    }

    const dto: CreateEventDTO = {
      title: title.trim(),
      sportType: sportType.trim(),
      description: description.trim() || undefined,
      location: location.trim(),
      level,
      format,
      startAt: new Date(startAt).toISOString(),
      capacity: Number(capacity),
    };

    setLoading(true);
    try {
      const res = await fetch('/api/proxy/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message ?? 'Не вдалося створити подію';
        setErr(message);
        showToast({ kind: 'error', title: 'Подію не створено', message });
        return;
      }
      const success = `Подію «${data.title}» успішно створено.`;
      setOk(success);
      showToast({ kind: 'success', title: 'Подію створено', message: success });
      setTitle(''); setSportType(''); setDescription(''); setLocation(''); setStartAt(''); setCapacity(20);
      setTimeout(() => {
        window.location.href = '/organizer/events';
      }, 900);
    } catch (e: any) {
      const message = e?.message ?? 'Не вдалося створити подію';
      setErr(message);
      showToast({ kind: 'error', title: 'Помилка створення події', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <AppHeader title="Створення події" subtitle="Інструменти організатора" />

      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <div className="badge info" style={{ display: 'inline-flex' }}>Organizer tools</div>
          <h1 style={{ fontSize: '2.2rem' }}>Створіть новий спортивний захід</h1>
          <p>Подія після створення відразу потрапляє в каталог, стає доступною для заявок, аналітики переглядів і подальшого управління в панелі організатора.</p>
        </section>

        {err && <div className="error-box">{err}</div>}
        {ok && <div className="success-box">{ok}</div>}

        <section style={{ marginTop: 24 }}>
          <div className="card"><div className="card-body">
            <div className="form-grid">
              <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Назва</div><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Напр., Турнір з тенісу" disabled={loading} /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Вид спорту</div><input value={sportType} onChange={(e) => setSportType(e.target.value)} placeholder="Tennis, Football..." disabled={loading} /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Локація</div><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Vinnytsia, Kyiv..." disabled={loading} /></label>
              <label className="full"><div className="muted" style={{ marginBottom: 6 }}>Опис події</div><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко опишіть формат, для кого ця подія, що потрібно учасникам і як проходитиме захід." disabled={loading} rows={4} /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Дата і час</div><input value={startAt} onChange={(e) => setStartAt(e.target.value)} type="datetime-local" disabled={loading} /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Місткість</div><input value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} type="number" min={1} disabled={loading} /></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Рівень</div><select value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)} disabled={loading}><option value="BEGINNER">Початковий</option><option value="INTERMEDIATE">Середній</option><option value="ADVANCED">Просунутий</option></select></label>
              <label><div className="muted" style={{ marginBottom: 6 }}>Формат</div><select value={format} onChange={(e) => setFormat(e.target.value as EventFormat)} disabled={loading}><option value="TRAINING">Тренування</option><option value="TOURNAMENT">Турнір</option><option value="SECTION">Секція</option><option value="MATCH">Матч</option></select></label>
            </div>
            <div className="inline-actions">
              <button className="primary-btn" onClick={submit} disabled={loading}>{loading ? 'Створення...' : 'Створити подію'}</button>
              <a className="secondary-btn" href="/organizer/events">До панелі організатора</a>
            </div>
          </div></div>
        </section>
      </main>
    </div>
  );
}
