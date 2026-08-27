import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  @Get('metrics')
  getDashboardMetrics(@Request() req: any, @Query('range') range?: string) {
    return this.analyticsService.getDashboardMetrics(this.userId(req), range);
  }

  @Get('timeseries')
  getTimeSeries(
    @Request() req: any,
    @Query('range') range?: string,
    @Query('metric') metric?: string,
  ) {
    return this.analyticsService.getTimeSeries(this.userId(req), range, metric);
  }

  @Get('conversion')
  getConversion(@Request() req: any, @Query('range') range?: string) {
    return this.analyticsService.getConversionBreakdown(this.userId(req), range);
  }

  @Get('behavior')
  getBehavior(@Request() req: any, @Query('range') range?: string) {
    return this.analyticsService.getBehavior(this.userId(req), range);
  }

  @Get('geographic')
  getGeographic(@Request() req: any, @Query('range') range?: string) {
    return this.analyticsService.getGeographic(this.userId(req), range);
  }

  @Get('overview')
  getOverviewMetrics(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getOverviewMetrics(this.userId(req), start, end);
  }

  @Get('engagement')
  getProposalEngagement(@Request() req: any, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getProposalEngagement(this.userId(req), limitNum);
  }

  @Get('activity')
  getActivityTimeline(@Request() req: any, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getActivityTimeline(this.userId(req), daysNum);
  }

  @Get('funnel')
  getConversionFunnel(@Request() req: any, @Query('range') range?: string) {
    return this.analyticsService.getFunnelChart(this.userId(req), range);
  }
}
