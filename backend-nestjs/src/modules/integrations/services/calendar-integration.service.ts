import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string;
  conferenceLink?: string;
  proposalId?: string;
  reminders?: { minutes: number; method: 'email' | 'popup' }[];
}

export interface CalendarIntegrationConfig {
  provider: 'google' | 'microsoft' | 'apple';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

@Injectable()
export class CalendarIntegrationService {
  private readonly logger = new Logger(CalendarIntegrationService.name);
  private oauth2Client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.oauth2Client = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_CALENDAR_REDIRECT_URI'),
    );
  }

  // Google Calendar Integration
  async getGoogleAuthUrl(userId: string, state?: string): Promise<string> {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || userId,
      prompt: 'consent',
    });
  }

  async handleGoogleCallback(userId: string, code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);

    // Find existing token
    const existing = await this.prisma.oAuthToken.findFirst({
      where: { userId, provider: 'google_calendar' },
    });

    if (existing) {
      await this.prisma.oAuthToken.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
      });
    } else {
      await this.prisma.oAuthToken.create({
        data: {
          userId,
          provider: 'google_calendar',
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
      });
    }

    this.logger.log(`Google Calendar connected for user ${userId}`);
  }

  async createEvent(userId: string, event: CalendarEvent): Promise<CalendarEvent> {
    const calendar = await this.getGoogleCalendar(userId);

    const eventResource: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'UTC',
      },
      attendees: event.attendees?.map(email => ({ email })),
      location: event.location,
      conferenceData: event.conferenceLink ? undefined : {
        createRequest: {
          requestId: `syncquote-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: event.reminders ? {
        useDefault: false,
        overrides: event.reminders.map(r => ({
          method: r.method,
          minutes: r.minutes,
        })),
      } : { useDefault: true },
    };

    // Add proposal link to description if proposalId provided
    if (event.proposalId) {
      const proposal = await this.prisma.proposal.findUnique({
        where: { id: event.proposalId },
        select: { slug: true, title: true },
      });
      if (proposal) {
        const baseUrl = this.configService.get('FRONTEND_URL') || 'https://app.syncquote.com';
        eventResource.description = `${event.description || ''}\n\nProposal: ${proposal.title}\nView: ${baseUrl}/p/${proposal.slug}`;
      }
    }

    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventResource,
      conferenceDataVersion: 1,
    });

    return {
      id: result.data.id || undefined,
      summary: result.data.summary!,
      description: result.data.description || undefined,
      start: new Date(result.data.start?.dateTime || result.data.start?.date!),
      end: new Date(result.data.end?.dateTime || result.data.end?.date!),
      conferenceLink: result.data.hangoutLink || undefined,
      location: result.data.location || undefined,
    };
  }

  async getEvents(
    userId: string, 
    startDate: Date, 
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    const calendar = await this.getGoogleCalendar(userId);

    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (result.data.items || []).map(event => ({
      id: event.id || undefined,
      summary: event.summary || 'No title',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date!),
      end: new Date(event.end?.dateTime || event.end?.date!),
      attendees: event.attendees?.map(a => a.email!).filter(Boolean),
      location: event.location || undefined,
      conferenceLink: event.hangoutLink || undefined,
    }));
  }

  async updateEvent(userId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const calendar = await this.getGoogleCalendar(userId);

    const eventResource: calendar_v3.Schema$Event = {};
    if (updates.summary) eventResource.summary = updates.summary;
    if (updates.description) eventResource.description = updates.description;
    if (updates.start) eventResource.start = { dateTime: updates.start.toISOString(), timeZone: 'UTC' };
    if (updates.end) eventResource.end = { dateTime: updates.end.toISOString(), timeZone: 'UTC' };
    if (updates.location) eventResource.location = updates.location;
    if (updates.attendees) eventResource.attendees = updates.attendees.map(email => ({ email }));

    const result = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: eventResource,
    });

    return {
      id: result.data.id || undefined,
      summary: result.data.summary!,
      description: result.data.description || undefined,
      start: new Date(result.data.start?.dateTime || result.data.start?.date!),
      end: new Date(result.data.end?.dateTime || result.data.end?.date!),
    };
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const calendar = await this.getGoogleCalendar(userId);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
  }

  async scheduleProposalFollowUp(
    userId: string,
    proposalId: string,
    followUpDate: Date,
    notes?: string,
  ): Promise<CalendarEvent> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      select: { title: true, recipientName: true, recipientEmail: true },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    const endDate = new Date(followUpDate);
    endDate.setMinutes(endDate.getMinutes() + 30);

    return this.createEvent(userId, {
      summary: `Follow up: ${proposal.title}`,
      description: `Follow up on proposal for ${proposal.recipientName || proposal.recipientEmail}\n\n${notes || ''}`,
      start: followUpDate,
      end: endDate,
      attendees: proposal.recipientEmail ? [proposal.recipientEmail] : undefined,
      proposalId,
      reminders: [
        { minutes: 60, method: 'email' },
        { minutes: 15, method: 'popup' },
      ],
    });
  }

  async scheduleProposalMeeting(
    userId: string,
    proposalId: string,
    meetingDetails: {
      title: string;
      startTime: Date;
      duration: number; // minutes
      attendees: string[];
      includeVideoConference?: boolean;
    },
  ): Promise<CalendarEvent> {
    const endTime = new Date(meetingDetails.startTime);
    endTime.setMinutes(endTime.getMinutes() + meetingDetails.duration);

    return this.createEvent(userId, {
      summary: meetingDetails.title,
      description: 'Scheduled via SyncQuote',
      start: meetingDetails.startTime,
      end: endTime,
      attendees: meetingDetails.attendees,
      proposalId,
      reminders: [
        { minutes: 1440, method: 'email' }, // 1 day before
        { minutes: 60, method: 'email' },
        { minutes: 10, method: 'popup' },
      ],
    });
  }

  private async getGoogleCalendar(userId: string): Promise<calendar_v3.Calendar> {
const token = await this.prisma.oAuthToken.findFirst({
      where: {
        userId,
        provider: 'google_calendar',
      },
    });

    if (!token) {
      throw new BadRequestException('Google Calendar not connected');
    }

    this.oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken || undefined,
    });

    // Check if token needs refresh
    if (token.expiresAt && token.expiresAt < new Date()) {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      await this.prisma.oAuthToken.update({
        where: { id: token.id },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        },
      });

      this.oauth2Client.setCredentials(credentials);
    }

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async disconnectCalendar(userId: string, provider: string): Promise<void> {
    await this.prisma.oAuthToken.deleteMany({
      where: { userId, provider: `${provider}_calendar` },
    });
    this.logger.log(`Calendar disconnected for user ${userId}`);
  }

  async getCalendarStatus(userId: string): Promise<{
    google: boolean;
    microsoft: boolean;
  }> {
    const tokens = await this.prisma.oAuthToken.findMany({
      where: { userId, provider: { contains: 'calendar' } },
      select: { provider: true },
    });

    return {
      google: tokens.some(t => t.provider === 'google_calendar'),
      microsoft: tokens.some(t => t.provider === 'microsoft_calendar'),
    };
  }
}
