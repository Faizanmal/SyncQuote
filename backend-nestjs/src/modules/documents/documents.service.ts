import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateCategory } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async listTemplates(userId: string, search?: string, category?: string) {
    const templates = await this.prisma.template.findMany({
      where: {
        OR: [{ userId }, { isPublic: true }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return templates
      .map((template) => this.serializeTemplate(template))
      .filter((template) => {
        const matchesSearch =
          !search ||
          template.name.toLowerCase().includes(search.toLowerCase()) ||
          template.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !category || category === 'all' || template.category === category;
        return matchesSearch && matchesCategory;
      });
  }

  async createTemplate(userId: string, dto: any) {
    const category = this.mapTemplateCategory(dto.category);
    const created = await this.prisma.template.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        category,
        isPublic: !!dto.isPublic,
        content: {
          uiCategory: dto.category || 'proposal',
          industry: this.asStringArray(dto.industry),
          blocks: [],
        },
      },
    });
    return this.serializeTemplate(created);
  }

  async listVersions(userId: string) {
    const versions = await this.prisma.proposalVersion.findMany({
      where: { proposal: { userId } },
      include: { proposal: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return versions.map((version) => ({
      id: version.id,
      version: `v${version.version}`,
      proposalId: version.proposalId,
      content: version.snapshotData,
      changes: version.changeDescription ? [version.changeDescription] : ['Snapshot'],
      createdBy: version.createdBy || 'You',
      createdAt: version.createdAt.toISOString(),
      size: Math.max(1, Math.round(JSON.stringify(version.snapshotData || {}).length / 1024)),
      status: version.status || 'draft',
      approvals: [],
      comments: [],
    }));
  }

  async setVersionStatus(
    userId: string,
    versionId: string,
    status: 'approved' | 'rejected',
    comment?: string,
  ) {
    const version = await this.prisma.proposalVersion.findFirst({
      where: { id: versionId, proposal: { userId } },
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }

    const updated = await this.prisma.proposalVersion.update({
      where: { id: versionId },
      data: {
        status,
        changeDescription: comment
          ? `${version.changeDescription || ''} ${comment}`.trim()
          : version.changeDescription,
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async listWorkflows(userId: string) {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map((workflow) => this.serializeWorkflow(workflow));
  }

  async createWorkflow(userId: string, dto: any) {
    const incoming = Array.isArray(dto.steps) ? dto.steps : [];
    const steps = incoming.map((step: any, index: number) =>
      this.serializeStep(step, index, userId),
    );

    if (steps.length === 0) {
      steps.push(
        this.serializeStep({ name: 'Owner approval', type: 'approval', required: true }, 0, userId),
      );
    }

    const created = await this.prisma.approvalWorkflow.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        steps,
      },
    });

    return this.serializeWorkflow(created);
  }

  async listThemes(userId: string) {
    const themes = await this.prisma.documentTheme.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return themes.map((theme) => this.serializeTheme(theme));
  }

  async createTheme(userId: string, dto: any) {
    const created = await this.prisma.documentTheme.create({
      data: {
        userId,
        name: dto.name || 'Untitled theme',
        colors: this.defaultColors(dto.colors),
        fonts: this.defaultFonts(dto.fonts),
        logo: dto.logo || '',
        isDefault: !!dto.isDefault,
      },
    });
    return this.serializeTheme(created);
  }

  private mapTemplateCategory(category?: string): TemplateCategory {
    switch ((category || '').toLowerCase()) {
      case 'proposal':
      case 'sales':
        return TemplateCategory.SALES;
      case 'contract':
      case 'legal':
        return TemplateCategory.LEGAL;
      case 'presentation':
      case 'marketing':
        return TemplateCategory.MARKETING;
      case 'consulting':
        return TemplateCategory.CONSULTING;
      default:
        return TemplateCategory.OTHER;
    }
  }

  private serializeTemplate(template: any) {
    const content = (template.content || {}) as Record<string, any>;
    return {
      id: template.id,
      name: template.name,
      description: template.description || '',
      category: content.uiCategory || this.uiCategory(template.category),
      industry: this.asStringArray(content.industry),
      thumbnail: template.thumbnail || '',
      content: template.content,
      sections: Array.isArray(content.sections) ? content.sections : [],
      popularity: template.useCount || 0,
      rating: 0,
      createdBy: template.userId,
      createdAt: template.createdAt,
      isPublic: template.isPublic,
      usage: template.useCount || 0,
    };
  }

  private uiCategory(category?: string) {
    switch (category) {
      case 'SALES':
        return 'proposal';
      case 'LEGAL':
        return 'contract';
      case 'MARKETING':
        return 'presentation';
      default:
        return 'report';
    }
  }

  private serializeWorkflow(workflow: {
    id: string;
    name: string;
    description: string | null;
    steps: unknown;
  }) {
    const rawSteps = Array.isArray(workflow.steps) ? workflow.steps : [];
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || '',
      steps: rawSteps.map((step: any, index: number) => this.serializeStep(step, index)),
    };
  }

  private serializeStep(step: any, index: number, fallbackAssignee?: string) {
    const assignees = this.asStringArray(step.assignees || step.approverIds);
    return {
      id: step.id || `step_${index + 1}`,
      name: step.name || `Step ${index + 1}`,
      type: step.type || step.description || 'approval',
      assignees: assignees.length ? assignees : fallbackAssignee ? [fallbackAssignee] : [],
      required: step.required ?? !!step.requireAllApprovers,
      order: step.order ?? index + 1,
    };
  }

  private serializeTheme(theme: any) {
    return {
      id: theme.id,
      name: theme.name,
      colors: this.defaultColors(theme.colors),
      fonts: this.defaultFonts(theme.fonts),
      logo: theme.logo || '',
      isDefault: !!theme.isDefault,
    };
  }

  private defaultColors(colors?: any) {
    return {
      primary: colors?.primary || '#2563EB',
      secondary: colors?.secondary || '#4B5563',
      accent: colors?.accent || '#10B981',
      text: colors?.text || '#111827',
      background: colors?.background || '#FFFFFF',
    };
  }

  private defaultFonts(fonts?: any) {
    return {
      heading: fonts?.heading || 'Inter',
      body: fonts?.body || 'Inter',
      monospace: fonts?.monospace || 'JetBrains Mono',
    };
  }

  private asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return [value];
    }
    return [];
  }
}
