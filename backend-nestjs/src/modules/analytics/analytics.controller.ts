import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverviewMetrics(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getOverviewMetrics(req.user.userId, start, end);
  }

  @Get('engagement')
  getProposalEngagement(@Request() req: any, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.analyticsService.getProposalEngagement(req.user.userId, limitNum);
  }

  @Get('activity')
  getActivityTimeline(@Request() req: any, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days) : 30;
    return this.analyticsService.getActivityTimeline(req.user.userId, daysNum);
  }

  @Get('funnel')
  getConversionFunnel(@Request() req: any) {
    return this.analyticsService.getConversionFunnel(req.user.userId);
  }
}
