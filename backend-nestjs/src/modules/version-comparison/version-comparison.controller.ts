import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { VersionComparisonService } from './version-comparison.service';
import { CompareVersionsDto, CreateSnapshotDto, RestoreVersionDto, DiffOutputFormat } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('version-comparison')
@UseGuards(JwtAuthGuard)
export class VersionComparisonController {
  constructor(private readonly versionComparisonService: VersionComparisonService) {}

  /**
   * Compare two versions
   */
  @Post('compare')
  async compareVersions(@Request() req: any, @Body() dto: CompareVersionsDto) {
    return this.versionComparisonService.compareVersions(req.user.id, dto);
  }

  /**
   * Get version history for a proposal
   */
  @Get('proposals/:proposalId/history')
  async getVersionHistory(
    @Request() req: any,
    @Param('proposalId') proposalId: string,
    @Query('includeDiffs') includeDiffs?: boolean,
  ) {
    return this.versionComparisonService.getVersionHistory(
      req.user.id,
      proposalId,
      includeDiffs === true,
    );
  }

  /**
   * Create a named snapshot
   */
  @Post('snapshots')
  async createSnapshot(@Request() req: any, @Body() dto: CreateSnapshotDto) {
    return this.versionComparisonService.createSnapshot(req.user.id, dto);
  }

  /**
   * Restore to a specific version
   */
  @Post('restore')
  async restoreVersion(@Request() req: any, @Body() dto: RestoreVersionDto) {
    return this.versionComparisonService.restoreVersion(req.user.id, dto);
  }

  /**
   * Get inline diff HTML
   */
  @Post('inline-diff')
  async getInlineDiff(@Request() req: any, @Body() dto: CompareVersionsDto) {
    const html = await this.versionComparisonService.getInlineDiff(req.user.id, dto);
    return { html };
  }

  /**
   * Get side-by-side comparison
   */
  @Post('side-by-side')
  async getSideBySideComparison(@Request() req: any, @Body() dto: CompareVersionsDto) {
    return this.versionComparisonService.getSideBySideComparison(req.user.id, dto);
  }

  /**
   * Quick compare: compare with previous version
   */
  @Get('proposals/:proposalId/versions/:versionId/diff-previous')
  async compareWithPrevious(
    @Request() req: any,
    @Param('proposalId') proposalId: string,
    @Param('versionId') versionId: string,
  ) {
    // Implementation would find previous version and compare
    return this.versionComparisonService.compareVersions(req.user.id, {
      proposalId,
      sourceVersionId: versionId, // Service would need to find previous
      targetVersionId: versionId,
    });
  }
}
