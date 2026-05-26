import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { RequestUser } from '../common/types/request-user';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  my(@Req() req: { user: RequestUser }) {
    return this.notificationsService.listForUser(req.user.sub);
  }

  @Post('read-all')
  readAll(@Req() req: { user: RequestUser }) {
    return this.notificationsService.markAllRead(req.user.sub);
  }
}
