import { IsString, IsUUID, IsOptional, IsArray, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CommunicationProvider {
  SLACK = 'slack',
  TEAMS = 'teams',
  ZOOM = 'zoom',
}

export class ConnectCommunicationDto {
  @ApiProperty({ enum: CommunicationProvider, description: 'Communication provider to connect' })
  @IsEnum(CommunicationProvider)
  provider: CommunicationProvider;

  @ApiProperty({ description: 'OAuth authorization code' })
  @IsString()
  authorizationCode: string;

  @ApiPropertyOptional({ description: 'OAuth redirect URI used' })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}

export class SendSlackMessageDto {
  @ApiProperty({ description: 'Slack channel ID or channel name' })
  @IsString()
  channel: string;

  @ApiProperty({ description: 'Message text' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Message blocks (Slack Block Kit format)' })
  @IsOptional()
  @IsArray()
  blocks?: any[];

  @ApiPropertyOptional({ description: 'Thread timestamp to reply to' })
  @IsOptional()
  @IsString()
  threadTs?: string;
}

export class SendTeamsMessageDto {
  @ApiProperty({ description: 'Teams channel ID' })
  @IsString()
  channelId: string;

  @ApiProperty({ description: 'Teams team ID' })
  @IsString()
  teamId: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Message format: text or html' })
  @IsOptional()
  @IsEnum(['text', 'html'])
  contentType?: 'text' | 'html';
}

export class CreateZoomMeetingDto {
  @ApiProperty({ description: 'Meeting topic' })
  @IsString()
  topic: string;

  @ApiPropertyOptional({ description: 'Meeting agenda' })
  @IsOptional()
  @IsString()
  agenda?: string;

  @ApiProperty({ description: 'Meeting start time in ISO format' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Meeting duration in minutes' })
  @IsNumber()
  duration: number;

  @ApiPropertyOptional({ description: 'Meeting timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Meeting password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Enable waiting room' })
  @IsOptional()
  @IsBoolean()
  waitingRoom?: boolean;

  @ApiPropertyOptional({ description: 'Auto-record setting: local, cloud, or none' })
  @IsOptional()
  @IsEnum(['local', 'cloud', 'none'])
  autoRecord?: 'local' | 'cloud' | 'none';
}

export class NotifyProposalEventDto {
  @ApiProperty({ enum: CommunicationProvider, description: 'Communication provider' })
  @IsEnum(CommunicationProvider)
  provider: CommunicationProvider;

  @ApiProperty({ description: 'Proposal ID' })
  @IsUUID()
  proposalId: string;

  @ApiProperty({ description: 'Event type', examples: ['created', 'viewed', 'signed', 'rejected'] })
  @IsString()
  eventType: string;

  @ApiPropertyOptional({ description: 'Target channel/team for notification' })
  @IsOptional()
  @IsString()
  targetChannel?: string;

  @ApiPropertyOptional({ description: 'Additional message context' })
  @IsOptional()
  @IsString()
  additionalContext?: string;
}

export class SlackMessageResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  ts: string;

  @ApiPropertyOptional()
  message?: any;
}

export class TeamsMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdDateTime: string;

  @ApiPropertyOptional()
  webUrl?: string;
}

export class ZoomMeetingResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  topic: string;

  @ApiProperty()
  startTime: string;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  joinUrl: string;

  @ApiProperty()
  startUrl: string;

  @ApiPropertyOptional()
  password?: string;
}

export class ListSlackChannelsDto {
  @ApiPropertyOptional({ description: 'Include private channels' })
  @IsOptional()
  @IsBoolean()
  includePrivate?: boolean;

  @ApiPropertyOptional({ description: 'Maximum results' })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class SlackChannelDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isPrivate: boolean;

  @ApiPropertyOptional()
  topic?: string;

  @ApiProperty()
  memberCount: number;
}
