import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), 'apps/api/.env') });

import {
  PrismaClient,
  Role,
  SkillLevel,
  EventFormat,
  EventStatus,
  BookingStatus,
  DemandVoteType,
  EventRequestStatus,
} from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcrypt';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.eventDemandVote.deleteMany();
  await prisma.eventReview.deleteMany();
  await prisma.eventRequest.deleteMany();
  await prisma.userSportProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);
  const [admin, organizer, user1, user2, user3] = await Promise.all([
    prisma.user.create({ data: { email: 'admin@test.com', name: 'System Admin', role: Role.ADMIN, passwordHash } }),
    prisma.user.create({ data: { email: 'organizer@test.com', name: 'Olena Organizer', role: Role.ORGANIZER, passwordHash } }),
    prisma.user.create({ data: { email: 'u1@test.com', name: 'Andrii User', role: Role.USER, passwordHash } }),
    prisma.user.create({ data: { email: 'u2@test.com', name: 'Iryna User', role: Role.USER, passwordHash } }),
    prisma.user.create({ data: { email: 'u3@test.com', name: 'Maksym User', role: Role.USER, passwordHash } }),
  ]);

  const now = Date.now();
  const days = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);

  const events = await Promise.all([
    prisma.event.create({ data: { title: 'Vinnytsia Tennis Open', description: 'Міський турнір для гравців середнього рівня. Учасники проходять реєстрацію, жеребкування та серію матчів за олімпійською системою.', sportType: 'Tennis', level: SkillLevel.INTERMEDIATE, format: EventFormat.TOURNAMENT, startAt: days(3), location: 'Vinnytsia', capacity: 16, available: 15, status: EventStatus.PUBLISHED, views: 34, organizerId: organizer.id } }),
    prisma.event.create({ data: { title: 'Kyiv Morning Football', description: 'Ранкове тренування з мініфутболу для початківців. Основний акцент — командна взаємодія, розминка та контроль м’яча.', sportType: 'Football', level: SkillLevel.BEGINNER, format: EventFormat.TRAINING, startAt: days(5), location: 'Kyiv', capacity: 20, available: 19, status: EventStatus.PUBLISHED, views: 49, organizerId: organizer.id } }),
    prisma.event.create({ data: { title: 'Lviv Boxing Match Day', description: 'Серія контрольних спарингів для досвідчених спортсменів. Передбачено зважування, інструктаж та ведення протоколу боїв.', sportType: 'Boxing', level: SkillLevel.ADVANCED, format: EventFormat.MATCH, startAt: days(7), location: 'Lviv', capacity: 10, available: 9, status: EventStatus.PUBLISHED, views: 18, organizerId: organizer.id } }),
    prisma.event.create({ data: { title: 'Kyiv Evening Tennis Section', description: 'Вечірня секція для регулярних тренувань з тенісу. Підійде для новачків, які хочуть стабільний графік занять у невеликих групах.', sportType: 'Tennis', level: SkillLevel.BEGINNER, format: EventFormat.SECTION, startAt: days(9), location: 'Kyiv', capacity: 16, available: 15, status: EventStatus.PUBLISHED, views: 27, organizerId: organizer.id } }),
  ]);

  const bookings = await prisma.$transaction([
    prisma.booking.create({ data: { userId: user1.id, eventId: events[0].id, status: BookingStatus.CONFIRMED } }),
    prisma.booking.create({ data: { userId: user2.id, eventId: events[0].id, status: BookingStatus.PENDING } }),
    prisma.booking.create({ data: { userId: user3.id, eventId: events[1].id, status: BookingStatus.CONFIRMED } }),
    prisma.booking.create({ data: { userId: user1.id, eventId: events[2].id, status: BookingStatus.CANCELED, rejectReason: 'Необхідно підтвердити медичну довідку.' } }),
    prisma.booking.create({ data: { userId: user2.id, eventId: events[3].id, status: BookingStatus.ATTENDED, checkedInAt: new Date() } }),
  ]);

  await prisma.waitlistEntry.createMany({ data: [{ userId: user1.id, eventId: events[1].id, position: 1 }] });

  await prisma.userSportProfile.createMany({
    data: [
      { userId: user1.id, favoriteSport: 'Tennis', level: SkillLevel.INTERMEDIATE, preferredFormat: EventFormat.TOURNAMENT, preferredLocation: 'Vinnytsia', maxParticipants: 20, preferredTime: 'Вечір або вихідні', notes: 'Цікавлять невеликі групи та турніри аматорського рівня.' },
      { userId: user2.id, favoriteSport: 'Tennis', level: SkillLevel.BEGINNER, preferredFormat: EventFormat.SECTION, preferredLocation: 'Kyiv', maxParticipants: 16, preferredTime: 'Після 18:00' },
    ],
  });

  await prisma.eventRequest.createMany({
    data: [
      { userId: user1.id, sportType: 'Swimming', level: SkillLevel.BEGINNER, format: EventFormat.TRAINING, location: 'Vinnytsia', preferredDate: days(14), comment: 'Хочу групове тренування з плавання для початківців.', status: EventRequestStatus.OPEN },
      { userId: user2.id, sportType: 'Tennis', level: SkillLevel.BEGINNER, format: EventFormat.SECTION, location: 'Kyiv', preferredDate: days(11), comment: 'Було б зручно мати ще одну вечірню секцію.', status: EventRequestStatus.PLANNED },
    ],
  });

  await prisma.eventReview.create({
    data: { userId: user2.id, eventId: events[3].id, bookingId: bookings[4].id, rating: 5, recommend: true, comment: 'Зручний час, невелика група та зрозуміла організація тренування.' },
  });

  await prisma.eventDemandVote.createMany({
    data: [
      { userId: user1.id, eventId: events[0].id, type: DemandVoteType.TIME, value: 'Після 18:00', comment: 'Після роботи було б зручніше.' },
      { userId: user2.id, eventId: events[3].id, type: DemandVoteType.DATE, value: 'Наступна субота', comment: 'Хочу повторити заняття у вихідний.' },
      { userId: user3.id, eventId: events[1].id, type: DemandVoteType.LOCATION, value: 'Vinnytsia', comment: 'Хотілося б таку подію в моєму місті.' },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: user1.id, type: 'BOOKING_CONFIRMED', title: 'Заявку підтверджено', message: 'Вашу заявку на Vinnytsia Tennis Open підтверджено.', eventId: events[0].id, bookingId: bookings[0].id },
      { userId: user2.id, type: 'BOOKING_REQUESTED', title: 'Заявка очікує підтвердження', message: 'Організатор ще не розглянув вашу заявку на Vinnytsia Tennis Open.', eventId: events[0].id, bookingId: bookings[1].id },
      { userId: user1.id, type: 'BOOKING_REJECTED', title: 'Заявку відхилено', message: 'Вашу заявку на Lviv Boxing Match Day відхилено. Причина: Необхідно підтвердити медичну довідку.', eventId: events[2].id, bookingId: bookings[3].id },
      { userId: user1.id, type: 'WAITLISTED', title: 'Додано до листа очікування', message: 'Для Kyiv Morning Football ви перебуваєте у черзі на позиції #1.', eventId: events[1].id },
      { userId: user2.id, type: 'CHECKED_IN', title: 'Вас відмічено на події', message: 'Для вас зафіксовано присутність на Kyiv Evening Tennis Section.', eventId: events[3].id, bookingId: bookings[4].id },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      { actorId: organizer.id, eventId: events[0].id, type: 'EVENT_CREATED', message: 'Створено подію «Vinnytsia Tennis Open».', details: 'Початок через 3 дні' },
      { actorId: user1.id, eventId: events[0].id, bookingId: bookings[0].id, type: 'BOOKING_REQUESTED', message: 'Andrii User подав заявку на Vinnytsia Tennis Open.' },
      { actorId: organizer.id, eventId: events[0].id, bookingId: bookings[0].id, type: 'BOOKING_CONFIRMED', message: 'Заявку Andrii User підтверджено.' },
      { actorId: user2.id, eventId: events[0].id, bookingId: bookings[1].id, type: 'BOOKING_REQUESTED', message: 'Iryna User подала заявку на Vinnytsia Tennis Open.' },
      { actorId: organizer.id, eventId: events[2].id, bookingId: bookings[3].id, type: 'BOOKING_REJECTED', message: 'Заявку Andrii User відхилено для Lviv Boxing Match Day.', details: 'Необхідно підтвердити медичну довідку.' },
      { actorId: organizer.id, eventId: events[3].id, bookingId: bookings[4].id, type: 'CHECKED_IN', message: 'Iryna User успішно відмічена як присутня на Kyiv Evening Tennis Section.' },
    ],
  });

  console.log('Seed completed successfully.');
  console.log('ADMIN: admin@test.com / 123456');
  console.log('ORGANIZER: organizer@test.com / 123456');
  console.log('USER: u1@test.com / 123456');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
