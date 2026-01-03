import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { EmailService } from '../email/email.service';

export interface CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  message: string;
  proposalId?: string;
  metadata?: any;
  sendEmail?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        proposalId: dto.proposalId,
        metadata: dto.metadata,
      },
    });

    // Send real-time notification via WebSocket
    await this.eventsGateway.notifyUser(dto.userId, {
      type: 'notification',
      data: notification,
    });

    // Optionally send email notification
    if (dto.sendEmail) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { email: true, name: true },
      });

      if (user) {
        await this.emailService.sendNotificationEmail(
          user.email,
          user.name || 'User',
          dto.title,
          dto.message,
        );
      }
    }

    return notification;
  }

  async findAll(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent 50 notifications
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async deleteOld(userId: string, daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.prisma.notification.deleteMany({
      where: {
        userId,
        createdAt: { lt: cutoffDate },
        read: true,
      },
    });
  }

  // Helper methods for common notification types
  async notifyProposalViewed(userId: string, proposalId: string, proposalTitle: string) {
    return this.create({
      userId,
      type: 'proposal_viewed',
      title: 'Proposal Viewed',
      message: `Your proposal "${proposalTitle}" has been viewed`,
      proposalId,
      sendEmail: true,
    });
  }

  async notifyCommentAdded(
    userId: string,
    proposalId: string,
    proposalTitle: string,
    authorName: string,
  ) {
    return this.create({
      userId,
      type: 'comment_added',
      title: 'New Comment',
      message: `${authorName} commented on "${proposalTitle}"`,
      proposalId,
      sendEmail: true,
    });
  }

  async notifyProposalSigned(
    userId: string,
    proposalId: string,
    proposalTitle: string,
    clientName: string,
  ) {
    return this.create({
      userId,
      type: 'proposal_signed',
      title: 'Proposal Signed! 🎉',
      message: `${clientName} signed "${proposalTitle}"`,
      proposalId,
      sendEmail: true,
    });
  }

  async notifyProposalExpiring(
    userId: string,
    proposalId: string,
    proposalTitle: string,
    daysLeft: number,
  ) {
    return this.create({
      userId,
      type: 'proposal_expiring',
      title: 'Proposal Expiring Soon',
      message: `"${proposalTitle}" expires in ${daysLeft} days`,
      proposalId,
      sendEmail: true,
    });
  }
}
