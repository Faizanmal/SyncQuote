import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VersionsService {
  constructor(private prisma: PrismaService) {}

  async createVersion(proposalId: string, changeDescription?: string, createdBy?: string) {
    // Get current proposal with all blocks
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Create snapshot
    const snapshotData = {
      title: proposal.title,
      status: proposal.status,
      currency: proposal.currency,
      taxRate: proposal.taxRate,
      depositRequired: proposal.depositRequired,
      depositAmount: proposal.depositAmount,
      depositPercentage: proposal.depositPercentage,
      blocks: proposal.blocks,
      recipientEmail: proposal.recipientEmail,
      recipientName: proposal.recipientName,
    };

    // Create version record
    const version = await this.prisma.proposalVersion.create({
      data: {
        proposalId,
        version: proposal.version,
        changeDescription,
        createdBy,
        snapshotData,
      },
    });

    // Increment version number on proposal
    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: { version: proposal.version + 1 },
    });

    return version;
  }

  async getVersionHistory(proposalId: string) {
    return this.prisma.proposalVersion.findMany({
      where: { proposalId },
      orderBy: { version: 'desc' },
    });
  }

  async getVersion(versionId: string) {
    return this.prisma.proposalVersion.findUnique({
      where: { id: versionId },
    });
  }

  async compareVersions(versionId1: string, versionId2: string) {
    const [version1, version2] = await Promise.all([
      this.getVersion(versionId1),
      this.getVersion(versionId2),
    ]);

    if (!version1 || !version2) {
      throw new Error('Version not found');
    }

    // Return both snapshots for client-side comparison
    return {
      version1: {
        version: version1.version,
        data: version1.snapshotData,
        createdAt: version1.createdAt,
      },
      version2: {
        version: version2.version,
        data: version2.snapshotData,
        createdAt: version2.createdAt,
      },
    };
  }

  async restoreVersion(proposalId: string, versionId: string) {
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const snapshotData = version.snapshotData as any;

    // Delete existing blocks
    await this.prisma.proposalBlock.deleteMany({
      where: { proposalId },
    });

    // Restore proposal data and blocks
    const proposal = await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        title: snapshotData.title,
        currency: snapshotData.currency,
        taxRate: snapshotData.taxRate,
        depositRequired: snapshotData.depositRequired,
        depositAmount: snapshotData.depositAmount,
        depositPercentage: snapshotData.depositPercentage,
        blocks: {
          create: snapshotData.blocks.map((block: any) => ({
            type: block.type,
            order: block.order,
            content: block.content,
            pricingItems: block.pricingItems
              ? {
                  create: block.pricingItems.map((item: any) => ({
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    type: item.type,
                    order: item.order,
                    minQuantity: item.minQuantity,
                    maxQuantity: item.maxQuantity,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
        },
      },
    });

    // Create a new version for this restore
    await this.createVersion(proposalId, `Restored from version ${version.version}`);

    return proposal;
  }
}
