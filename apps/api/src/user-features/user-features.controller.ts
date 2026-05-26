import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/types/request-user';
import { UserFeaturesService } from './user-features.service';

@Controller('user-features')
export class UserFeaturesController {
  constructor(private readonly service: UserFeaturesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile/my')
  myProfile(@Req() req: { user: RequestUser }) {
    return this.service.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/my')
  saveProfile(@Req() req: { user: RequestUser }, @Body() body: any) {
    return this.service.saveProfile(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('event-requests/my')
  myEventRequests(@Req() req: { user: RequestUser }) {
    return this.service.listMyEventRequests(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('event-requests')
  createEventRequest(@Req() req: { user: RequestUser }, @Body() body: any) {
    return this.service.createEventRequest(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('event-requests')
  listEventRequests() {
    return this.service.listEventRequests();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Patch('event-requests/:id/status')
  updateEventRequestStatus(@Param('id') id: string, @Body() body: any) {
    return this.service.updateEventRequestStatus(id, body?.status);
  }

  @Get('events/:eventId/reviews')
  eventReviews(@Param('eventId') eventId: string) {
    return this.service.listEventReviews(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('events/:eventId/reviews')
  createReview(@Req() req: { user: RequestUser }, @Param('eventId') eventId: string, @Body() body: any) {
    return this.service.createReview(req.user.sub, eventId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('events/:eventId/votes')
  vote(@Req() req: { user: RequestUser }, @Param('eventId') eventId: string, @Body() body: any) {
    return this.service.saveDemandVote(req.user.sub, eventId, body);
  }

  @Get('events/:eventId/votes/summary')
  voteSummary(@Param('eventId') eventId: string) {
    return this.service.voteSummaryForEvent(eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/demand-summary')
  organizerDemandSummary(@Req() req: { user: RequestUser }) {
    return this.service.organizerDemandSummary(req.user.sub, req.user.role);
  }
}
