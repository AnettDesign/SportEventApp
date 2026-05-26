import type { BookingStatus } from './enums';
import type { EventDTO } from './event';

export type BookingDTO = {
  id: string;
  userId: string;
  eventId: string;
  status: BookingStatus;
  createdAt: string;
  checkedInAt?: string | null;
  rejectReason?: string | null;
};

export type BookingWithEventDTO = BookingDTO & { event: EventDTO };

export type CreateBookingDTO = {
  eventId: string;
};

export type WaitlistEntryDTO = {
  id: string;
  userId: string;
  eventId: string;
  position: number;
  createdAt: string;
};

export type WaitlistWithEventDTO = WaitlistEntryDTO & { event: EventDTO };
