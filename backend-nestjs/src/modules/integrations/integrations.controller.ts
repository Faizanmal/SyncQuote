import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalendarIntegrationService } from './services/calendar-integration.service';
import { DocumentManagementService } from './services/document-management.service';
import { CommunicationToolsService } from './services/communication-tools.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly calendarService: CalendarIntegrationService,
    private readonly documentService: DocumentManagementService,
    private readonly communicationService: CommunicationToolsService,
  ) {}

  // ==================== Connection Status ====================

  @Get('status')
  @ApiOperation({ summary: 'Get all integration connection statuses' })
  async getConnectionStatus(@Req() req: any) {
    const userId = req.user.id;
    const [calendar, documents, communication] = await Promise.all([
      this.calendarService.getCalendarStatus(userId),
      this.documentService.getConnectionStatus(userId),
      this.communicationService.getConnectionStatus(userId),
    ]);

    return {
      calendar,
      documents,
      communication,
    };
  }

  // ==================== Calendar Integration ====================

  @Get('calendar/google/auth-url')
  @ApiOperation({ summary: 'Get Google Calendar OAuth URL' })
  async getGoogleCalendarAuthUrl(@Req() req: any) {
    const url = await this.calendarService.getGoogleAuthUrl(req.user.id);
    return { url };
  }

  @Post('calendar/google/callback')
  @ApiOperation({ summary: 'Handle Google Calendar OAuth callback' })
  async handleGoogleCalendarCallback(
    @Req() req: any,
    @Body() body: { code: string },
  ) {
    await this.calendarService.handleGoogleCallback(req.user.id, body.code);
    return { success: true };
  }

  @Get('calendar/events')
  @ApiOperation({ summary: 'Get calendar events' })
  async getCalendarEvents(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.calendarService.getEvents(
      req.user.id,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('calendar/events')
  @ApiOperation({ summary: 'Create calendar event' })
  async createCalendarEvent(@Req() req: any, @Body() body: any) {
    return this.calendarService.createEvent(req.user.id, {
      ...body,
      start: new Date(body.start),
      end: new Date(body.end),
    });
  }

  @Post('calendar/proposal-followup')
  @ApiOperation({ summary: 'Schedule proposal follow-up' })
  async scheduleFollowUp(
    @Req() req: any,
    @Body() body: { proposalId: string; followUpDate: string; notes?: string },
  ) {
    return this.calendarService.scheduleProposalFollowUp(
      req.user.id,
      body.proposalId,
      new Date(body.followUpDate),
      body.notes,
    );
  }

  @Post('calendar/proposal-meeting')
  @ApiOperation({ summary: 'Schedule proposal meeting' })
  async scheduleProposalMeeting(
    @Req() req: any,
    @Body() body: {
      proposalId: string;
      title: string;
      startTime: string;
      duration: number;
      attendees: string[];
    },
  ) {
    return this.calendarService.scheduleProposalMeeting(req.user.id, body.proposalId, {
      ...body,
      startTime: new Date(body.startTime),
    });
  }

  @Delete('calendar/:provider')
  @ApiOperation({ summary: 'Disconnect calendar integration' })
  async disconnectCalendar(@Req() req: any, @Param('provider') provider: string) {
    await this.calendarService.disconnectCalendar(req.user.id, provider);
    return { success: true };
  }

  // ==================== Document Management ====================

  @Get('documents/google-drive/auth-url')
  @ApiOperation({ summary: 'Get Google Drive OAuth URL' })
  async getGoogleDriveAuthUrl(@Req() req: any) {
    const url = await this.documentService.getGoogleDriveAuthUrl(req.user.id);
    return { url };
  }

  @Post('documents/google-drive/callback')
  @ApiOperation({ summary: 'Handle Google Drive OAuth callback' })
  async handleGoogleDriveCallback(
    @Req() req: any,
    @Body() body: { code: string },
  ) {
    await this.documentService.handleGoogleDriveCallback(req.user.id, body.code);
    return { success: true };
  }

  @Get('documents/google-drive/files')
  @ApiOperation({ summary: 'List Google Drive files' })
  async listGoogleDriveFiles(
    @Req() req: any,
    @Query('folderId') folderId?: string,
    @Query('query') query?: string,
  ) {
    return this.documentService.listGoogleDriveFiles(req.user.id, folderId, query);
  }

  @Get('documents/dropbox/auth-url')
  @ApiOperation({ summary: 'Get Dropbox OAuth URL' })
  async getDropboxAuthUrl(@Req() req: any) {
    const url = await this.documentService.getDropboxAuthUrl(req.user.id);
    return { url };
  }

  @Post('documents/dropbox/callback')
  @ApiOperation({ summary: 'Handle Dropbox OAuth callback' })
  async handleDropboxCallback(
    @Req() req: any,
    @Body() body: { code: string },
  ) {
    await this.documentService.handleDropboxCallback(req.user.id, body.code);
    return { success: true };
  }

  @Get('documents/dropbox/files')
  @ApiOperation({ summary: 'List Dropbox files' })
  async listDropboxFiles(@Req() req: any, @Query('path') path?: string) {
    return this.documentService.listDropboxFiles(req.user.id, path);
  }

  @Post('documents/proposal/:proposalId/save')
  @ApiOperation({ summary: 'Save proposal to cloud storage' })
  async saveProposalToCloud(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
    @Body() body: { provider: 'google_drive' | 'dropbox' },
  ) {
    return this.documentService.saveProposalToCloud(req.user.id, proposalId, body.provider);
  }

  @Delete('documents/:provider')
  @ApiOperation({ summary: 'Disconnect document storage' })
  async disconnectDocumentStorage(
    @Req() req: any,
    @Param('provider') provider: string,
  ) {
    await this.documentService.disconnectProvider(req.user.id, provider);
    return { success: true };
  }

  // ==================== Communication Tools ====================

  @Get('communication/slack/auth-url')
  @ApiOperation({ summary: 'Get Slack OAuth URL' })
  async getSlackAuthUrl(@Req() req: any) {
    const url = await this.communicationService.getSlackAuthUrl(req.user.id);
    return { url };
  }

  @Post('communication/slack/callback')
  @ApiOperation({ summary: 'Handle Slack OAuth callback' })
  async handleSlackCallback(
    @Req() req: any,
    @Body() body: { code: string },
  ) {
    await this.communicationService.handleSlackCallback(req.user.id, body.code);
    return { success: true };
  }

  @Get('communication/slack/channels')
  @ApiOperation({ summary: 'Get Slack channels' })
  async getSlackChannels(@Req() req: any) {
    return this.communicationService.getSlackChannels(req.user.id);
  }

  @Post('communication/slack/message')
  @ApiOperation({ summary: 'Send Slack message' })
  async sendSlackMessage(
    @Req() req: any,
    @Body() body: { channel: string; text: string },
  ) {
    await this.communicationService.sendSlackMessage(req.user.id, body);
    return { success: true };
  }

  @Get('communication/zoom/auth-url')
  @ApiOperation({ summary: 'Get Zoom OAuth URL' })
  async getZoomAuthUrl(@Req() req: any) {
    const url = await this.communicationService.getZoomAuthUrl(req.user.id);
    return { url };
  }

  @Post('communication/zoom/callback')
  @ApiOperation({ summary: 'Handle Zoom OAuth callback' })
  async handleZoomCallback(
    @Req() req: any,
    @Body() body: { code: string },
  ) {
    await this.communicationService.handleZoomCallback(req.user.id, body.code);
    return { success: true };
  }

  @Post('communication/zoom/meeting')
  @ApiOperation({ summary: 'Create Zoom meeting' })
  async createZoomMeeting(
    @Req() req: any,
    @Body() body: {
      topic: string;
      startTime: string;
      duration: number;
      agenda?: string;
    },
  ) {
    return this.communicationService.createZoomMeeting(req.user.id, {
      ...body,
      startTime: new Date(body.startTime),
    });
  }

  @Post('communication/zoom/proposal-meeting/:proposalId')
  @ApiOperation({ summary: 'Create Zoom meeting for proposal' })
  async createProposalZoomMeeting(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
    @Body() body: { startTime: string; duration: number },
  ) {
    return this.communicationService.createProposalReviewMeeting(
      req.user.id,
      proposalId,
      {
        startTime: new Date(body.startTime),
        duration: body.duration,
      },
    );
  }

  @Get('communication/zoom/meetings')
  @ApiOperation({ summary: 'Get upcoming Zoom meetings' })
  async getZoomMeetings(@Req() req: any) {
    return this.communicationService.getZoomMeetings(req.user.id);
  }

  @Delete('communication/:provider')
  @ApiOperation({ summary: 'Disconnect communication tool' })
  async disconnectCommunicationTool(
    @Req() req: any,
    @Param('provider') provider: string,
  ) {
    await this.communicationService.disconnectProvider(req.user.id, provider);
    return { success: true };
  }
}
