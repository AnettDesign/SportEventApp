import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async listByUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        event: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async listWaitlistByUser(userId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { userId },
      include: {
        event: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createBookingOrWaitlist(userId: string, eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });
      const existingBooking = await tx.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
        select: { id: true, status: true },
      });

      if (existingBooking && existingBooking.status !== 'CANCELED') {
        return { kind: 'ALREADY_BOOKED', booking: existingBooking };
      }

      const existingWait = await tx.waitlistEntry.findUnique({
        where: { userId_eventId: { userId, eventId } },
        select: { id: true, position: true },
      });

      if (existingWait) {
        return { kind: 'ALREADY_WAITLISTED', waitlist: existingWait };
      }

      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, title: true, available: true, status: true, startAt: true, organizerId: true },
      });

      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== 'PUBLISHED') throw new ConflictException('Event is not available');
      if (new Date(event.startAt).getTime() <= Date.now()) throw new ConflictException('Event has already started');

      if (event.available > 0) {
        const booking = await tx.booking.upsert({
          where: { userId_eventId: { userId, eventId } },
          update: { status: 'PENDING', checkedInAt: null, rejectReason: null },
          create: { userId, eventId, status: 'PENDING' },
          include: {
            event: { select: { id: true, title: true, location: true, startAt: true } },
          },
        });

        await tx.notification.create({
          data: {
            userId,
            type: 'BOOKING_REQUESTED',
            title: 'Заявку подано',
            message: `Вашу заявку на подію «${event.title}» подано й очікує підтвердження.`,
            eventId,
            bookingId: booking.id,
          },
        });
        await this.logActivity(tx, {
          actorId: userId,
          eventId,
          bookingId: booking.id,
          type: 'BOOKING_REQUESTED',
          message: `${user?.name ?? 'User'} подав(ла) заявку на подію «${event.title}».`,
        });

        return { kind: 'REQUESTED', booking };
      }

      const last = await tx.waitlistEntry.findFirst({
        where: { eventId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const position = (last?.position ?? 0) + 1;

      const waitlist = await tx.waitlistEntry.create({
        data: { userId, eventId, position },
      });

      await tx.notification.create({
        data: {
          userId,
          type: 'WAITLISTED',
          title: 'Додано до листа очікування',
          message: `На подію «${event.title}» немає місць. Ви додані до листа очікування на позицію #${position}.`,
          eventId,
        },
      });
      await this.logActivity(tx, {
        actorId: userId,
        eventId,
        type: 'WAITLISTED',
        message: `${user?.name ?? 'User'} доданий(а) до листа очікування події «${event.title}» (позиція #${position}).`,
      });

      return { kind: 'WAITLISTED', waitlist };
    });
  }

  async cancelBooking(userId: string, eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
        include: { event: { select: { title: true } }, user: { select: { name: true } } },
      });

      if (!booking || booking.status === 'CANCELED') return { kind: 'NO_ACTIVE_BOOKING' };
      if (booking.status === 'ATTENDED') throw new BadRequestException('Cannot cancel attended booking');

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELED', checkedInAt: null },
      });

      await tx.notification.create({
        data: {
          userId,
          type: 'EVENT_UPDATED',
          title: 'Заявку скасовано',
          message: `Вашу заявку на подію «${booking.event.title}» скасовано.`,
          eventId,
          bookingId: booking.id,
        },
      });
      await this.logActivity(tx, {
        actorId: userId,
        eventId,
        bookingId: booking.id,
        type: 'BOOKING_CANCELED',
        message: `${booking.user.name} скасував(ла) свою заявку на подію «${booking.event.title}».`,
      });

      if (booking.status === 'CONFIRMED') {
        await tx.event.update({ where: { id: eventId }, data: { available: { increment: 1 } } });
        await this.promoteFirstWaitlist(tx, eventId);
      }

      return { kind: 'CANCELED', releasedSeat: booking.status === 'CONFIRMED' };
    });
  }

  async approveBooking(bookingId: string, requesterId: string, requesterRole: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          event: { select: { id: true, title: true, organizerId: true, available: true, status: true } },
        },
      });

      if (!booking) throw new NotFoundException('Booking not found');
      this.assertCanManage(booking.event.organizerId, requesterId, requesterRole);

      if (booking.status === 'CANCELED') throw new BadRequestException('Canceled request cannot be approved');
      if (booking.status === 'ATTENDED') throw new BadRequestException('Attended booking cannot be changed');
      if (booking.status === 'CONFIRMED') return { kind: 'ALREADY_APPROVED', booking };
      if (booking.event.status !== 'PUBLISHED') throw new ConflictException('Event is not available');
      if (booking.event.available <= 0) throw new ConflictException('No free seats available');

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED', rejectReason: null },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });

      await tx.event.update({ where: { id: booking.event.id }, data: { available: { decrement: 1 } } });
      await tx.notification.create({
        data: {
          userId: booking.user.id,
          type: 'BOOKING_CONFIRMED',
          title: 'Заявку підтверджено',
          message: `Вашу заявку на подію «${booking.event.title}» підтверджено. Місце заброньовано.`,
          eventId: booking.event.id,
          bookingId,
        },
      });
      await this.logActivity(tx, {
        actorId: requesterId,
        eventId: booking.event.id,
        bookingId,
        type: 'BOOKING_CONFIRMED',
        message: `Заявку користувача ${booking.user.name} підтверджено для події «${booking.event.title}».`,
      });

      return { kind: 'APPROVED', booking: updated };
    });
  }

  async rejectBooking(bookingId: string, requesterId: string, requesterRole: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          event: { select: { id: true, title: true, organizerId: true } },
        },
      });

      if (!booking) throw new NotFoundException('Booking not found');
      this.assertCanManage(booking.event.organizerId, requesterId, requesterRole);

      if (booking.status === 'ATTENDED') throw new BadRequestException('Attended booking cannot be rejected');
      if (booking.status === 'CANCELED') return { kind: 'ALREADY_REJECTED', booking };

      const wasConfirmed = booking.status === 'CONFIRMED';
      const rejectReason = reason?.trim() || null;

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELED', checkedInAt: null, rejectReason },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });

      if (wasConfirmed) {
        await tx.event.update({ where: { id: booking.event.id }, data: { available: { increment: 1 } } });
        await this.promoteFirstWaitlist(tx, booking.event.id);
      }

      await tx.notification.create({
        data: {
          userId: booking.user.id,
          type: 'BOOKING_REJECTED',
          title: 'Заявку відхилено',
          message: rejectReason
            ? `Вашу заявку на подію «${booking.event.title}» відхилено. Причина: ${rejectReason}`
            : `Вашу заявку на подію «${booking.event.title}» відхилено організатором.`,
          eventId: booking.event.id,
          bookingId,
        },
      });
      await this.logActivity(tx, {
        actorId: requesterId,
        eventId: booking.event.id,
        bookingId,
        type: 'BOOKING_REJECTED',
        message: `Заявку користувача ${booking.user.name} відхилено для події «${booking.event.title}».`,
        details: rejectReason,
      });

      return { kind: 'REJECTED', booking: updated, releasedSeat: wasConfirmed };
    });
  }

  private async promoteFirstWaitlist(tx: PrismaService | any, eventId: string) {
    const first = await tx.waitlistEntry.findFirst({ where: { eventId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    if (!first) return null;

    const event = await tx.event.findUnique({ where: { id: eventId }, select: { title: true } });
    const user = await tx.user.findUnique({ where: { id: first.userId }, select: { name: true } });

    const booking = await tx.booking.upsert({
      where: { userId_eventId: { userId: first.userId, eventId } },
      update: { status: 'PENDING', checkedInAt: null, rejectReason: null },
      create: { userId: first.userId, eventId, status: 'PENDING' },
    });

    await tx.waitlistEntry.delete({ where: { id: first.id } });
    const remaining = await tx.waitlistEntry.findMany({ where: { eventId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
    for (const [index, item] of remaining.entries()) {
      await tx.waitlistEntry.update({ where: { id: item.id }, data: { position: index + 1 } });
    }

    await tx.notification.create({
      data: {
        userId: first.userId,
        type: 'BOOKING_REQUESTED',
        title: 'Ви вийшли з черги очікування',
        message: `Для події «${event?.title ?? 'подія'}» звільнилося місце. Ваша заявка тепер очікує підтвердження організатора.`,
        eventId,
        bookingId: booking.id,
      },
    });
    await this.logActivity(tx, {
      actorId: first.userId,
      eventId,
      bookingId: booking.id,
      type: 'WAITLISTED',
      message: `${user?.name ?? 'User'} переведений(а) з листа очікування у статус «Очікує підтвердження».`,
    });

    return booking;
  }

  private assertCanManage(organizerId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === 'ADMIN') return;
    if (organizerId !== requesterId) throw new ForbiddenException('Forbidden');
  }

  private async logActivity(tx: any, data: { actorId?: string | null; eventId?: string | null; bookingId?: string | null; type: string; message: string; details?: string | null }) {
    await tx.activityLog.create({ data });
  }
}
