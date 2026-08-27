import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    return this.notificationsService.findAll(
      this.userId(req),
      unreadOnly === 'true',
      search,
      filter,
    );
  }

  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(this.userId(req));
  }

  @Get('rules')
  listRules(@Request() req: any) {
    return this.notificationsService.listRules(this.userId(req));
  }

  @Post('rules')
  createRule(@Request() req: any, @Body() body: any) {
    return this.notificationsService.createRule(this.userId(req), body);
  }

  @Patch('rules/:id')
  updateRule(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.notificationsService.updateRule(this.userId(req), id, body);
  }

  @Get('campaigns')
  listCampaigns(@Request() req: any) {
    return this.notificationsService.listCampaigns(this.userId(req));
  }

  @Post('campaigns')
  createCampaign(@Request() req: any, @Body() body: any) {
    return this.notificationsService.createCampaign(this.userId(req), body);
  }

  @Post('campaigns/:id/send')
  sendCampaign(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.sendCampaign(this.userId(req), id);
  }

  @Post('campaigns/:id/pause')
  pauseCampaign(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.pauseCampaign(this.userId(req), id);
  }

  @Get('templates')
  listTemplates(@Request() req: any) {
    return this.notificationsService.listTemplates(this.userId(req));
  }

  @Get('settings')
  getSettings(@Request() req: any) {
    return this.notificationsService.getSettings(this.userId(req));
  }

  @Patch('settings')
  updateSettings(@Request() req: any, @Body() body: any) {
    return this.notificationsService.updateSettings(this.userId(req), body);
  }

  @Get('analytics')
  analytics(@Request() req: any) {
    return this.notificationsService.getCampaignAnalytics(this.userId(req));
  }

  @Post('test')
  sendTest(@Request() req: any, @Body() body: any) {
    return this.notificationsService.sendTest(this.userId(req), body);
  }

  @Patch('mark-read')
  markManyRead(@Request() req: any, @Body() body: { ids: string[] }) {
    return this.notificationsService.markManyRead(this.userId(req), body.ids || []);
  }

  @Delete()
  deleteMany(@Request() req: any, @Body() body: { ids: string[] }) {
    return this.notificationsService.deleteMany(this.userId(req), body.ids || []);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, this.userId(req));
  }

  @Post('mark-all-read')
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(this.userId(req));
  }

  @Delete('cleanup')
  deleteOld(@Request() req: any, @Query('daysOld') daysOld?: string) {
    const days = daysOld ? parseInt(daysOld, 10) : 30;
    return this.notificationsService.deleteOld(this.userId(req), days);
  }
}
