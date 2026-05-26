import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/types/request-user';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post()
  create(@Body() dto: CreateEventDto, @Req() req: { user: RequestUser }) {
    return this.eventsService.create(req.user.sub, dto);
  }

  @Get()
  findAll(
    @Query('sportType') sportType?: string,
    @Query('level') level?: string,
    @Query('format') format?: string,
    @Query('location') location?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.eventsService.findAll({ sportType, level, format, location, dateFrom, dateTo });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('my')
  my(@Req() req: { user: RequestUser }) {
    return this.eventsService.listMy(req.user.sub, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  recommended(@Req() req: { user: RequestUser }, @Query('limit') limit?: string) {
    return this.eventsService.recommendedForUser(req.user.sub, Number(limit ?? 6));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('analytics/overview')
  analyticsOverview() {
    return this.eventsService.analyticsOverview();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get(':id/activity')
  activity(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.eventsService.listActivity(id, req.user.sub, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get(':id/bookings/export')
  async exportBookings(@Param('id') id: string, @Req() req: { user: RequestUser }, @Res() res: Response) {
    const csv = await this.eventsService.exportBookingsCsv(id, req.user.sub, req.user.role);
    res.setHeader('Content-Disposition', `attachment; filename="event-${id}-participants.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get(':id/bookings')
  listBookings(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.eventsService.listBookings(id, req.user.sub, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post(':eventId/bookings/:bookingId/check-in')
  checkIn(@Param('eventId') eventId: string, @Param('bookingId') bookingId: string, @Req() req: { user: RequestUser }) {
    return this.eventsService.checkInBooking(eventId, bookingId, req.user.sub, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get(':id/waitlist')
  waitlist(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.eventsService.listWaitlist(id, req.user.sub, req.user.role);
  }

  @Post(':id/view')
  addView(@Param('id') id: string) {
    return this.eventsService.addView(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @Req() req: { user: RequestUser }) {
    return this.eventsService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.eventsService.remove(id, req.user);
  }
}
