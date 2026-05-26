import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @Post()
  async create(@Req() req: { user: RequestUser }, @Body() dto: { eventId: string }) {
    return this.bookingsService.createBookingOrWaitlist(req.user.sub, dto.eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @Post('cancel')
  cancel(@Body() dto: { eventId: string }, @Req() req: { user: RequestUser }) {
    return this.bookingsService.cancelBooking(req.user.sub, dto.eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @Get('my')
  my(@Req() req: { user: RequestUser }) {
    return this.bookingsService.listByUser(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @Get('my-waitlist')
  myWaitlist(@Req() req: { user: RequestUser }) {
    return this.bookingsService.listWaitlistByUser(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post(':bookingId/approve')
  approve(@Param('bookingId') bookingId: string, @Req() req: { user: RequestUser }) {
    return this.bookingsService.approveBooking(bookingId, req.user.sub, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post(':bookingId/reject')
  reject(@Param('bookingId') bookingId: string, @Body() dto: { reason?: string }, @Req() req: { user: RequestUser }) {
    return this.bookingsService.rejectBooking(bookingId, req.user.sub, req.user.role, dto?.reason);
  }
}
