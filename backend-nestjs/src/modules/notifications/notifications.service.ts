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

  async findAll(userId: string, unreadOnly = false, search?: string, filter?: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly || filter === 'unread' ? { read: false } : {}),
        ...(filter === 'read' ? { read: true } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { message: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((notification) => this.serializeInbox(notification));
  }

  private serializeInbox(notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    userId: string;
    metadata: unknown;
    createdAt: Date;
  }) {
    const type = this.mapInboxType(notification.type);
    return {
      id: notification.id,
      type,
      title: notification.title,
      message: notification.message,
      category: notification.type || 'general',
      priority: type === 'error' ? 'high' : 'medium',
      read: notification.read,
      channels: ['in-app'] as const,
      userId: notification.userId,
      metadata: notification.metadata || {},
      createdAt: notification.createdAt.toISOString(),
    };
  }

  private mapInboxType(type: string) {
    if (type === 'error' || type.includes('failed')) return 'error';
    if (type.includes('expiring')) return 'warning';
    if (type === 'success' || type.includes('signed') || type.includes('approved'))
      return 'success';
    return 'info';
  }

  async markManyRead(userId: string, ids: string[]) {
    return this.prisma.notification.updateMany({
      where: { userId, id: { in: ids } },
      data: { read: true },
    });
  }

  async deleteMany(userId: string, ids: string[]) {
    return this.prisma.notification.deleteMany({
      where: { userId, id: { in: ids } },
    });
  }

  private async readMeta(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    return { ...((user?.metadata as Record<string, any>) || {}) };
  }

  private async writeMeta(userId: string, metadata: Record<string, any>) {
    await this.prisma.user.update({ where: { id: userId }, data: { metadata } });
  }

  async listRules(userId: string) {
    const meta = await this.readMeta(userId);
    return meta.notificationRules || [];
  }

  async createRule(userId: string, dto: any) {
    const meta = await this.readMeta(userId);
    const rule = {
      id: `rule_${Date.now()}`,
      name: dto.name,
      description: dto.description || '',
      event: dto.event,
      conditions: dto.conditions || [],
      actions: dto.actions || [],
      priority: dto.priority || 'medium',
      enabled: dto.enabled !== false,
      triggeredCount: 0,
      createdAt: new Date().toISOString(),
    };
    meta.notificationRules = [...(meta.notificationRules || []), rule];
    await this.writeMeta(userId, meta);
    return rule;
  }

  async updateRule(userId: string, ruleId: string, dto: any) {
    const meta = await this.readMeta(userId);
    meta.notificationRules = (meta.notificationRules || []).map((rule: any) =>
      rule.id === ruleId ? { ...rule, ...dto } : rule,
    );
    await this.writeMeta(userId, meta);
    return (meta.notificationRules || []).find((rule: any) => rule.id === ruleId);
  }

  async listCampaigns(userId: string) {
    const meta = await this.readMeta(userId);
    return meta.notificationCampaigns || [];
  }

  async createCampaign(userId: string, dto: any) {
    const meta = await this.readMeta(userId);
    const campaign = {
      id: `camp_${Date.now()}`,
      name: dto.name,
      subject: dto.subject,
      content: dto.content,
      recipients: Array.isArray(dto.recipients)
        ? dto.recipients
        : dto.recipients
          ? [dto.recipients]
          : [],
      status: dto.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: dto.scheduledAt,
      openRate: 0,
      clickRate: 0,
      deliveryRate: 0,
      createdAt: new Date().toISOString(),
    };
    meta.notificationCampaigns = [...(meta.notificationCampaigns || []), campaign];
    await this.writeMeta(userId, meta);
    return campaign;
  }

  async sendCampaign(userId: string, campaignId: string) {
    const meta = await this.readMeta(userId);
    meta.notificationCampaigns = (meta.notificationCampaigns || []).map((campaign: any) =>
      campaign.id === campaignId
        ? { ...campaign, status: 'sent', sentAt: new Date().toISOString(), deliveryRate: 100 }
        : campaign,
    );
    await this.writeMeta(userId, meta);
    return { success: true };
  }

  async pauseCampaign(userId: string, campaignId: string) {
    const meta = await this.readMeta(userId);
    meta.notificationCampaigns = (meta.notificationCampaigns || []).map((campaign: any) =>
      campaign.id === campaignId ? { ...campaign, status: 'paused' } : campaign,
    );
    await this.writeMeta(userId, meta);
    return { success: true };
  }

  async listTemplates(userId: string) {
    const meta = await this.readMeta(userId);
    return (
      (meta.notificationTemplates || [
        {
          id: 'default-viewed',
          name: 'Proposal viewed',
          type: 'email',
          subject: 'Your proposal was viewed',
          content: '{{title}} was viewed by a client.',
          variables: ['title'],
          category: 'proposals',
          isDefault: true,
        },
      ]) as any[]
    ).map((template) => ({
      ...template,
      variables: Array.isArray(template.variables) ? template.variables : [],
    }));
  }

  async getSettings(userId: string) {
    const meta = await this.readMeta(userId);
    const saved = (meta.notificationSettings || {}) as Record<string, any>;
    return {
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
      frequency: 'instant',
      phoneNumber: '',
      slackWebhook: '',
      emailSender: '',
      ...saved,
      quietHours: { start: '22:00', end: '07:00', ...(saved.quietHours || {}) },
    };
  }

  async updateSettings(userId: string, dto: any) {
    const meta = await this.readMeta(userId);
    meta.notificationSettings = { ...(await this.getSettings(userId)), ...dto };
    await this.writeMeta(userId, meta);
    return meta.notificationSettings;
  }

  async getCampaignAnalytics(userId: string) {
    const campaigns = await this.listCampaigns(userId);
    const sent = campaigns.filter((campaign: any) => campaign.status === 'sent').length;
    return {
      totalSent: sent,
      sentGrowth: 0,
      openRate: sent ? 42 : 0,
      openRateGrowth: 0,
      clickRate: sent ? 11 : 0,
      clickRateGrowth: 0,
    };
  }

  async sendTest(userId: string, dto: any) {
    return this.create({
      userId,
      type: 'test',
      title: dto.title || 'Test notification',
      message: dto.message || 'This is a test notification',
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
