import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScreenRecordingService {
  private readonly logger = new Logger(ScreenRecordingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Generate a unique recording session token
  async createRecordingSession(userId: string, proposalId?: string) {
    const token = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = await this.prisma.screenRecordingSession.create({
      data: {
        userId,
        proposalId,
        token,
        url: `${this.config.get('API_URL')}/video/screen-recording/${token}`,
        duration: 0, // Will be updated when recording completes
        status: 'pending',
      },
    });

    return {
      sessionId: session.id,
      token: session.token,
      uploadUrl: `${this.config.get('API_URL')}/video/screen-recording/upload/${session.token}`,
    };
  }

  // Update recording session status
  async updateSessionStatus(token: string, status: string, metadata?: any) {
    const session = await this.prisma.screenRecordingSession.findUnique({
      where: { token },
    });

    if (!session) {
      throw new Error('Recording session not found');
    }

    return this.prisma.screenRecordingSession.update({
      where: { token },
      data: {
        status,
        ...(metadata && { metadata }),
        ...(status === 'completed' && { completedAt: new Date() }),
      },
    });
  }

  // Get recording session
  async getSession(token: string) {
    return this.prisma.screenRecordingSession.findUnique({
      where: { token },
    });
  }

  // Link uploaded video to recording session
  async linkVideo(token: string, videoId: string) {
    return this.prisma.screenRecordingSession.update({
      where: { token },
      data: {
        videoId,
        status: 'completed',
      },
    });
  }

  // Get user's recording sessions
  async getUserSessions(userId: string) {
    return this.prisma.screenRecordingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
