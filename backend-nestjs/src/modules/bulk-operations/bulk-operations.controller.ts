import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkOperationsService } from './bulk-operations.service';
import { BulkExportService } from './bulk-export.service';
import {
  BulkSendDto,
  BulkStatusUpdateDto,
  BulkTagDto,
  BulkDeleteDto,
  BulkCloneDto,
  BulkExportDto,
  BulkAnalyticsReportDto,
} from './dto/bulk.dto';

@ApiTags('Bulk Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bulk')
export class BulkOperationsController {
  constructor(
    private readonly bulkService: BulkOperationsService,
    private readonly exportService: BulkExportService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Bulk send proposals to multiple recipients' })
  async bulkSend(@Request() req: any, @Body() dto: BulkSendDto) {
    return this.bulkService.bulkSend(req.user.id, dto);
  }

  @Post('status')
  @ApiOperation({ summary: 'Bulk update proposal status' })
  async bulkUpdateStatus(@Request() req: any, @Body() dto: BulkStatusUpdateDto) {
    return this.bulkService.bulkUpdateStatus(req.user.id, dto);
  }

  @Post('tags/assign')
  @ApiOperation({ summary: 'Bulk assign tags to proposals' })
  async bulkAssignTags(@Request() req: any, @Body() dto: BulkTagDto) {
    return this.bulkService.bulkAssignTags(req.user.id, dto);
  }

  @Post('tags/remove')
  @ApiOperation({ summary: 'Bulk remove tags from proposals' })
  async bulkRemoveTags(@Request() req: any, @Body() dto: BulkTagDto) {
    return this.bulkService.bulkRemoveTags(req.user.id, dto);
  }

  @Post('delete')
  @ApiOperation({ summary: 'Bulk delete proposals' })
  async bulkDelete(@Request() req: any, @Body() dto: BulkDeleteDto) {
    return this.bulkService.bulkDelete(req.user.id, dto);
  }

  @Post('clone')
  @ApiOperation({ summary: 'Bulk clone template with variations' })
  async bulkClone(@Request() req: any, @Body() dto: BulkCloneDto) {
    return this.bulkService.bulkClone(req.user.id, dto);
  }

  @Post('export')
  @ApiOperation({ summary: 'Bulk export proposals' })
  async bulkExport(@Request() req: any, @Body() dto: BulkExportDto) {
    return this.exportService.exportProposals(req.user.id, dto);
  }

  @Post('analytics-report')
  @ApiOperation({ summary: 'Generate bulk analytics report' })
  async generateAnalyticsReport(@Request() req: any, @Body() dto: BulkAnalyticsReportDto) {
    return this.exportService.generateAnalyticsReport(req.user.id, dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get batch jobs' })
  async getBatchJobs(@Request() req: any, @Query('status') status?: string) {
    return this.bulkService.getBatchJobs(req.user.id, status);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get batch job by ID' })
  async getBatchJob(@Request() req: any, @Param('id') id: string) {
    return this.bulkService.getBatchJob(req.user.id, id);
  }
}
