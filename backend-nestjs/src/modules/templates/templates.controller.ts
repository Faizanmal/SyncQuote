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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  @Post()
  create(@Request() req: any, @Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(this.userId(req), createTemplateDto);
  }

  @Get()
  findAll(@Request() req: any, @Query('includePublic') includePublic?: string) {
    const include = includePublic !== 'false';
    return this.templatesService.findAll(this.userId(req), include);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.templatesService.findOne(id, this.userId(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, this.userId(req), updateTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.templatesService.remove(id, this.userId(req));
  }

  @Post(':id/use')
  createFromTemplate(@Param('id') id: string, @Request() req: any, @Body() proposalData: any) {
    return this.templatesService.createProposalFromTemplate(id, this.userId(req), proposalData);
  }
}
