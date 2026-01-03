import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Patch,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req: any, @Query('unreadOnly') unreadOnly?: string) {
    const unread = unreadOnly === 'true';
    return this.notificationsService.findAll(req.user.userId, unread);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @Post('mark-all-read')
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @Delete('cleanup')
  deleteOld(@Request() req: any, @Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld) : 30;
    return this.notificationsService.deleteOld(req.user.userId, days);
  }
}
