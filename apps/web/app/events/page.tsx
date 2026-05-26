'use client';

import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type EventDTO } from '@shared/contracts';
import { AppHeader } from '../components/app-header';
import { eventShortDescription, formatLabel, getCurrentRole, levelLabel, seatSummary, type UserRole } from '../lib/session';

const api = createApiClient();

type SortBy = 'date' | 'popularity' | 'availability';

type EventFilters = {
  sportType: string;
  level: string;
  format: string;
  location: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: EventFilters = {
  sportType: '',
  level: '',
  format: '',
  location: '',
  dateFrom: '',
  dateTo: '',
};

function recommendationBadges(r: EventDTO): string[] {
  const reason = r?.recommendationReason;
  if (!reason) return ['🤖 Рекомендовано системою'];
  if (reason.fallbackPopular) return ['🔥 Популярна подія'];

  const items: string[] = [];
  if (reason.sportMatch) items.push('🏅 Ваш вид спорту');
  if (reason.locationMatch) items.push('📍 Ваша локація');
  if (reason.levelMatch) items.push('🎯 Ваш рівень');
  if (reason.formatMatch) items.push('📌 Зручний формат');
  if (reason.capacityMatch) items.push('👥 Підходить за місткістю');
  if (!items.length) items.push('🤖 Рекомендовано системою');

  return items;
}

function normalize(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function toLocalDateValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function eventMatchesFilters(event: EventDTO, filters: EventFilters) {
  const sport = normalize(filters.sportType);
  const location = normalize(filters.location);
  const eventDate = toLocalDateValue(event.startAt);

  if (sport && !normalize(event.sportType).includes(sport)) return false;
  if (filters.level && event.level !== filters.level) return false;
  if (filters.format && event.format !== filters.format) return false;
  if (location && !normalize(event.location).includes(location)) return false;
  if (filters.dateFrom && eventDate && eventDate < filters.dateFrom) return false;
  if (filters.dateTo && eventDate && eventDate > filters.dateTo) return false;

  return true;
}

function sortEvents(items: EventDTO[], sortBy: SortBy) {
  const copy = [...items];

  switch (sortBy) {
    case 'popularity':
      return copy.sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0));
    case 'availability':
      return copy.sort(
        (a, b) =>
          seatSummary(b).free - seatSummary(a).free ||
          (b.confirmedCount ?? 0) - (a.confirmedCount ?? 0) ||
          +new Date(a.startAt) - +new Date(b.startAt),
      );
    default:
      return copy.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hasActiveFilters(filters: EventFilters) {
  return Object.values(filters).some(Boolean);
}

function activeFilterLabels(filters: EventFilters) {
  const labels: string[] = [];

  if (filters.sportType) labels.push(`вид спорту: ${filters.sportType}`);
  if (filters.level) labels.push(`рівень: ${levelLabel(filters.level as EventDTO['level'])}`);
  if (filters.format) labels.push(`формат: ${formatLabel(filters.format as EventDTO['format'])}`);
  if (filters.location) labels.push(`локація: ${filters.location}`);
  if (filters.dateFrom) labels.push(`від: ${filters.dateFrom}`);
  if (filters.dateTo) labels.push(`до: ${filters.dateTo}`);

  return labels;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [recommended, setRecommended] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const [filters, setFilters] = useState<EventFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<EventFilters>(emptyFilters);
  const [sortBy, setSortBy] = useState<SortBy>('date');

  async function load(nextFilters: EventFilters = filters) {
    setLoading(true);
    setError(null);
    setAppliedFilters(nextFilters);

    try {
      const data = await api.getEvents({
        sportType: nextFilters.sportType || undefined,
        level: nextFilters.level || undefined,
        format: nextFilters.format || undefined,
        location: nextFilters.location || undefined,
        dateFrom: nextFilters.dateFrom || undefined,
        dateTo: nextFilters.dateTo || undefined,
      });

      setEvents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Не вдалося завантажити події');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecommended() {
    setRecError(null);

    try {
      const res = await fetch('/api/proxy/events/recommended?limit=24');
      if (!res.ok) {
        if (res.status !== 401) setRecError('Не вдалося завантажити рекомендації');
        setRecommended([]);
        return;
      }

      const data = await res.json();
      setRecommended(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setRecError(e?.message ?? 'Не вдалося завантажити рекомендації');
    }
  }

  useEffect(() => {
    setRole(getCurrentRole());
    void load(emptyFilters);
    void loadRecommended();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayEvents = useMemo(() => sortEvents(events, sortBy), [events, sortBy]);

  const filteredRecommended = useMemo(() => {
    const filtered = recommended.filter((event) => eventMatchesFilters(event, appliedFilters));
    return sortEvents(filtered, sortBy).slice(0, 6);
  }, [recommended, appliedFilters, sortBy]);

  const appliedFilterLabels = useMemo(() => activeFilterLabels(appliedFilters), [appliedFilters]);

  const summary = useMemo(() => {
    const seats = events.reduce((sum, event) => sum + event.capacity, 0);
    const occupied = events.reduce((sum, event) => sum + (event.occupiedCount ?? 0), 0);
    const pending = events.reduce((sum, event) => sum + (event.pendingCount ?? 0), 0);

    return { seats, occupied, pending };
  }, [events]);

  const updateFilter = (key: keyof EventFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setSortBy('date');
    void load(emptyFilters);
  };

  return (
    <div className="page-shell">
      <AppHeader title="Каталог спортивних подій" subtitle="Пошук, рекомендації та реальна статистика місць" />

      <main className="page-shell">
        <section className="hero" style={{ padding: 24 }}>
          <div className="badge info" style={{ display: 'inline-flex' }}>Events marketplace</div>
          <h1 style={{ fontSize: '2.2rem' }}>Оберіть подію для участі або керування</h1>
          <p>
            Каталог показує не просто назви заходів, а фактичну завантаженість, кількість підтверджених
            учасників, заявок в очікуванні та наявність вільних місць. Це дозволяє одразу оцінити,
            наскільки подія заповнена і який сценарій участі можливий.
          </p>

          <div className="kpi-row organizer-kpis">
            <div className="kpi"><div className="muted">Подій у вибірці</div><div className="value">{events.length}</div></div>
            <div className="kpi"><div className="muted">Усього місць</div><div className="value">{summary.seats}</div></div>
            <div className="kpi"><div className="muted">Підтверджено</div><div className="value">{summary.occupied}</div></div>
            <div className="kpi"><div className="muted">Очікують</div><div className="value">{summary.pending}</div></div>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="card">
            <div className="card-body">
              <h2 className="section-title" style={{ marginTop: 0 }}>Пошук і фільтрація</h2>
              <p className="muted" style={{ marginTop: -4 }}>
                Фільтри застосовуються до загального списку подій і до блоку рекомендацій. Якщо користувач заповнив анкету «Мої інтереси», рекомендації додатково враховують його спортивний профіль. Тому під час демонстрації
                рекомендовані події не залишаються окремими «зайвими» картками над результатами пошуку.
              </p>

              <div className="form-grid">
                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Вид спорту</div>
                  <input
                    value={filters.sportType}
                    onChange={(e) => updateFilter('sportType', e.target.value)}
                    placeholder="Tennis, Football..."
                  />
                </label>

                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Рівень</div>
                  <select value={filters.level} onChange={(e) => updateFilter('level', e.target.value)}>
                    <option value="">Усі</option>
                    <option value="BEGINNER">Початковий</option>
                    <option value="INTERMEDIATE">Середній</option>
                    <option value="ADVANCED">Просунутий</option>
                  </select>
                </label>

                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Формат</div>
                  <select value={filters.format} onChange={(e) => updateFilter('format', e.target.value)}>
                    <option value="">Усі</option>
                    <option value="TRAINING">Тренування</option>
                    <option value="TOURNAMENT">Турнір</option>
                    <option value="SECTION">Секція</option>
                    <option value="MATCH">Матч</option>
                  </select>
                </label>

                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Локація</div>
                  <input
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                    placeholder="Kyiv, Vinnytsia..."
                  />
                </label>

                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Дата від</div>
                  <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
                </label>

                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Дата до</div>
                  <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
                </label>

                <label>
                  <div className="muted" style={{ marginBottom: 6 }}>Сортування</div>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                    <option value="date">За датою</option>
                    <option value="popularity">За популярністю</option>
                    <option value="availability">За вільними місцями</option>
                  </select>
                </label>
              </div>

              <div className="inline-actions">
                <button className="primary-btn" onClick={() => void load(filters)}>Застосувати</button>
                <button className="secondary-btn" onClick={resetFilters}>Скинути</button>
              </div>

              {hasActiveFilters(appliedFilters) ? (
                <div className="badges" style={{ marginTop: 14 }}>
                  <span className="badge info">Активні фільтри</span>
                  {appliedFilterLabels.map((label) => <span key={label} className="badge">{label}</span>)}
                </div>
              ) : (
                <div className="notice" style={{ marginTop: 14 }}>Фільтри не застосовано. Показано повний каталог подій.</div>
              )}
            </div>
          </div>
        </section>

        {recError ? <div className="error-box">{recError}</div> : null}

        {role === 'USER' && recommended.length > 0 ? (
          <section style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <h2 className="section-title" style={{ marginBottom: 6 }}>Рекомендовані події у поточній вибірці</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  Тут показано лише ті рекомендації, які відповідають застосованим фільтрам. Якщо фільтр звужує каталог,
                  цей блок звужується разом із ним.
                </p>
              </div>
              <span className="badge info">{filteredRecommended.length} із {recommended.length} рекомендацій</span>
            </div>

            {filteredRecommended.length === 0 ? (
              <div className="notice">
                За поточними фільтрами рекомендованих подій немає. Нижче показано загальні результати за тими самими фільтрами.
              </div>
            ) : (
              <div className="grid grid-2">
                {filteredRecommended.map((event) => {
                  const seats = seatSummary(event);

                  return (
                    <div key={event.id} className="card">
                      <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <a href={`/events/${event.id}`} style={{ fontWeight: 700, fontSize: 18 }}>{event.title}</a>
                          <span className="badge success">★ {event.recommendationScore ?? event.popularityScore ?? 0}</span>
                        </div>

                        <div className="muted" style={{ marginTop: 6 }}>{event.location} • {formatDateTime(event.startAt)}</div>
                        <p style={{ marginTop: 10 }}>{eventShortDescription(event)}</p>

                        <div className="badges">
                          {recommendationBadges(event).map((badge) => <span key={badge} className="badge info">{badge}</span>)}
                          <span className="badge">{event.sportType}</span>
                          <span className="badge">{levelLabel(event.level)}</span>
                          <span className="badge">{formatLabel(event.format)}</span>
                          <span className="badge">Підтверджено: {seats.confirmed}</span>
                          <span className="badge warning">Очікують: {seats.pending}</span>
                          <span className="badge success">Вільно: {seats.free}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 6 }}>Усі доступні події</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Основний список подій сформовано за тими самими параметрами пошуку та сортування.
              </p>
            </div>
            <span className="badge">Знайдено: {displayEvents.length}</span>
          </div>

          <div className="grid grid-2">
            {loading ? (
              <div className="notice">Завантаження...</div>
            ) : displayEvents.length === 0 ? (
              <div className="notice">За обраними фільтрами подій не знайдено.</div>
            ) : displayEvents.map((event) => {
              const seats = seatSummary(event);

              return (
                <div key={event.id} className="card">
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <a href={`/events/${event.id}`} style={{ fontWeight: 700, fontSize: 20 }}>{event.title}</a>
                        <div className="muted" style={{ marginTop: 6 }}>{event.location} • {formatDateTime(event.startAt)}</div>
                      </div>
                      <span className={`badge ${seats.free > 0 ? 'success' : 'warning'}`}>
                        {seats.free > 0 ? 'Є місця' : 'Лист очікування'}
                      </span>
                    </div>

                    <p style={{ marginTop: 12 }}>{eventShortDescription(event)}</p>

                    <div className="badges">
                      <span className="badge info">{event.sportType}</span>
                      <span className="badge">{levelLabel(event.level)}</span>
                      <span className="badge">{formatLabel(event.format)}</span>
                      <span className="badge success">Підтверджено: {seats.confirmed}/{event.capacity}</span>
                      <span className="badge warning">Очікують: {seats.pending}</span>
                      <span className="badge">Черга: {seats.waitlist}</span>
                      <span className="badge">👁 {event.views ?? 0}</span>
                    </div>

                    <div className="inline-actions">
                      <a className="primary-btn" href={`/events/${event.id}`}>Відкрити подію</a>
                      {(role === 'ORGANIZER' || role === 'ADMIN') ? (
                        <a className="secondary-btn" href={`/organizer/events/${event.id}/participants`}>Керувати заявками</a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
