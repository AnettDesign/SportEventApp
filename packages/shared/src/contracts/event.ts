import type { EventFormat, EventStatus, SkillLevel } from './enums';

export type EventDTO = {
  id: string;
  title: string;
  description?: string | null;
  sportType: string;
  level: SkillLevel;
  format: EventFormat;
  startAt: string;
  location: string;
  capacity: number;
  available: number;
  status: EventStatus;
  organizerId: string;
  organizer?: { id: string; name: string; email?: string };
  createdAt: string;
  updatedAt: string;
  views?: number;
  confirmedCount?: number;
  pendingCount?: number;
  attendedCount?: number;
  canceledCount?: number;
  waitlistCount?: number;
  occupiedCount?: number;
  freeSeats?: number;
  popularityScore?: number;
  recommendationScore?: number;
  recommendationReason?: {
    sportMatch?: boolean;
    locationMatch?: boolean;
    fallbackPopular?: boolean;
    levelMatch?: boolean;
    formatMatch?: boolean;
    capacityMatch?: boolean;
    profileUsed?: boolean;
    topSports?: string[];
    topLocations?: string[];
  };
};

export type CreateEventDTO = {
  title: string;
  description?: string | null;
  sportType: string;
  level: SkillLevel;
  format: EventFormat;
  startAt: string;
  location: string;
  capacity: number;
};

export type UpdateEventDTO = Partial<CreateEventDTO>;
