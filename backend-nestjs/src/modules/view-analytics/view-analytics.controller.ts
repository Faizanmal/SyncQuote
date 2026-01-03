import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Headers,
  Ip,
} from '@nestjs/common';
import {
  ViewAnalyticsService,
  StartSessionDto,
  UpdateSessionDto,
  TrackSectionViewDto,
} from './view-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('view-analytics')
export class ViewAnalyticsController {
  constructor(private readonly viewAnalyticsService: ViewAnalyticsService) {}

  // Public endpoints for client-side tracking (no auth required)
  @Post('session/start')
  async startSession(
    @Body() data: StartSessionDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
  ) {
    // Parse user agent for device info
    const device = this.parseDevice(userAgent);
    const browser = this.parseBrowser(userAgent);
    const os = this.parseOS(userAgent);

    return this.viewAnalyticsService.startSession({
      ...data,
      userAgent,
      ipAddress: ip,
      device,
      browser,
      os,
    });
  }

  @Post('session/update')
  async updateSession(@Body() data: UpdateSessionDto) {
    return this.viewAnalyticsService.updateSession(data);
  }

  @Post('session/end')
  async endSession(@Body() data: { sessionId: string }) {
    return this.viewAnalyticsService.endSession(data.sessionId);
  }

  @Post('section/track')
  async trackSection(@Body() data: TrackSectionViewDto) {
    return this.viewAnalyticsService.trackSectionView(data);
  }

  // Protected endpoints for proposal owners
  @Get('proposal/:id')
  @UseGuards(JwtAuthGuard)
  async getProposalAnalytics(@Param('id') proposalId: string) {
    return this.viewAnalyticsService.getProposalAnalytics(proposalId);
  }

  @Get('proposal/:id/heatmap')
  @UseGuards(JwtAuthGuard)
  async getSectionHeatmap(@Param('id') proposalId: string) {
    return this.viewAnalyticsService.getSectionHeatmap(proposalId);
  }

  @Get('proposal/:id/viewers')
  @UseGuards(JwtAuthGuard)
  async getRecentViewers(@Param('id') proposalId: string, @Query('limit') limit?: number) {
    return this.viewAnalyticsService.getRecentViewers(proposalId, limit);
  }

  // Helper methods for parsing user agent
  private parseDevice(userAgent: string): string {
    if (!userAgent) return 'unknown';
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  private parseBrowser(userAgent: string): string {
    if (!userAgent) return 'unknown';
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';
    return 'Other';
  }

  private parseOS(userAgent: string): string {
    if (!userAgent) return 'unknown';
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad/i.test(userAgent)) return 'iOS';
    return 'Other';
  }
}
