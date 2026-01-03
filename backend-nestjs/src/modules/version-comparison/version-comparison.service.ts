import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompareVersionsDto,
  CreateSnapshotDto,
  RestoreVersionDto,
  DiffOutputFormat,
  ChangeType,
  ContentChange,
  SectionDiff,
  VersionDiff,
} from './dto';
import * as diff from 'diff';

@Injectable()
export class VersionComparisonService {
  constructor(private prisma: PrismaService) {}

  /**
   * Compare two versions of a proposal
   */
  async compareVersions(userId: string, dto: CompareVersionsDto): Promise<VersionDiff> {
    // Verify proposal access
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Get both versions
    const [sourceVersion, targetVersion] = await Promise.all([
      this.prisma.proposalVersion.findUnique({ where: { id: dto.sourceVersionId } }),
      this.prisma.proposalVersion.findUnique({ where: { id: dto.targetVersionId } }),
    ]);

    if (!sourceVersion || !targetVersion) {
      throw new NotFoundException('Version not found');
    }

    if (
      sourceVersion.proposalId !== dto.proposalId ||
      targetVersion.proposalId !== dto.proposalId
    ) {
      throw new BadRequestException('Versions do not belong to the specified proposal');
    }

    // Parse content
    const sourceContent = (sourceVersion.content as any) || {};
    const targetContent = (targetVersion.content as any) || {};

    // Generate diff based on format
    const format = dto.format || DiffOutputFormat.UNIFIED;
    const sections = this.compareSections(sourceContent, targetContent, dto.sections);

    // Calculate summary
    const summary = {
      totalChanges: 0,
      addedLines: 0,
      removedLines: 0,
      modifiedSections: 0,
    };

    for (const section of sections) {
      summary.totalChanges += section.changes.length;
      summary.addedLines += section.addedLines;
      summary.removedLines += section.removedLines;
      if (section.changes.length > 0) {
        summary.modifiedSections++;
      }
    }

    // Build metadata comparison if requested
    let metadata: any = undefined;
    if (dto.includeMetadata) {
      metadata = {
        titleChanged: sourceVersion.title !== targetVersion.title,
        statusChanged: sourceVersion.status !== targetVersion.status,
        pricingChanged: this.comparePricing(sourceContent, targetContent),
      };
    }

    return {
      sourceVersion: {
        id: sourceVersion.id,
        number: sourceVersion.version,
        createdAt: sourceVersion.createdAt,
        createdBy: sourceVersion.createdBy || undefined,
      },
      targetVersion: {
        id: targetVersion.id,
        number: targetVersion.version,
        createdAt: targetVersion.createdAt,
        createdBy: targetVersion.createdBy || undefined,
      },
      summary,
      sections,
      metadata,
    };
  }

  /**
   * Compare content sections
   */
  private compareSections(
    sourceContent: any,
    targetContent: any,
    filterSections?: string[],
  ): SectionDiff[] {
    const sectionDiffs: SectionDiff[] = [];

    // Get all unique section keys
    const allSections = new Set([
      ...Object.keys(sourceContent.sections || {}),
      ...Object.keys(targetContent.sections || {}),
    ]);

    // Apply filter if specified
    const sectionsToCompare = filterSections?.length
      ? [...allSections].filter((s) => filterSections.includes(s))
      : [...allSections];

    for (const sectionKey of sectionsToCompare) {
      const sourceSection = sourceContent.sections?.[sectionKey] || {};
      const targetSection = targetContent.sections?.[sectionKey] || {};

      const changes: ContentChange[] = [];
      let addedLines = 0;
      let removedLines = 0;

      // Compare section content (text)
      if (sourceSection.content || targetSection.content) {
        const sourceText = sourceSection.content || '';
        const targetText = targetSection.content || '';

        if (sourceText !== targetText) {
          const textDiff = diff.diffLines(sourceText, targetText);
          let lineNumber = 1;

          for (const part of textDiff) {
            if (part.added) {
              changes.push({
                type: ChangeType.ADDED,
                path: `${sectionKey}.content`,
                newValue: part.value,
                lineNumber,
              });
              addedLines += part.count || 1;
            } else if (part.removed) {
              changes.push({
                type: ChangeType.REMOVED,
                path: `${sectionKey}.content`,
                oldValue: part.value,
                lineNumber,
              });
              removedLines += part.count || 1;
            }
            lineNumber += part.count || 1;
          }
        }
      }

      // Compare section properties
      const propertiesToCompare = ['title', 'subtitle', 'order', 'visible'];
      for (const prop of propertiesToCompare) {
        if (sourceSection[prop] !== targetSection[prop]) {
          changes.push({
            type: this.getChangeType(sourceSection[prop], targetSection[prop]),
            path: `${sectionKey}.${prop}`,
            oldValue: sourceSection[prop],
            newValue: targetSection[prop],
          });
        }
      }

      sectionDiffs.push({
        sectionId: sectionKey,
        sectionName: targetSection.title || sourceSection.title || sectionKey,
        changes,
        addedLines,
        removedLines,
        modifiedLines: changes.filter((c) => c.type === ChangeType.MODIFIED).length,
      });
    }

    // Compare line items / pricing if present
    const pricingDiff = this.comparePricingDetails(sourceContent, targetContent);
    if (pricingDiff.changes.length > 0) {
      sectionDiffs.push(pricingDiff);
    }

    return sectionDiffs;
  }

