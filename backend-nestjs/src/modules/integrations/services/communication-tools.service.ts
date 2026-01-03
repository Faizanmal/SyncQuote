import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
}

export interface TeamsMessage {
  text: string;
  title?: string;
  sections?: any[];
}

export interface ZoomMeeting {
  topic: string;
  startTime: Date;
  duration: number;
  agenda?: string;
  attendees?: string[];
}

export interface ZoomMeetingResult {
  id: string;
  joinUrl: string;
  startUrl: string;
  password?: string;
}

@Injectable()
export class CommunicationToolsService {
  private readonly logger = new Logger(CommunicationToolsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== Slack Integration ====================

  async getSlackAuthUrl(userId: string): Promise<string> {
    const clientId = this.configService.get('SLACK_CLIENT_ID');
    const redirectUri = this.configService.get('SLACK_REDIRECT_URI');
    const scopes = 'channels:read,chat:write,users:read,incoming-webhook';

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
  }

  async handleSlackCallback(userId: string, code: string): Promise<void> {
    const clientId = this.configService.get('SLACK_CLIENT_ID');
    const clientSecret = this.configService.get('SLACK_CLIENT_SECRET');
    const redirectUri = this.configService.get('SLACK_REDIRECT_URI');

    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    if (!response.data.ok) {
      throw new BadRequestException(`Slack auth failed: ${response.data.error}`);
    }

    await this.prisma.oAuthToken.upsert({
      where: {
        userId_provider: { userId, provider: 'slack' },
      },
      create: {
        userId,
        provider: 'slack',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || undefined,
        scopes: response.data.scope?.split(',') || [],
      },
      update: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || undefined,
        scopes: response.data.scope?.split(',') || [],
      },
    });

    this.logger.log(`Slack connected for user ${userId}`);
  }

