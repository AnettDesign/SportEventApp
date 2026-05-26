import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  BookingStatus,
  EventStatus,
  NotificationType,
} from '../generated/prisma/client';
import { stringify } from 'csv-stringify/sync';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type RequestUserLike = {
  sub: string;
  role: string;
};

type EventWithStatsInput = {
  capacity: number;
  available: number;
  views?: number | null;
  description?: string | null;
  bookings?: Array<{ status: string }>;
  _count?: { bookings?: number; waitlist?: number };
};

type ActivityLogPayload = {
  actorId?: string | null;
  eventId?: string | null;
  bookingId?: string | null;
  type: ActivityType;
  message: string;
  details?: string | null;
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  private withEventStats<T extends EventWithStatsInput>(event: T) {
    const bookings = event.bookings ?? [];

    const confirmedCount = bookings.filter((booking) => booking.status === BookingStatus.CONFIRMED).length;
    const attendedCount = bookings.filter((booking) => booking.status === BookingStatus.ATTENDED).length;
    const pendingCount = bookings.filter((booking) => booking.status === BookingStatus.PENDING).length;
    const canceledCount = bookings.filter((booking) => booking.status === BookingStatus.CANCELED).length;
    const occupiedCount = confirmedCount + attendedCount;
    const freeSeats = Math.max(0, event.capacity - occupiedCount);
    const waitlistCount = event._count?.waitlist ?? 0;
    const popularityScore =
      occupiedCount * 3 +
      pendingCount * 2 +
      waitlistCount * 2 +
      Math.floor((event.views ?? 0) / 5);

    return {
      ...event,
      available: freeSeats,
      confirmedCount,
      attendedCount,
      pendingCount,
      canceledCount,
      occupiedCount,
      freeSeats,
      waitlistCount,
      popularityScore,
    };
  }

  async create(organizerId: string, dto: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description?.trim() || null,
        sportType: dto.sportType,
        level: dto.level,
        format: dto.format,
        startAt: new Date(dto.startAt),
        location: dto.location,
        capacity: dto.capacity,
        available: dto.capacity,
        status: EventStatus.PUBLISHED,
        organizerId,
      } as any,
    });

    await this.logActivity({
      actorId: organizerId,
      eventId: event.id,
      type: ActivityType.EVENT_CREATED,
      message: `Створено подію «${event.title}».`,
      details: `Локація: ${event.location}; дата: ${event.startAt.toISOString()}`,
    });

    return event;
  }

  async recommendedForUser(userId: string, limit = 6) {
    const profile = await this.prisma.userSportProfile.findUnique({ where: { userId } });
    const bookings = await this.prisma.booking.findMany({
      where: {
        userId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.ATTENDED] },
      },
      include: { event: { select: { sportType: true, location: true, level: true, format: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const sportCount = new Map<string, number>();
    const locCount = new Map<string, number>();

    if (profile?.favoriteSport) sportCount.set(profile.favoriteSport, 5);
    if (profile?.preferredLocation) locCount.set(profile.preferredLocation, 4);

    for (const booking of bookings) {
      if (booking.event?.sportType) {
        sportCount.set(booking.event.sportType, (sportCount.get(booking.event.sportType) ?? 0) + 1);
      }
      if (booking.event?.location) {
        locCount.set(booking.event.location, (locCount.get(booking.event.location) ?? 0) + 1);
      }
    }

    const topSports = [...sportCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key]) => key);

    const topLocations = [...locCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);

    const hasProfile = topSports.length > 0 || topLocations.length > 0 || !!profile?.level || !!profile?.preferredFormat;

    const bookedEventIds = new Set(
      (
        await this.prisma.booking.findMany({
          where: {
            userId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.ATTENDED] },
          },
          select: { eventId: true },
        })
      ).map((item) => item.eventId),
    );

    const now = new Date();

    const profileOr = [
      ...topSports.map((sport) => ({ sportType: { contains: sport } })),
      ...topLocations.map((location) => ({ location: { contains: location } })),
      profile?.level ? { level: profile.level as any } : undefined,
      profile?.preferredFormat ? { format: profile.preferredFormat as any } : undefined,
    ].filter(Boolean) as any[];

    const candidates = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startAt: { gte: now },
        ...(hasProfile && profileOr.length ? { OR: profileOr } : {}),
      },
      include: {
        bookings: { select: { status: true } },
        _count: { select: { waitlist: true } },
      },
      take: 100,
    });

    const scored = candidates
      .filter((event) => !bookedEventIds.has(event.id))
      .map((event) => {
        const eventWithStats = this.withEventStats(event);
        const sportMatch = topSports.some((sport) => eventWithStats.sportType.toLowerCase().includes(sport.toLowerCase())) ? 12 : 0;
        const locMatch = topLocations.some((location) => eventWithStats.location.toLowerCase().includes(location.toLowerCase())) ? 8 : 0;
        const levelMatch = profile?.level === eventWithStats.level ? 6 : 0;
        const formatMatch = profile?.preferredFormat === eventWithStats.format ? 4 : 0;
        const capacityMatch = profile?.maxParticipants && eventWithStats.capacity <= profile.maxParticipants ? 3 : 0;
        const days = Math.max(0, (new Date(eventWithStats.startAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const freshness = Math.max(0, 7 - days);
        const viewsBoost = Math.floor((eventWithStats.views ?? 0) / 5);
        const recommendationScore = sportMatch + locMatch + levelMatch + formatMatch + capacityMatch + eventWithStats.popularityScore + freshness + viewsBoost;

        return {
          ...eventWithStats,
          recommendationScore,
          recommendationReason: {
            sportMatch: sportMatch > 0,
            locationMatch: locMatch > 0,
            levelMatch: levelMatch > 0,
            formatMatch: formatMatch > 0,
            capacityMatch: capacityMatch > 0,
            profileUsed: !!profile,
            topSports,
            topLocations,
          },
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit);

    if (scored.length >= limit) return scored;

    const fallback = await this.prisma.event.findMany({
      where: { status: EventStatus.PUBLISHED, startAt: { gte: now } },
      include: {
        bookings: { select: { status: true } },
        _count: { select: { waitlist: true } },
      },
      take: 100,
    });

    const fallbackScored = fallback
      .filter((event) => !bookedEventIds.has(event.id))
      .map((event) => {
        const eventWithStats = this.withEventStats(event);
        const viewsBoost = Math.floor((eventWithStats.views ?? 0) / 5);

        return {
          ...eventWithStats,
          recommendationScore: eventWithStats.popularityScore + viewsBoost,
          recommendationReason: {
            sportMatch: false,
            locationMatch: false,
            levelMatch: false,
            formatMatch: false,
            capacityMatch: false,
            profileUsed: !!profile,
            topSports: [],
            topLocations: [],
            fallbackPopular: true,
          },
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore);

    const merged = [...scored];
    for (const item of fallbackScored) {
      if (merged.length >= limit) break;
      if (!merged.some((candidate) => candidate.id === item.id)) merged.push(item);
    }

    return merged;
  }

  async exportBookingsCsv(eventId: string, requesterId: string, requesterRole: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, organizerId: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (requesterRole !== 'ADMIN' && event.organizerId !== requesterId) {
      throw new ForbiddenException('Forbidden');
    }

    const bookings = await this.prisma.booking.findMany({
      where: { eventId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const records = bookings.map((booking) => ({
      name: booking.user.name,
      email: booking.user.email,
      status: booking.status,
      rejectReason: booking.rejectReason ?? '',
      createdAt: booking.createdAt.toISOString(),
    }));

    return stringify(records, {
      header: true,
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
        { key: 'status', header: 'Status' },
        { key: 'rejectReason', header: 'Reject Reason' },
        { key: 'createdAt', header: 'Booked At' },
      ],
    });
  }

  async checkInBooking(eventId: string, bookingId: string, requesterId: string, requesterRole: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true, title: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (requesterRole !== 'ADMIN' && event.organizerId !== requesterId) {
      throw new ForbiddenException('Forbidden');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!booking || booking.eventId !== eventId) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELED) throw new BadRequestException('Cannot mark attendance for canceled booking');
    if (booking.status === BookingStatus.ATTENDED) throw new BadRequestException('Attendance is already marked');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed bookings can be marked as attended');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ATTENDED, checkedInAt: new Date() },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    await this.prisma.notification.create({
      data: {
        userId: updated.user.id,
        type: NotificationType.CHECKED_IN,
        title: 'Вас відмічено на події',
        message: `Для вас зафіксовано присутність на події «${event.title}».`,
        eventId,
        bookingId,
      },
    });

    await this.logActivity({
      actorId: requesterId,
      eventId,
      bookingId,
      type: ActivityType.CHECKED_IN,
      message: `Для користувача ${updated.user.name} зафіксовано присутність на події «${event.title}».`,
    });

    return updated;
  }

  async addView(eventId: string) {
    const exists = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Event not found');

    return this.prisma.event.update({
      where: { id: eventId },
      data: { views: { increment: 1 } },
      select: { id: true, views: true },
    });
  }

  async findAll(params: {
    sportType?: string;
    level?: string;
    format?: string;
    location?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const startAtFilter =
      params.dateFrom || params.dateTo
        ? {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
          }
        : undefined;

    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        ...(params.sportType ? { sportType: { contains: params.sportType } } : {}),
        ...(params.level ? { level: params.level as any } : {}),
        ...(params.format ? { format: params.format as any } : {}),
        ...(params.location ? { location: { contains: params.location } } : {}),
        ...(startAtFilter ? { startAt: startAtFilter } : {}),
      },
      include: {
        bookings: { select: { status: true } },
        _count: { select: { waitlist: true } },
      },
    });

    return events
      .map((event) => this.withEventStats(event))
      .sort(
        (a, b) =>
          b.popularityScore - a.popularityScore ||
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  }

  async listWaitlist(eventId: string, requesterId: string, requesterRole: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (requesterRole !== 'ADMIN' && event.organizerId !== requesterId) {
      throw new ForbiddenException('Forbidden');
    }

    return this.prisma.waitlistEntry.findMany({
      where: { eventId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async listBookings(eventId: string, requesterId: string, requesterRole: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (requesterRole !== 'ADMIN' && event.organizerId !== requesterId) {
      throw new ForbiddenException('Forbidden');
    }

    return this.prisma.booking.findMany({
      where: { eventId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        event: { select: { id: true, title: true, available: true, capacity: true } },
      },
    });
  }

  async listActivity(eventId: string, requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN') {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { organizerId: true },
      });

      if (!event) throw new NotFoundException('Event not found');
      if (event.organizerId !== requesterId) throw new ForbiddenException('Forbidden');
    }

    return this.prisma.activityLog.findMany({
      where: { eventId },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async recentActivity(limit = 20) {
    return this.prisma.activityLog.findMany({
      include: {
        actor: { select: { name: true, role: true } },
        event: { select: { title: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listMy(userId: string, role: string) {
    const events = await this.prisma.event.findMany({
      where: role === 'ADMIN' ? undefined : { organizerId: userId },
      include: {
        bookings: { select: { status: true } },
        _count: { select: { waitlist: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return events.map((event) => this.withEventStats(event));
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        bookings: { select: { status: true } },
        _count: { select: { waitlist: true } },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    return this.withEventStats(event);
  }

  async analyticsOverview() {
    const [events, bookings, users, activity] = await Promise.all([
      this.prisma.event.findMany({
        include: {
          bookings: { select: { status: true } },
          _count: { select: { waitlist: true } },
        },
      }),
      this.prisma.booking.findMany({
        include: { event: { select: { sportType: true, location: true } } },
      }),
      this.prisma.user.findMany({ select: { role: true } }),
      this.recentActivity(12),
    ]);

    const mapped = events.map((event) => this.withEventStats(event));

    const bySport = mapped.reduce<Record<string, number>>((acc, event) => {
      acc[event.sportType] = (acc[event.sportType] ?? 0) + 1;
      return acc;
    }, {});

    const byLocation = mapped.reduce<Record<string, number>>((acc, event) => {
      acc[event.location] = (acc[event.location] ?? 0) + 1;
      return acc;
    }, {});

    const bookingByDay = bookings.reduce<Record<string, number>>((acc, booking) => {
      const key = new Date(booking.createdAt).toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const usersByRole = users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totals: {
        events: mapped.length,
        bookings: bookings.length,
        occupied: mapped.reduce((sum, event) => sum + event.occupiedCount, 0),
        pending: mapped.reduce((sum, event) => sum + event.pendingCount, 0),
        waitlist: mapped.reduce((sum, event) => sum + event.waitlistCount, 0),
      },
      bySport,
      byLocation,
      bookingByDay,
      usersByRole,
      topEvents: mapped
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, 5),
      activity,
    };
  }

  async update(id: string, dto: UpdateEventDto, user: RequestUserLike) {
    await this.assertCanManage(id, user);

    const existing = await this.prisma.event.findUnique({
      where: { id },
      include: { bookings: { select: { status: true } } },
    });

    if (!existing) throw new NotFoundException('Event not found');

    const occupiedCount = existing.bookings.filter(
      (booking) => booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.ATTENDED,
    ).length;

    const nextCapacity = dto.capacity ?? existing.capacity;
    if (nextCapacity < occupiedCount) {
      throw new BadRequestException(`Capacity cannot be less than occupied seats (${occupiedCount})`);
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        available: nextCapacity - occupiedCount,
      } as any,
    });

    await this.logActivity({
      actorId: user.sub,
      eventId: id,
      type: ActivityType.EVENT_UPDATED,
      message: `Оновлено подію «${updated.title}».`,
    });

    const participantIds = await this.prisma.booking.findMany({
      where: {
        eventId: id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ATTENDED] },
      },
      select: { userId: true },
    });

    if (participantIds.length) {
      await this.prisma.notification.createMany({
        data: participantIds.map((participant) => ({
          userId: participant.userId,
          type: NotificationType.EVENT_UPDATED,
          title: 'Подію оновлено',
          message: `Організатор оновив дані події «${updated.title}». Перевірте нові параметри.`,
          eventId: id,
        })),
      });
    }

    return updated;
  }

  async remove(id: string, user: RequestUserLike) {
    await this.assertCanManage(id, user);

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELED },
    });

    await this.logActivity({
      actorId: user.sub,
      eventId: id,
      type: ActivityType.EVENT_CANCELED,
      message: `Подію «${updated.title}» скасовано.`,
    });

    const participantIds = await this.prisma.booking.findMany({
      where: {
        eventId: id,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ATTENDED] },
      },
      select: { userId: true },
    });

    if (participantIds.length) {
      await this.prisma.notification.createMany({
        data: participantIds.map((participant) => ({
          userId: participant.userId,
          type: NotificationType.EVENT_CANCELED,
          title: 'Подію скасовано',
          message: `Подію «${updated.title}» було скасовано організатором або адміністратором.`,
          eventId: id,
        })),
      });
    }

    return updated;
  }

  async assertCanManage(eventId: string, user: RequestUserLike) {
    if (user.role === 'ADMIN') return;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== user.sub) throw new ForbiddenException('You cannot manage this event');
  }

  private async logActivity(data: ActivityLogPayload) {
    await this.prisma.activityLog.create({
      data: {
        type: data.type,
        message: data.message,
        ...(data.details ? { details: data.details } : {}),
        ...(data.actorId ? { actorId: data.actorId } : {}),
        ...(data.eventId ? { eventId: data.eventId } : {}),
        ...(data.bookingId ? { bookingId: data.bookingId } : {}),
      },
    });
  }
}
