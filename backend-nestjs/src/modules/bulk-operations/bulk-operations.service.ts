import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  BulkSendDto,
  BulkStatusUpdateDto,
  BulkTagDto,
  BulkDeleteDto,
  BulkCloneDto,
  BulkOperationResultDto,
} from './dto/bulk.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  // Bulk send proposals to multiple recipients
  async bulkSend(userId: string, dto: BulkSendDto): Promise<BulkOperationResultDto> {
    const template = await this.prisma.template.findFirst({
      where: { id: dto.templateId, userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const results: Array<{ itemId: string; result: any }> = [];
    const errors: Array<{ itemId: string; error: string }> = [];

    // Create batch job for tracking
    const batchJob = await this.prisma.batchJob.create({
      data: {
        userId,
        type: 'bulk_send',
        status: 'processing',
        totalItems: dto.recipients.length,
        processedItems: 0,
        metadata: { templateId: dto.templateId },
      },
    });

    // Process each recipient
    for (let i = 0; i < dto.recipients.length; i++) {
      const recipient = dto.recipients[i];

      try {
        // Generate unique slug
        const slug = `${uuidv4().slice(0, 8)}`;

        // Create proposal from template
        const proposal = await this.prisma.proposal.create({
          data: {
            userId,
            title: this.personalizeContent(template.name, recipient),
            slug,
            status: dto.scheduleForLater ? 'DRAFT' : 'SENT',
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            templateId: template.id,
            sentAt: dto.scheduleForLater ? null : new Date(),
          },
        });

        // Create blocks from template content
        const templateContent = template.content as any;
        if (templateContent?.blocks) {
          for (let j = 0; j < templateContent.blocks.length; j++) {
            const block = templateContent.blocks[j];
            await this.prisma.proposalBlock.create({
              data: {
                proposalId: proposal.id,
                type: block.type,
                order: j,
                content: this.personalizeBlockContent(block.content, recipient),
              },
            });
          }
        }

        // Send email if not scheduled
        if (!dto.scheduleForLater) {
          const frontendUrl = this.configService.get<string>(
            'FRONTEND_URL',
            'http://localhost:3000',
          );
          const proposalUrl = `${frontendUrl}/p/${slug}`;

          await this.emailService.send({
            to: recipient.email,
            subject: `Proposal: ${proposal.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>New Proposal: ${proposal.title}</h2>
                <p>Hello ${recipient.name || 'there'},</p>
                <p>${dto.message || 'You have received a new proposal.'}</p>
                <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                  View Proposal
                </a>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                  This proposal was sent to you via SyncQuote.
                </p>
              </div>
            `,
          });
        }

        results.push({ itemId: recipient.email, result: { proposalId: proposal.id, slug } });
      } catch (error) {
        errors.push({ itemId: recipient.email, error: error.message });
      }

      // Update batch job progress
      await this.prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { processedItems: i + 1 },
      });
    }

    // Complete batch job
    await this.prisma.batchJob.update({
      where: { id: batchJob.id },
      data: {
        status: errors.length === 0 ? 'completed' : 'completed_with_errors',
        completedAt: new Date(),
        results: { results, errors },
      } as any,
    });

    return {
      success: errors.length === 0,
      totalItems: dto.recipients.length,
      processedItems: results.length,
      failedItems: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date(),
    };
  }

  // Bulk status update
  async bulkUpdateStatus(
    userId: string,
    dto: BulkStatusUpdateDto,
  ): Promise<BulkOperationResultDto> {
    const errors: Array<{ itemId: string; error: string }> = [];
    const results: Array<{ itemId: string; result: any }> = [];

    for (const proposalId of dto.proposalIds) {
      try {
        const proposal = await this.prisma.proposal.findFirst({
          where: { id: proposalId, userId },
        });

        if (!proposal) {
          errors.push({ itemId: proposalId, error: 'Proposal not found' });
          continue;
        }

        await this.prisma.proposal.update({
          where: { id: proposalId },
          data: { status: dto.status as any },
        });

        // Log activity
        await this.prisma.activity.create({
          data: {
            type: 'status_changed',
            proposalId,
            userId,
            metadata: { newStatus: dto.status, reason: dto.reason },
          },
        });

        results.push({ itemId: proposalId, result: { status: dto.status } });
      } catch (error) {
        errors.push({ itemId: proposalId, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      totalItems: dto.proposalIds.length,
      processedItems: results.length,
      failedItems: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date(),
    };
  }

  // Bulk assign tags
  async bulkAssignTags(userId: string, dto: BulkTagDto): Promise<BulkOperationResultDto> {
    const errors: Array<{ itemId: string; error: string }> = [];
    const results: Array<{ itemId: string; result: any }> = [];

    for (const proposalId of dto.proposalIds) {
      try {
        const proposal = await this.prisma.proposal.findFirst({
          where: { id: proposalId, userId },
        });

        if (!proposal) {
          errors.push({ itemId: proposalId, error: 'Proposal not found' });
          continue;
        }

        // Assign each tag
        for (const tagId of dto.tagIds) {
          await this.prisma.proposalTagAssignment.upsert({
            where: { proposalId_tagId: { proposalId, tagId } },
            create: { proposalId, tagId },
            update: {},
          });
        }

        results.push({ itemId: proposalId, result: { tagsAssigned: dto.tagIds.length } });
      } catch (error) {
        errors.push({ itemId: proposalId, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      totalItems: dto.proposalIds.length,
      processedItems: results.length,
      failedItems: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date(),
    };
  }

  // Bulk remove tags
  async bulkRemoveTags(userId: string, dto: BulkTagDto): Promise<BulkOperationResultDto> {
    const errors: Array<{ itemId: string; error: string }> = [];
    const results: Array<{ itemId: string; result: any }> = [];

    for (const proposalId of dto.proposalIds) {
      try {
        const proposal = await this.prisma.proposal.findFirst({
          where: { id: proposalId, userId },
        });

        if (!proposal) {
          errors.push({ itemId: proposalId, error: 'Proposal not found' });
          continue;
        }

        // Remove each tag
        await this.prisma.proposalTagAssignment.deleteMany({
          where: {
            proposalId,
            tagId: { in: dto.tagIds },
          },
        });

        results.push({ itemId: proposalId, result: { tagsRemoved: dto.tagIds.length } });
      } catch (error) {
        errors.push({ itemId: proposalId, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      totalItems: dto.proposalIds.length,
      processedItems: results.length,
      failedItems: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date(),
    };
  }

  // Bulk delete proposals
  async bulkDelete(userId: string, dto: BulkDeleteDto): Promise<BulkOperationResultDto> {
    const errors: Array<{ itemId: string; error: string }> = [];
    const results: Array<{ itemId: string; result: any }> = [];

    for (const proposalId of dto.proposalIds) {
      try {
        const proposal = await this.prisma.proposal.findFirst({
          where: { id: proposalId, userId },
        });

        if (!proposal) {
          errors.push({ itemId: proposalId, error: 'Proposal not found' });
          continue;
        }

        if (dto.permanent) {
          // Hard delete
          await this.prisma.proposal.delete({ where: { id: proposalId } });
        } else {
          // Soft delete - archive
          await this.prisma.proposal.update({
            where: { id: proposalId },
            data: { status: 'DECLINED' }, // or add an 'archived' status
          });
        }

        results.push({ itemId: proposalId, result: { deleted: true, permanent: dto.permanent } });
      } catch (error) {
        errors.push({ itemId: proposalId, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      totalItems: dto.proposalIds.length,
      processedItems: results.length,
      failedItems: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date(),
    };
  }

  // Bulk clone template with variations
  async bulkClone(userId: string, dto: BulkCloneDto): Promise<BulkOperationResultDto> {
    const template = await this.prisma.template.findFirst({
      where: { id: dto.templateId, userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const errors: Array<{ itemId: string; error: string }> = [];
    const results: Array<{ itemId: string; result: any }> = [];

    for (const variation of dto.variations) {
      const count = variation.count || 1;

      for (let i = 0; i < count; i++) {
        try {
          const newName = count > 1 ? `${variation.name} (${i + 1})` : variation.name;

          // Merge modifications into template content
          const content = template.content as any;
          const modifiedContent = variation.modifications
            ? this.applyModifications(content, variation.modifications)
            : content;

          const newTemplate = await this.prisma.template.create({
            data: {
              userId,
              name: newName,
              description: template.description,
              category: template.category,
              content: modifiedContent,
              thumbnail: template.thumbnail,
            },
          });

          results.push({ itemId: newName, result: { templateId: newTemplate.id } });
        } catch (error) {
          errors.push({ itemId: variation.name, error: error.message });
        }
      }
    }

    return {
      success: errors.length === 0,
      totalItems: dto.variations.reduce((sum, v) => sum + (v.count || 1), 0),
      processedItems: results.length,
      failedItems: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date(),
    };
  }

  // Get batch jobs
  async getBatchJobs(userId: string, status?: string) {
    return this.prisma.batchJob.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // Get batch job by ID
  async getBatchJob(userId: string, jobId: string) {
    const job = await this.prisma.batchJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Batch job not found');
    }

    return job;
  }

  // Helper methods
  private personalizeContent(content: string, recipient: any): string {
    let result = content;

    if (recipient.name) {
      result = result.replace(/\{\{name\}\}/gi, recipient.name);
      result = result.replace(/\{\{firstName\}\}/gi, recipient.name.split(' ')[0]);
    }

    if (recipient.company) {
      result = result.replace(/\{\{company\}\}/gi, recipient.company);
    }

    if (recipient.email) {
      result = result.replace(/\{\{email\}\}/gi, recipient.email);
    }

    // Apply custom variables
    if (recipient.customVariables) {
      for (const [key, value] of Object.entries(recipient.customVariables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        result = result.replace(regex, value as string);
      }
    }

    return result;
  }

  private personalizeBlockContent(content: any, recipient: any): any {
    if (typeof content === 'string') {
      return this.personalizeContent(content, recipient);
    }

    if (typeof content === 'object' && content !== null) {
      const result: any = Array.isArray(content) ? [] : {};

      for (const key in content) {
        result[key] = this.personalizeBlockContent(content[key], recipient);
      }

      return result;
    }

    return content;
  }

  private applyModifications(content: any, modifications: Record<string, any>): any {
    const result = JSON.parse(JSON.stringify(content)); // Deep clone

    for (const [path, value] of Object.entries(modifications)) {
      const keys = path.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
    }

    return result;
  }
}
