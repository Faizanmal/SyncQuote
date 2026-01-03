import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HeatmapsService } from './heatmaps.service';
import { ClickTrackingService } from './click-tracking.service';
import { ScrollTrackingService } from './scroll-tracking.service';
import { PredictiveScoringService } from './predictive-scoring.service';
import {
  RecordInteractionDto,
  RecordScrollDto,
  RecordEngagementDto,
  GetHeatmapDto,
  PredictiveScoreDto,
  RealTimeAnalyticsDto,
} from './dto/heatmaps.dto';

@ApiTags('Heatmaps & Analytics')
@Controller('heatmaps')
export class HeatmapsController {
  constructor(
    private readonly heatmapsService: HeatmapsService,
    private readonly clickTracking: ClickTrackingService,
    private readonly scrollTracking: ScrollTrackingService,
    private readonly predictiveScoring: PredictiveScoringService,
  ) {}

  // Public tracking endpoints (no auth required)
  @Post('track/interaction')
  @ApiOperation({ summary: 'Record user interaction (click, hover, etc.)' })
  async recordInteraction(@Body() dto: RecordInteractionDto) {
    await this.clickTracking.recordInteraction(dto);
    return { success: true };
  }

  @Post('track/scroll')
  @ApiOperation({ summary: 'Record scroll position' })
  async recordScroll(@Body() dto: RecordScrollDto) {
    await this.scrollTracking.recordScroll(dto);
    return { success: true };
  }

  @Post('track/engagement')
  @ApiOperation({ summary: 'Record overall engagement summary' })
  async recordEngagement(@Body() dto: RecordEngagementDto) {
    await this.heatmapsService.recordEngagement(dto);
    return { success: true };
  }

  // Protected analytics endpoints
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  @ApiOperation({ summary: 'Generate heatmap for a proposal' })
  async generateHeatmap(@Request() req: any, @Body() dto: GetHeatmapDto) {
    return this.heatmapsService.generateHeatmap(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proposal/:proposalId/engagement')
  @ApiOperation({ summary: 'Get comprehensive engagement metrics' })
  async getEngagementMetrics(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.heatmapsService.getEngagementMetrics(req.user.id, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proposal/:proposalId/attention')
  @ApiOperation({ summary: 'Get attention heatmap by sections' })
  async getAttentionHeatmap(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.heatmapsService.getAttentionHeatmap(req.user.id, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proposal/:proposalId/clicks')
  @ApiOperation({ summary: 'Get click analytics' })
  async getClickAnalytics(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.clickTracking.getClickAnalytics(proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proposal/:proposalId/scroll-depth')
  @ApiOperation({ summary: 'Get scroll depth analytics' })
  async getScrollDepthAnalytics(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.scrollTracking.getScrollDepthAnalytics(proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proposal/:proposalId/realtime')
  @ApiOperation({ summary: 'Get real-time analytics' })
  async getRealTimeStats(
    @Request() req: any,
    @Param('proposalId') proposalId: string,
    @Query('minutes') minutes?: number,
  ) {
    return this.heatmapsService.getRealTimeStats(req.user.id, proposalId, minutes || 5);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('predictive-score')
  @ApiOperation({ summary: 'Calculate predictive conversion score' })
  async getPredictiveScore(@Request() req: any, @Body() dto: PredictiveScoreDto) {
    return this.predictiveScoring.calculatePredictiveScore(dto.proposalId, dto.sessionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('proposal/:proposalId/most-clicked')
  @ApiOperation({ summary: 'Get most clicked elements' })
  async getMostClickedElements(
    @Request() req: any,
    @Param('proposalId') proposalId: string,
    @Query('limit') limit?: number,
  ) {
    return this.clickTracking.getMostClickedElements(proposalId, limit || 10);
  }
}
