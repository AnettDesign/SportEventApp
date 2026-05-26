import type {
  CreateBookingDTO,
  CreateEventDTO,
  EventDTO,
  UpdateEventDTO,
  BookingWithEventDTO,
  Role,
} from '../index';
import { http } from './http';

export type AuthUserDTO = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type AuthResponseDTO = {
  user: AuthUserDTO;
  accessToken: string;
};

export type EventsQuery = {
  sportType?: string;
  level?: string;
  format?: string;
  location?: string;
  dateFrom?: string; // ISO або YYYY-MM-DD
  dateTo?: string;
};

export function createApiClient(opts?: { baseUrl?: string }) {
  const baseUrl = opts?.baseUrl ?? '';

  return {
    // -------- Auth --------
    register: (data: { email: string; name: string; password: string; role?: Role }) =>
      http<AuthResponseDTO>('/api/auth/register', { method: 'POST', baseUrl, body: data }),

    login: (data: { email: string; password: string }) =>
      http<AuthResponseDTO>('/api/auth/login', { method: 'POST', baseUrl, body: data }),

    // -------- Events --------
    getEvents: (query?: EventsQuery) =>
      http<EventDTO[]>('/api/events', { method: 'GET', baseUrl, query }),

    getEvent: (id: string) =>
      http<EventDTO>(`/api/events/${id}`, { method: 'GET', baseUrl }),

    createEvent: (data: CreateEventDTO, token: string) =>
      http<EventDTO>('/api/events', { method: 'POST', baseUrl, token, body: data }),

    updateEvent: (id: string, data: UpdateEventDTO, token: string) =>
      http<EventDTO>(`/api/events/${id}`, { method: 'PATCH', baseUrl, token, body: data }),

    deleteEvent: (id: string, token: string) =>
      http<EventDTO>(`/api/events/${id}`, { method: 'DELETE', baseUrl, token }),

    // -------- Bookings --------
    bookEvent: (data: CreateBookingDTO, token: string) =>
      http<{ id: string; status: string; eventId: string; userId: string }>('/api/bookings', {
        method: 'POST',
        baseUrl,
        token,
        body: data,
      }),

    cancelBooking: (data: CreateBookingDTO, token: string) =>
      http<{ id: string; status: string; eventId: string; userId: string }>('/api/bookings/cancel', {
        method: 'POST',
        baseUrl,
        token,
        body: data,
      }),

    myBookings: (token: string) =>
      http<BookingWithEventDTO[]>('/api/bookings/my', { method: 'GET', baseUrl, token }),
  };
}