import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { VersionsService } from './versions.service';

@Controller('versions')
export class VersionsController {
  constructor(private versionsService: VersionsService) {}

  @Post(':proposalId')
  async createVersion(
    @Param('proposalId') proposalId: string,
    @Body() body: { changeDescription?: string; createdBy?: string },
  ) {
    return this.versionsService.createVersion(proposalId, body.changeDescription, body.createdBy);
  }

  @Get('proposal/:proposalId')
  async getVersionHistory(@Param('proposalId') proposalId: string) {
    return this.versionsService.getVersionHistory(proposalId);
  }

  @Get(':versionId')
  async getVersion(@Param('versionId') versionId: string) {
    return this.versionsService.getVersion(versionId);
  }

  @Get('compare/:versionId1/:versionId2')
  async compareVersions(
    @Param('versionId1') versionId1: string,
    @Param('versionId2') versionId2: string,
  ) {
    return this.versionsService.compareVersions(versionId1, versionId2);
  }

  @Post(':proposalId/restore/:versionId')
  async restoreVersion(
    @Param('proposalId') proposalId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.versionsService.restoreVersion(proposalId, versionId);
  }
}