  async sendSlackMessage(userId: string, message: SlackMessage): Promise<void> {
    const token = await this.getSlackToken(userId);

    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      message,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.data.ok) {
      throw new BadRequestException(`Slack message failed: ${response.data.error}`);
    }
  }

  async sendProposalNotificationToSlack(
    userId: string,
    proposalId: string,
    event: 'viewed' | 'approved' | 'declined' | 'signed' | 'comment',
    channel?: string,
  ): Promise<void> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      select: { title: true, recipientName: true, recipientEmail: true, slug: true, totalAmount: true },
    });

    if (!proposal) return;

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://app.syncquote.com';
    const proposalUrl = `${frontendUrl}/proposals/${proposalId}`;

    const eventMessages = {
      viewed: { emoji: '👀', text: 'was viewed by', color: '#36a64f' },
      approved: { emoji: '✅', text: 'was approved by', color: '#2eb886' },
      declined: { emoji: '❌', text: 'was declined by', color: '#dc3545' },
      signed: { emoji: '🎉', text: 'was signed by', color: '#6f42c1' },
      comment: { emoji: '💬', text: 'received a comment from', color: '#17a2b8' },
    };

    const { emoji, text, color } = eventMessages[event];

    await this.sendSlackMessage(userId, {
      channel: channel || '#proposals',
      text: `${emoji} Proposal "${proposal.title}" ${text} ${proposal.recipientName || proposal.recipientEmail}`,
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*<${proposalUrl}|${proposal.title}>*\nClient: ${proposal.recipientName || 'N/A'} (${proposal.recipientEmail || 'N/A'})${proposal.totalAmount ? `\nValue: $${proposal.totalAmount.toLocaleString()}` : ''}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View Proposal' },
                  url: proposalUrl,
                },
              ],
            },
          ],
        },
      ],
    });
  }

  async getSlackChannels(userId: string): Promise<{ id: string; name: string }[]> {
    const token = await this.getSlackToken(userId);

    const response = await axios.get(
      'https://slack.com/api/conversations.list',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { types: 'public_channel,private_channel', limit: 100 },
      },
    );

    if (!response.data.ok) {
      throw new BadRequestException(`Failed to get channels: ${response.data.error}`);
    }

    return response.data.channels.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
    }));
  }

  // ==================== Microsoft Teams Integration ====================

  async getTeamsAuthUrl(userId: string): Promise<string> {
    const clientId = this.configService.get('MICROSOFT_CLIENT_ID');
    const redirectUri = this.configService.get('MICROSOFT_TEAMS_REDIRECT_URI');
    const scope = 'https://graph.microsoft.com/ChannelMessage.Send https://graph.microsoft.com/Chat.ReadWrite';

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${userId}`;
  }

  async handleTeamsCallback(userId: string, code: string): Promise<void> {
    const clientId = this.configService.get('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get('MICROSOFT_CLIENT_SECRET');
    const redirectUri = this.configService.get('MICROSOFT_TEAMS_REDIRECT_URI');

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    await this.prisma.oAuthToken.upsert({
      where: {
        userId_provider: { userId, provider: 'microsoft_teams' },
      },
      create: {
        userId,
        provider: 'microsoft_teams',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      },
      update: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      },
    });

    this.logger.log(`Microsoft Teams connected for user ${userId}`);
  }

  async sendTeamsMessage(userId: string, webhookUrl: string, message: TeamsMessage): Promise<void> {
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '6366f1',
      summary: message.title || 'SyncQuote Notification',
      sections: [
        {
          activityTitle: message.title,
          text: message.text,
          ...(message.sections || []),
        },
      ],
    };

    await axios.post(webhookUrl, card, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async sendProposalNotificationToTeams(
    userId: string,
    proposalId: string,
    event: 'viewed' | 'approved' | 'declined' | 'signed',
    webhookUrl: string,
  ): Promise<void> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      select: { title: true, recipientName: true, recipientEmail: true, totalAmount: true },
    });

    if (!proposal) return;

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://app.syncquote.com';

    const eventTitles = {
      viewed: '👀 Proposal Viewed',
      approved: '✅ Proposal Approved',
      declined: '❌ Proposal Declined',
      signed: '🎉 Proposal Signed',
    };

    await this.sendTeamsMessage(userId, webhookUrl, {
      title: eventTitles[event],
      text: `**${proposal.title}**\n\nClient: ${proposal.recipientName || proposal.recipientEmail}${proposal.totalAmount ? `\n\nValue: $${proposal.totalAmount.toLocaleString()}` : ''}`,
      sections: [
        {
          potentialAction: [
            {
              '@type': 'OpenUri',
              name: 'View Proposal',
              targets: [{ os: 'default', uri: `${frontendUrl}/proposals/${proposalId}` }],
            },
          ],
        },
      ],
    });
  }

  // ==================== Zoom Integration ====================

  async getZoomAuthUrl(userId: string): Promise<string> {
    const clientId = this.configService.get('ZOOM_CLIENT_ID');
    const redirectUri = this.configService.get('ZOOM_REDIRECT_URI');

    return `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
  }

  async handleZoomCallback(userId: string, code: string): Promise<void> {
    const clientId = this.configService.get('ZOOM_CLIENT_ID');
    const clientSecret = this.configService.get('ZOOM_CLIENT_SECRET');
    const redirectUri = this.configService.get('ZOOM_REDIRECT_URI');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    await this.prisma.oAuthToken.upsert({
      where: {
        userId_provider: { userId, provider: 'zoom' },
      },
      create: {
        userId,
        provider: 'zoom',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      },
      update: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      },
    });

    this.logger.log(`Zoom connected for user ${userId}`);
  }

  async createZoomMeeting(userId: string, meeting: ZoomMeeting): Promise<ZoomMeetingResult> {
    const token = await this.getZoomToken(userId);

    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: meeting.topic,
        type: 2, // Scheduled meeting
        start_time: meeting.startTime.toISOString(),
        duration: meeting.duration,
        agenda: meeting.agenda,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          waiting_room: false,
          meeting_authentication: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      id: response.data.id.toString(),
      joinUrl: response.data.join_url,
      startUrl: response.data.start_url,
      password: response.data.password,
    };
  }

  async createProposalReviewMeeting(
    userId: string,
    proposalId: string,
    meetingDetails: {
      startTime: Date;
      duration: number;
    },
  ): Promise<ZoomMeetingResult> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      select: { title: true, recipientName: true, recipientEmail: true },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    const meeting = await this.createZoomMeeting(userId, {
      topic: `Proposal Review: ${proposal.title}`,
      startTime: meetingDetails.startTime,
      duration: meetingDetails.duration,
      agenda: `Review proposal "${proposal.title}" with ${proposal.recipientName || 'client'}`,
    });

    // Store meeting info in proposal metadata
    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        metadata: {
          ...(proposal as any).metadata,
          zoomMeeting: {
            id: meeting.id,
            joinUrl: meeting.joinUrl,
            startTime: meetingDetails.startTime.toISOString(),
          },
        },
      },
    });

    return meeting;
  }

  async getZoomMeetings(userId: string): Promise<any[]> {
    const token = await this.getZoomToken(userId);

    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { type: 'upcoming', page_size: 30 },
      },
    );

    return response.data.meetings || [];
  }

  // ==================== Helper Methods ====================

  private async getSlackToken(userId: string): Promise<string> {
    const token = await this.prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId, provider: 'slack' } },
    });

    if (!token) {
      throw new BadRequestException('Slack not connected');
    }

    return token.accessToken;
  }

  private async getZoomToken(userId: string): Promise<string> {
    const token = await this.prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId, provider: 'zoom' } },
    });

    if (!token) {
      throw new BadRequestException('Zoom not connected');
    }

    // Refresh if expired
    if (token.expiresAt && token.expiresAt < new Date() && token.refreshToken) {
      const clientId = this.configService.get('ZOOM_CLIENT_ID');
      const clientSecret = this.configService.get('ZOOM_CLIENT_SECRET');
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await axios.post(
        'https://zoom.us/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
        }),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      await this.prisma.oAuthToken.update({
        where: { id: token.id },
        data: {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        },
      });

      return response.data.access_token;
    }

    return token.accessToken;
  }

  async getConnectionStatus(userId: string): Promise<{
    slack: boolean;
    teams: boolean;
    zoom: boolean;
  }> {
    const tokens = await this.prisma.oAuthToken.findMany({
      where: { userId, provider: { in: ['slack', 'microsoft_teams', 'zoom'] } },
      select: { provider: true },
    });

    return {
      slack: tokens.some(t => t.provider === 'slack'),
      teams: tokens.some(t => t.provider === 'microsoft_teams'),
      zoom: tokens.some(t => t.provider === 'zoom'),
    };
  }

  async disconnectProvider(userId: string, provider: string): Promise<void> {
    await this.prisma.oAuthToken.deleteMany({
      where: { userId, provider },
    });
    this.logger.log(`${provider} disconnected for user ${userId}`);
  }
}
