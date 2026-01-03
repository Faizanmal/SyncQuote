import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SnippetsService, CreateSnippetDto, UpdateSnippetDto } from './snippets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('snippets')
@UseGuards(JwtAuthGuard)
export class SnippetsController {
  constructor(private readonly snippetsService: SnippetsService) {}

  @Post()
  async create(@Req() req: any, @Body() data: CreateSnippetDto) {
    return this.snippetsService.create(req.user.sub, data);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('includeGlobal') includeGlobal?: string,
  ) {
    return this.snippetsService.findAll(req.user.sub, {
      category,
      search,
      tags: tags ? tags.split(',') : undefined,
      includeGlobal: includeGlobal !== 'false',
    });
  }

  @Get('categories')
  async getCategories(@Req() req: any) {
    return this.snippetsService.getCategories(req.user.sub);
  }

  @Get('tags')
  async getTags(@Req() req: any) {
    return this.snippetsService.getTags(req.user.sub);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.snippetsService.findOne(id, req.user.sub);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() data: UpdateSnippetDto) {
    return this.snippetsService.update(id, req.user.sub, data);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.snippetsService.delete(id, req.user.sub);
  }

  @Post(':id/use')
  async trackUsage(@Param('id') id: string) {
    return this.snippetsService.trackUsage(id);
  }

  @Post(':id/process')
  async processSnippet(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { variables: Record<string, string> },
  ) {
    return this.snippetsService.processSnippet(id, req.user.sub, body.variables);
  }

  @Post(':id/duplicate')
  async duplicateSnippet(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    return this.snippetsService.duplicateSnippet(id, req.user.sub, body.name);
  }
}
