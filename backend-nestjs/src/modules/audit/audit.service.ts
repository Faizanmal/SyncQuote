import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogDto {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: any;
  metadata?: any;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: dto,
    });
  }

  async findAll(filters?: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.action) where.action = filters.action;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProposalHistory(proposalId: string) {
    return this.findByEntity('proposal', proposalId);
  }

  async exportLogs(userId: string, startDate?: Date, endDate?: Date) {
    const logs = await this.findAll({
      userId,
      startDate,
      endDate,
      limit: 10000, // Export up to 10k records
    });

    return logs;
  }

  // Helper methods for common audit events
  async logProposalCreated(
    proposalId: string,
    userId: string,
    userEmail: string,
    ipAddress?: string,
  ) {
    return this.log({
      action: 'create',
      entityType: 'proposal',
      entityId: proposalId,
      userId,
      userEmail,
      ipAddress,
    });
  }

  async logProposalUpdated(
    proposalId: string,
    userId: string,
    userEmail: string,
    changes: any,
    ipAddress?: string,
  ) {
    return this.log({
      action: 'update',
      entityType: 'proposal',
      entityId: proposalId,
      userId,
      userEmail,
      ipAddress,
      changes,
    });
  }

  async logProposalViewed(proposalId: string, ipAddress?: string, userAgent?: string) {
    return this.log({
      action: 'view',
      entityType: 'proposal',
      entityId: proposalId,
      ipAddress,
      userAgent,
    });
  }

  async logProposalSigned(
    proposalId: string,
    clientName: string,
    clientEmail: string,
    ipAddress?: string,
  ) {
    return this.log({
      action: 'sign',
      entityType: 'proposal',
      entityId: proposalId,
      userEmail: clientEmail,
      ipAddress,
      metadata: {
        clientName,
        signedAt: new Date(),
      },
    });
  }

  async logProposalDeleted(
    proposalId: string,
    userId: string,
    userEmail: string,
    ipAddress?: string,
  ) {
    return this.log({
      action: 'delete',
      entityType: 'proposal',
      entityId: proposalId,
      userId,
      userEmail,
      ipAddress,
    });
  }
}
