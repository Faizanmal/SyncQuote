import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        ...dto,
        category: dto.category as any,
        userId,
      },
    });
  }

  async findAll(userId: string, includePublic = true) {
    const where = includePublic
      ? {
          OR: [{ userId }, { isPublic: true }],
        }
      : { userId };

    return this.prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        thumbnail: true,
        isPublic: true,
        useCount: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            name: true,
            companyName: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            companyName: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check access: owner or public template
    if (template.userId !== userId && !template.isPublic) {
      throw new ForbiddenException('Access denied');
    }

    return template;
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('You can only update your own templates');
    }

    return this.prisma.template.update({
      where: { id },
      data: {
        ...dto,
        category: dto.category ? (dto.category as any) : undefined,
      },
    });
  }

  async remove(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('You can only delete your own templates');
    }

    return this.prisma.template.delete({
      where: { id },
    });
  }

  async incrementUseCount(templateId: string) {
    return this.prisma.template.update({
      where: { id: templateId },
      data: {
        useCount: {
          increment: 1,
        },
      },
    });
  }

  async createProposalFromTemplate(templateId: string, userId: string, proposalData: any) {
    const template = await this.findOne(templateId, userId);

    // Increment use count
    await this.incrementUseCount(templateId);

    // Create proposal with template content
    const proposal = await this.prisma.proposal.create({
      data: {
        ...proposalData,
        userId,
        templateId,
      },
    });

    // Create blocks from template content
    const templateContent = template.content as any;
    if (templateContent.blocks && Array.isArray(templateContent.blocks)) {
      for (const block of templateContent.blocks) {
        await this.prisma.proposalBlock.create({
          data: {
            ...block,
            id: undefined, // Let Prisma generate new IDs
            proposalId: proposal.id,
          },
        });
      }
    }

    return this.prisma.proposal.findUnique({
      where: { id: proposal.id },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
        },
      },
    });
  }
}
