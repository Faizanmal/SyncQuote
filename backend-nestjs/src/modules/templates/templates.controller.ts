import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  create(@Request() req: any, @Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(req.user.userId, createTemplateDto);
  }

  @Get()
  findAll(@Request() req: any, @Query('includePublic') includePublic?: string) {
    const include = includePublic !== 'false';
    return this.templatesService.findAll(req.user.userId, include);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.templatesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, req.user.userId, updateTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.templatesService.remove(id, req.user.userId);
  }

  @Post(':id/use')
  createFromTemplate(@Param('id') id: string, @Request() req: any, @Body() proposalData: any) {
    return this.templatesService.createProposalFromTemplate(id, req.user.userId, proposalData);
  }
}
