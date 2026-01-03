import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSnippetDto {
  name: string;
  description?: string;
  content: string;
  category?: string;
  variables?: { name: string; defaultValue: string; description?: string }[];
  tags?: string[];
  isGlobal?: boolean;
}

export interface UpdateSnippetDto extends Partial<CreateSnippetDto> {}

export interface ProcessedSnippet {
  content: string;
  usedVariables: string[];
}

@Injectable()
export class SnippetsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: CreateSnippetDto) {
    return this.prisma.snippet.create({
      data: {
        name: data.name,
        description: data.description,
        content: data.content,
        category: data.category,
        variables: data.variables || [],
        tags: data.tags || [],
        isGlobal: data.isGlobal || false,
        userId,
      },
    });
  }

  async findAll(
    userId: string,
    options?: {
      category?: string;
      search?: string;
      tags?: string[];
      includeGlobal?: boolean;
    },
  ) {
    const where: any = {
      OR: [{ userId }, ...(options?.includeGlobal !== false ? [{ isGlobal: true }] : [])],
    };

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
            { content: { contains: options.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (options?.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }

    return this.prisma.snippet.findMany({
      where,
      orderBy: [{ useCount: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const snippet = await this.prisma.snippet.findUnique({
      where: { id },
    });

    if (!snippet) {
      throw new NotFoundException('Snippet not found');
    }

    // Check access: owned by user or global
    if (snippet.userId !== userId && !snippet.isGlobal) {
      throw new ForbiddenException('Access denied');
    }

    return snippet;
  }

  async update(id: string, userId: string, data: UpdateSnippetDto) {
    const snippet = await this.findOne(id, userId);

    // Only owner can edit
    if (snippet.userId !== userId) {
      throw new ForbiddenException('Only the owner can edit this snippet');
    }

    return this.prisma.snippet.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.content && { content: data.content }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.variables && { variables: data.variables }),
        ...(data.tags && { tags: data.tags }),
        ...(data.isGlobal !== undefined && { isGlobal: data.isGlobal }),
      },
    });
  }

  async delete(id: string, userId: string) {
    const snippet = await this.findOne(id, userId);

    if (snippet.userId !== userId) {
      throw new ForbiddenException('Only the owner can delete this snippet');
    }

    return this.prisma.snippet.delete({ where: { id } });
  }

  async trackUsage(id: string) {
    return this.prisma.snippet.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async processSnippet(
    id: string,
    userId: string,
    variables: Record<string, string>,
  ): Promise<ProcessedSnippet> {
    const snippet = await this.findOne(id, userId);

    // Track usage
    await this.trackUsage(id);

    let processedContent = snippet.content;
    const usedVariables: string[] = [];

    // Replace variables in content
    // Variables are in format {{variable_name}}
    const variablePattern = /\{\{(\w+)\}\}/g;
    processedContent = processedContent.replace(
      variablePattern,
      (match: string, varName: string) => {
        usedVariables.push(varName);

        // Use provided value, snippet default, or leave as-is
        if (variables[varName] !== undefined) {
          return variables[varName];
        }

        // Check snippet's default variables
        type SnippetVariable = { name: string; defaultValue?: string };
        const snippetVars = (snippet.variables as SnippetVariable[]) || [];
        const defaultVar = snippetVars.find((v: SnippetVariable) => v.name === varName);
        if (defaultVar?.defaultValue) {
          return defaultVar.defaultValue;
        }

        return match; // Leave unchanged if no value found
      },
    );

    return {
      content: processedContent,
      usedVariables,
    };
  }

  async getCategories(userId: string) {
    const snippets = await this.prisma.snippet.findMany({
      where: {
        OR: [{ userId }, { isGlobal: true }],
      },
      select: { category: true },
      distinct: ['category'],
    });

    return snippets
      .map((s: any) => s.category)
      .filter((c): c is string => c !== null)
      .sort();
  }

  async getTags(userId: string) {
    const snippets = await this.prisma.snippet.findMany({
      where: {
        OR: [{ userId }, { isGlobal: true }],
      },
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    snippets.forEach((s) => s.tags.forEach((t) => tagSet.add(t)));

    return Array.from(tagSet).sort();
  }

  async duplicateSnippet(id: string, userId: string, newName?: string) {
    const snippet = await this.findOne(id, userId);

    return this.prisma.snippet.create({
      data: {
        name: newName || `${snippet.name} (Copy)`,
        description: snippet.description,
        content: snippet.content,
        category: snippet.category,
        variables: snippet.variables || [],
        tags: snippet.tags,
        isGlobal: false, // Duplicates are always private
        userId,
      },
    });
  }
}