  /**
   * Compare pricing/line items
   */
  private comparePricingDetails(sourceContent: any, targetContent: any): SectionDiff {
    const changes: ContentChange[] = [];
    const sourceItems = sourceContent.lineItems || [];
    const targetItems = targetContent.lineItems || [];

    // Create maps for easier comparison
    const sourceMap = new Map(sourceItems.map((item: any) => [item.id, item]));
    const targetMap = new Map(targetItems.map((item: any) => [item.id, item]));

    // Find added items
    for (const [id, item] of targetMap) {
      if (!sourceMap.has(id)) {
        changes.push({
          type: ChangeType.ADDED,
          path: `lineItems.${id}`,
          newValue: item,
        });
      }
    }

    // Find removed items
    for (const [id, item] of sourceMap) {
      if (!targetMap.has(id)) {
        changes.push({
          type: ChangeType.REMOVED,
          path: `lineItems.${id}`,
          oldValue: item,
        });
      }
    }

    // Find modified items
    for (const [id, sourceItem] of sourceMap) {
      const targetItem = targetMap.get(id);
      if (targetItem) {
        const itemChanges = this.compareObjects(
          sourceItem as any,
          targetItem as any,
          `lineItems.${id}`,
        );
        changes.push(...itemChanges);
      }
    }

    return {
      sectionId: 'pricing',
      sectionName: 'Pricing & Line Items',
      changes,
      addedLines: changes.filter((c) => c.type === ChangeType.ADDED).length,
      removedLines: changes.filter((c) => c.type === ChangeType.REMOVED).length,
      modifiedLines: changes.filter((c) => c.type === ChangeType.MODIFIED).length,
    };
  }

  /**
   * Compare two objects and return changes
   */
  private compareObjects(source: any, target: any, basePath: string): ContentChange[] {
    const changes: ContentChange[] = [];
    const allKeys = new Set([...Object.keys(source || {}), ...Object.keys(target || {})]);

    for (const key of allKeys) {
      const path = `${basePath}.${key}`;
      const sourceVal = source?.[key];
      const targetVal = target?.[key];

      if (JSON.stringify(sourceVal) !== JSON.stringify(targetVal)) {
        changes.push({
          type: this.getChangeType(sourceVal, targetVal),
          path,
          oldValue: sourceVal,
          newValue: targetVal,
        });
      }
    }

    return changes;
  }

  /**
   * Determine change type based on old/new values
   */
  private getChangeType(oldValue: any, newValue: any): ChangeType {
    if (oldValue === undefined || oldValue === null) return ChangeType.ADDED;
    if (newValue === undefined || newValue === null) return ChangeType.REMOVED;
    return ChangeType.MODIFIED;
  }

  /**
   * Check if pricing changed
   */
  private comparePricing(sourceContent: any, targetContent: any): boolean {
    const sourcePricing = sourceContent.pricing || sourceContent.lineItems;
    const targetPricing = targetContent.pricing || targetContent.lineItems;
    return JSON.stringify(sourcePricing) !== JSON.stringify(targetPricing);
  }

  /**
   * Get version history with optional diffs
   */
  async getVersionHistory(userId: string, proposalId: string, includeDiffs: boolean = false) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const versions = await this.prisma.proposalVersion.findMany({
      where: { proposalId },
      orderBy: { version: 'desc' },
    });

    // Add diffs between consecutive versions if requested
    if (includeDiffs && versions.length > 1) {
      const versionsWithDiffs = [];
      for (let i = 0; i < versions.length; i++) {
        const version = versions[i];
        let diffFromPrevious = null;

        if (i < versions.length - 1) {
          const prevVersion = versions[i + 1];
          diffFromPrevious = await this.compareVersions(userId, {
            proposalId,
            sourceVersionId: prevVersion.id,
            targetVersionId: version.id,
          });
        }

        versionsWithDiffs.push({
          ...version,
          diffFromPrevious,
        });
      }
      return versionsWithDiffs;
    }

