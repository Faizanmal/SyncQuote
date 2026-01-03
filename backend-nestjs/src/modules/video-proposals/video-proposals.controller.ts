import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
  Headers,
  Ip,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VideoProposalsService } from './video-proposals.service';
import { VideoAnalyticsService } from './video-analytics.service';
import { ScreenRecordingService } from './screen-recording.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  VideoProvider,
  PersonalizedVideoDto,
  VideoViewEventDto,
  ConnectLoomDto,
  ConnectVidyardDto,
  UploadVideoDto,
} from './dto/video.dto';

@ApiTags('Video Proposals')
@Controller('video')
export class VideoProposalsController {
  constructor(
    private readonly videoService: VideoProposalsService,
    private readonly analyticsService: VideoAnalyticsService,
    private readonly screenRecordingService: ScreenRecordingService,
  ) {}

  // === Protected Routes (require auth) ===

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a video record' })
  async createVideo(@Request() req: any, @Body() dto: CreateVideoDto) {
    return this.videoService.createVideo(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all videos for user' })
  async getUserVideos(@Request() req: any, @Query('proposalId') proposalId?: string) {
    return this.videoService.getUserVideos(req.user.id, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('analytics')
  @ApiOperation({ summary: 'Get aggregated video analytics for user' })
  async getUserVideoAnalytics(@Request() req: any) {
    return this.videoService.getUserVideoAnalytics(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('providers')
  @ApiOperation({ summary: 'Get connected video providers' })
  async getConnectedProviders(@Request() req: any) {
    return this.videoService.getConnectedProviders(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('providers/:provider/videos')
  @ApiOperation({ summary: 'Get videos from a connected provider' })
  async getProviderVideos(@Request() req: any, @Param('provider') provider: VideoProvider) {
    return this.videoService.getProviderVideos(req.user.id, provider);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('connect/loom')
  @ApiOperation({ summary: 'Get Loom OAuth URL' })
  async getLoomAuthUrl(@Request() req: any) {
    const url = this.videoService.getLoomAuthUrl(req.user.id);
    return { authorizationUrl: url };
  }

  @Get('connect/loom/callback')
  @ApiOperation({ summary: 'Loom OAuth callback' })
  async handleLoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.videoService.connectLoom(state, code);
    return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?connected=loom`);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('connect/vidyard')
  @ApiOperation({ summary: 'Connect Vidyard with API key' })
  async connectVidyard(@Request() req: any, @Body() dto: ConnectVidyardDto) {
    return this.videoService.connectVidyard(req.user.id, dto.apiKey!);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('disconnect/:provider')
  @ApiOperation({ summary: 'Disconnect a video provider' })
  async disconnectProvider(@Request() req: any, @Param('provider') provider: string) {
    return this.videoService.disconnectProvider(req.user.id, provider);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('import/loom/:videoId')
  @ApiOperation({ summary: 'Import a video from Loom' })
  async importFromLoom(
    @Request() req: any,
    @Param('videoId') videoId: string,
    @Query('proposalId') proposalId?: string,
  ) {
    return this.videoService.importFromLoom(req.user.id, videoId, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('import/vidyard/:videoId')
  @ApiOperation({ summary: 'Import a video from Vidyard' })
  async importFromVidyard(
    @Request() req: any,
    @Param('videoId') videoId: string,
    @Query('proposalId') proposalId?: string,
  ) {
    return this.videoService.importFromVidyard(req.user.id, videoId, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get video by ID' })
  async getVideo(@Request() req: any, @Param('id') id: string) {
    return this.videoService.getVideo(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update video' })
  async updateVideo(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.videoService.updateVideo(req.user.id, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete video' })
  async deleteVideo(@Request() req: any, @Param('id') id: string) {
    return this.videoService.deleteVideo(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/attach/:proposalId')
  @ApiOperation({ summary: 'Attach video to proposal' })
  async attachToProposal(
    @Request() req: any,
    @Param('id') videoId: string,
    @Param('proposalId') proposalId: string,
  ) {
    return this.videoService.attachToProposal(req.user.id, videoId, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get video analytics' })
  async getVideoAnalytics(@Request() req: any, @Param('id') id: string) {
    return this.videoService.getVideoAnalytics(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('personalized')
  @ApiOperation({ summary: 'Create a personalized video' })
  async createPersonalizedVideo(@Request() req: any, @Body() dto: PersonalizedVideoDto) {
    return this.videoService.createPersonalizedVideo(req.user.id, dto);
  }

  // Screen recording
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('screen-recording/start')
  @ApiOperation({ summary: 'Start a screen recording session' })
  async startScreenRecording(@Request() req: any, @Query('proposalId') proposalId?: string) {
    return this.screenRecordingService.createRecordingSession(req.user.id, proposalId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('screen-recording/sessions')
  @ApiOperation({ summary: 'Get user screen recording sessions' })
  async getRecordingSessions(@Request() req: any) {
    return this.screenRecordingService.getUserSessions(req.user.id);
  }

  // === Public Routes (no auth required) ===

  @Get('public/:id')
  @ApiOperation({ summary: 'Get video for public viewing' })
  async getPublicVideo(@Param('id') id: string) {
    return this.videoService.getPublicVideo(id);
  }

  @Get('proposal/:proposalId')
  @ApiOperation({ summary: 'Get videos for a proposal (public)' })
  async getProposalVideos(@Param('proposalId') proposalId: string) {
    return this.videoService.getProposalVideos(proposalId);
  }

  @Get('personalized/:slug')
  @ApiOperation({ summary: 'Get personalized video by slug' })
  async getPersonalizedVideo(@Param('slug') slug: string) {
    return this.videoService.getPersonalizedVideoBySlug(slug);
  }

  @Post('track')
  @ApiOperation({ summary: 'Track video view event' })
  async trackViewEvent(
    @Body() dto: VideoViewEventDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.analyticsService.trackEvent(dto, { ip, userAgent });
  }
}
