export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCurrentRole(): UserRole | null {
  const role = getCookie('user_role');
  if (role === 'USER' || role === 'ORGANIZER' || role === 'ADMIN') return role;
  return null;
}

export function getCurrentName(): string | null {
  return getCookie('user_name');
}

export function roleHome(role: UserRole | null): string {
  if (role === 'ORGANIZER') return '/organizer/events';
  if (role === 'ADMIN') return '/analytics';
  return '/events';
}

export function bookingStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING': return 'Очікує підтвердження';
    case 'CONFIRMED': return 'Підтверджено';
    case 'CANCELED': return 'Скасовано';
    case 'ATTENDED': return 'Відвідано';
    default: return status;
  }
}

export function eventStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT': return 'Чернетка';
    case 'PUBLISHED': return 'Опубліковано';
    case 'CLOSED': return 'Закрито';
    case 'CANCELED': return 'Скасовано';
    default: return status;
  }
}

export function levelLabel(value: string): string {
  switch (value) {
    case 'BEGINNER': return 'Початковий';
    case 'INTERMEDIATE': return 'Середній';
    case 'ADVANCED': return 'Просунутий';
    default: return value;
  }
}

export function formatLabel(value: string): string {
  switch (value) {
    case 'TRAINING': return 'Тренування';
    case 'TOURNAMENT': return 'Турнір';
    case 'SECTION': return 'Секція';
    case 'MATCH': return 'Матч';
    default: return value;
  }
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'USER': return 'Користувач';
    case 'ORGANIZER': return 'Організатор';
    case 'ADMIN': return 'Адміністратор';
    default: return 'Гість';
  }
}


export function seatSummary(event: { capacity: number; confirmedCount?: number; attendedCount?: number; freeSeats?: number; pendingCount?: number; waitlistCount?: number }) {
  const confirmed = (event.confirmedCount ?? 0) + (event.attendedCount ?? 0);
  const free = event.freeSeats ?? Math.max(0, event.capacity - confirmed);
  return { confirmed, free, pending: event.pendingCount ?? 0, waitlist: event.waitlistCount ?? 0 };
}

export function eventShortDescription(event: { description?: string | null; sportType: string; format: string; level: string; location: string }) {
  if (event.description && event.description.trim()) return event.description.trim();
  return `Подія з виду спорту ${event.sportType.toLowerCase()} у форматі ${formatLabel(event.format).toLowerCase()} для рівня ${levelLabel(event.level).toLowerCase()} у ${event.location}.`;
}