    return versions;
  }

  /**
   * Create named snapshot
   */
  async createSnapshot(userId: string, dto: CreateSnapshotDto) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Get highest version number
    const lastVersion = await this.prisma.proposalVersion.findFirst({
      where: { proposalId: dto.proposalId },
      orderBy: { version: 'desc' },
    });

    const newVersionNumber = (lastVersion?.version || 0) + 1;

    // Create snapshot version
    const snapshot = await this.prisma.proposalVersion.create({
      data: {
        proposalId: dto.proposalId,
        version: (lastVersion?.version || 0) + 1,
        versionNumber: newVersionNumber,
        title: proposal.title,
        content: proposal.content as any,
        status: proposal.status,
        createdBy: userId,
        changeDescription: dto.description || dto.name,
        snapshotData: {
          name: dto.name,
          description: dto.description,
          proposal: proposal,
        } as any,
        isAutoSnapshot: dto.isAutoSnapshot || false,
      },
    });

    return snapshot;
  }

  /**
   * Restore proposal to a specific version
   */
  async restoreVersion(userId: string, dto: RestoreVersionDto) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const version = await this.prisma.proposalVersion.findFirst({
      where: { id: dto.versionId, proposalId: dto.proposalId },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    // Create a new version before restoring (to preserve current state)
    await this.createSnapshot(userId, {
      proposalId: dto.proposalId,
      name: `Before restore to v${version.version}`,
      description: dto.comment || 'Auto-saved before restore',
      isAutoSnapshot: true,
    });

    // Restore proposal content
    const restored = await this.prisma.proposal.update({
      where: { id: dto.proposalId },
      data: {
        title: version.title,
        content: version.content as any,
      },
    });

    // Create version record for the restore
    await this.createSnapshot(userId, {
      proposalId: dto.proposalId,
      name: `Restored from v${version.version}`,
      description: dto.comment,
    });

    return restored;
  }

  /**
   * Get inline diff HTML for display
   */
  async getInlineDiff(userId: string, dto: CompareVersionsDto): Promise<string> {
    const [sourceVersion, targetVersion] = await Promise.all([
      this.prisma.proposalVersion.findUnique({ where: { id: dto.sourceVersionId } }),
      this.prisma.proposalVersion.findUnique({ where: { id: dto.targetVersionId } }),
    ]);

    if (!sourceVersion || !targetVersion) {
      throw new NotFoundException('Version not found');
    }

    const sourceContent = (sourceVersion.content as any)?.htmlContent || '';
    const targetContent = (targetVersion.content as any)?.htmlContent || '';

    // Generate word-level diff
    const diffResult = diff.diffWords(sourceContent, targetContent);

    let html = '';
    for (const part of diffResult) {
      if (part.added) {
        html += `<ins class="diff-added">${this.escapeHtml(part.value)}</ins>`;
      } else if (part.removed) {
        html += `<del class="diff-removed">${this.escapeHtml(part.value)}</del>`;
      } else {
        html += this.escapeHtml(part.value);
      }
    }

    return html;
  }

  /**
   * Get side-by-side comparison data
   */
  async getSideBySideComparison(userId: string, dto: CompareVersionsDto) {
    const [sourceVersion, targetVersion] = await Promise.all([
      this.prisma.proposalVersion.findUnique({ where: { id: dto.sourceVersionId } }),
      this.prisma.proposalVersion.findUnique({ where: { id: dto.targetVersionId } }),
    ]);

    if (!sourceVersion || !targetVersion) {
      throw new NotFoundException('Version not found');
    }

    const sourceContent = (sourceVersion.content as any)?.htmlContent || '';
    const targetContent = (targetVersion.content as any)?.htmlContent || '';

    const sourceLines = sourceContent.split('\n');
    const targetLines = targetContent.split('\n');

    // Use line diff for side-by-side
    const lineDiff = diff.diffArrays(sourceLines, targetLines);

    const sideBySide: Array<{
      lineNumber: number;
      source: { content: string; type: ChangeType };
      target: { content: string; type: ChangeType };
    }> = [];

    let sourceLineNum = 1;
    let targetLineNum = 1;

    for (const part of lineDiff) {
      if (part.added) {
        for (const line of part.value) {
          sideBySide.push({
            lineNumber: targetLineNum++,
            source: { content: '', type: ChangeType.UNCHANGED },
            target: { content: line, type: ChangeType.ADDED },
          });
        }
      } else if (part.removed) {
        for (const line of part.value) {
          sideBySide.push({
            lineNumber: sourceLineNum++,
            source: { content: line, type: ChangeType.REMOVED },
            target: { content: '', type: ChangeType.UNCHANGED },
          });
        }
      } else {
        for (const line of part.value) {
          sideBySide.push({
            lineNumber: sourceLineNum,
            source: { content: line, type: ChangeType.UNCHANGED },
            target: { content: line, type: ChangeType.UNCHANGED },
          });
          sourceLineNum++;
          targetLineNum++;
        }
      }
    }

    return {
      sourceVersion: {
        id: sourceVersion.id,
        number: sourceVersion.version,
        createdAt: sourceVersion.createdAt,
      },
      targetVersion: {
        id: targetVersion.id,
        number: targetVersion.version,
        createdAt: targetVersion.createdAt,
      },
      comparison: sideBySide,
    };
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
