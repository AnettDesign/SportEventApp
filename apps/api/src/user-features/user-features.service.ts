import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, EventStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const skillLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const eventFormats = ['TRAINING', 'TOURNAMENT', 'SECTION', 'MATCH'];
const requestStatuses = ['OPEN', 'PLANNED', 'CLOSED'];
const voteTypes = ['DATE', 'LOCATION', 'TIME'];

type VoteGroup = {
  type: string;
  value: string;
  count: number;
  users: string[];
  comments: string[];
};

function clean(value: unknown) {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  return trimmed.length ? trimmed : undefined;
}

function requireEnum(value: unknown, allowed: string[], field: string) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }

  return value;
}

@Injectable()
export class UserFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userSportProfile.findUnique({
      where: { userId },
    });

    return profile ?? null;
  }

  async saveProfile(userId: string, body: any) {
    const favoriteSport = clean(body?.favoriteSport) ?? null;
    const preferredLocation = clean(body?.preferredLocation) ?? null;
    const preferredTime = clean(body?.preferredTime) ?? null;
    const notes = clean(body?.notes) ?? null;

    const maxParticipants =
      body?.maxParticipants === '' ||
      body?.maxParticipants === undefined ||
      body?.maxParticipants === null
        ? null
        : Number(body.maxParticipants);

    if (maxParticipants !== null && (!Number.isFinite(maxParticipants) || maxParticipants < 1)) {
      throw new BadRequestException('Max participants must be a positive number');
    }

    const level = body?.level ? requireEnum(body.level, skillLevels, 'level') : null;

    const preferredFormat = body?.preferredFormat
      ? requireEnum(body.preferredFormat, eventFormats, 'preferredFormat')
      : null;

    return this.prisma.userSportProfile.upsert({
      where: { userId },
      update: {
        favoriteSport,
        preferredLocation,
        preferredTime,
        notes,
        maxParticipants,
        level: level as any,
        preferredFormat: preferredFormat as any,
      },
      create: {
        userId,
        favoriteSport,
        preferredLocation,
        preferredTime,
        notes,
        maxParticipants,
        level: level as any,
        preferredFormat: preferredFormat as any,
      },
    });
  }

  async createEventRequest(userId: string, body: any) {
    const sportType = clean(body?.sportType);
    const location = clean(body?.location);

    if (!sportType) {
      throw new BadRequestException('Sport type is required');
    }

    if (!location) {
      throw new BadRequestException('Location is required');
    }

    const level = requireEnum(body?.level, skillLevels, 'level');
    const format = requireEnum(body?.format, eventFormats, 'format');
    const preferredDate = clean(body?.preferredDate);
    const comment = clean(body?.comment) ?? null;

    return this.prisma.eventRequest.create({
      data: {
        userId,
        sportType,
        location,
        level: level as any,
        format: format as any,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async listMyEventRequests(userId: string) {
    return this.prisma.eventRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listEventRequests() {
    return this.prisma.eventRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 80,
    });
  }

  async updateEventRequestStatus(id: string, status: string) {
    const nextStatus = requireEnum(status, requestStatuses, 'status');

    return this.prisma.eventRequest.update({
      where: { id },
      data: {
        status: nextStatus as any,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async listEventReviews(eventId: string) {
    const [reviews, aggregate] = await Promise.all([
      this.prisma.eventReview.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.eventReview.aggregate({
        where: { eventId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      averageRating: aggregate._avg.rating ?? 0,
      count: aggregate._count.rating,
      reviews,
    };
  }

  async createReview(userId: string, eventId: string, body: any) {
    const booking = await this.prisma.booking.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!booking || booking.status !== BookingStatus.ATTENDED) {
      throw new ForbiddenException('Оцінити можна лише подію зі статусом «Відвідано».');
    }

    const rating = Number(body?.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be an integer from 1 to 5');
    }

    return this.prisma.eventReview.upsert({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      update: {
        rating,
        comment: clean(body?.comment) ?? null,
        recommend: Boolean(body?.recommend ?? true),
        bookingId: booking.id,
      },
      create: {
        userId,
        eventId,
        bookingId: booking.id,
        rating,
        comment: clean(body?.comment) ?? null,
        recommend: Boolean(body?.recommend ?? true),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async saveDemandVote(userId: string, eventId: string, body: any) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status === EventStatus.CANCELED) {
      throw new BadRequestException('Cannot vote for canceled event');
    }

    const type = requireEnum(body?.type, voteTypes, 'type');
    const value = clean(body?.value);

    if (!value) {
      throw new BadRequestException('Vote value is required');
    }

    return this.prisma.eventDemandVote.upsert({
      where: {
        userId_eventId_type: {
          userId,
          eventId,
          type: type as any,
        },
      },
      update: {
        value,
        comment: clean(body?.comment) ?? null,
      },
      create: {
        userId,
        eventId,
        type: type as any,
        value,
        comment: clean(body?.comment) ?? null,
      },
    });
  }

  async voteSummaryForEvent(eventId: string) {
    const votes = await this.prisma.eventDemandVote.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.groupVotes(votes);
  }

  async organizerDemandSummary(userId: string, role: string) {
    const events = await this.prisma.event.findMany({
      where: role === 'ADMIN' ? undefined : { organizerId: userId },
      select: {
        id: true,
        title: true,
        demandVotes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { startAt: 'asc' },
      take: 80,
    });

    return events
      .map((event) => ({
        event: {
          id: event.id,
          title: event.title,
        },
        items: this.groupVotes(event.demandVotes),
      }))
      .filter((entry) => entry.items.length > 0);
  }

  private groupVotes(votes: any[]): VoteGroup[] {
    const map = new Map<string, VoteGroup>();

    for (const vote of votes) {
      const type = String(vote.type);
      const value = String(vote.value);
      const key = `${type}::${value}`;

      const item =
        map.get(key) ??
        ({
          type,
          value,
          count: 0,
          users: [] as string[],
          comments: [] as string[],
        } satisfies VoteGroup);

      item.count += 1;

      const userName = vote.user?.name ? String(vote.user.name) : '';

      if (userName && !item.users.includes(userName)) {
        item.users.push(userName);
      }

      if (vote.comment) {
        item.comments.push(String(vote.comment));
      }

      map.set(key, item);
    }

    return [...map.values()].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }
}