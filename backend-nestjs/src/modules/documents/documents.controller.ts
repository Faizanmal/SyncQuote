import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  @Get('templates')
  listTemplates(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.documentsService.listTemplates(this.userId(req), search, category);
  }

  @Post('templates')
  createTemplate(@Request() req: any, @Body() body: any) {
    return this.documentsService.createTemplate(this.userId(req), body);
  }

  @Get('versions')
  listVersions(@Request() req: any) {
    return this.documentsService.listVersions(this.userId(req));
  }

  @Post('versions/:id/approve')
  approveVersion(@Request() req: any, @Param('id') id: string, @Body() body: { comment?: string }) {
    return this.documentsService.setVersionStatus(this.userId(req), id, 'approved', body?.comment);
  }

  @Post('versions/:id/reject')
  rejectVersion(@Request() req: any, @Param('id') id: string, @Body() body: { comment?: string }) {
    return this.documentsService.setVersionStatus(this.userId(req), id, 'rejected', body?.comment);
  }

  @Get('workflows')
  listWorkflows(@Request() req: any) {
    return this.documentsService.listWorkflows(this.userId(req));
  }

  @Post('workflows')
  createWorkflow(@Request() req: any, @Body() body: any) {
    return this.documentsService.createWorkflow(this.userId(req), body);
  }

  @Get('themes')
  listThemes(@Request() req: any) {
    return this.documentsService.listThemes(this.userId(req));
  }

  @Post('themes')
  createTheme(@Request() req: any, @Body() body: any) {
    return this.documentsService.createTheme(this.userId(req), body);
  }
}
