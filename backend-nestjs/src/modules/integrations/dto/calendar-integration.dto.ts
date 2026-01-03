import { IsString, IsUUID, IsOptional, IsDateString, IsObject, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CalendarProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
}

export class ConnectCalendarDto {
  @ApiProperty({ enum: CalendarProvider, description: 'Calendar provider to connect' })
  @IsEnum(CalendarProvider)
  provider: CalendarProvider;

  @ApiProperty({ description: 'OAuth authorization code' })
  @IsString()
  authorizationCode: string;

  @ApiPropertyOptional({ description: 'OAuth redirect URI used' })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}

export class CreateCalendarEventDto {
  @ApiProperty({ description: 'Event title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event start time in ISO format' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Event end time in ISO format' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Event location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'List of attendee emails' })
  @IsOptional()
  @IsString({ each: true })
  attendees?: string[];

  @ApiPropertyOptional({ description: 'Reminder minutes before event' })
  @IsOptional()
  @IsNumber()
  reminderMinutes?: number;

  @ApiPropertyOptional({ description: 'Video conference link (Zoom, Meet, etc.)' })
  @IsOptional()
  @IsString()
  videoConferenceLink?: string;
}

export class UpdateCalendarEventDto {
  @ApiPropertyOptional({ description: 'Event title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Event start time in ISO format' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Event end time in ISO format' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Event location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'List of attendee emails' })
  @IsOptional()
  @IsString({ each: true })
  attendees?: string[];
}

export class ScheduleProposalMeetingDto {
  @ApiProperty({ description: 'Proposal ID' })
  @IsUUID()
  proposalId: string;

  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Meeting title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Meeting description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Meeting start time in ISO format' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Meeting duration in minutes' })
  @IsNumber()
  durationMinutes: number;

  @ApiPropertyOptional({ description: 'Include video conference link' })
  @IsOptional()
  includeVideoLink?: boolean;

  @ApiPropertyOptional({ description: 'Additional attendee emails' })
  @IsOptional()
  @IsString({ each: true })
  additionalAttendees?: string[];
}

export class CalendarEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  videoConferenceLink?: string;

  @ApiProperty()
  htmlLink: string;

  @ApiProperty()
  status: string;
}
