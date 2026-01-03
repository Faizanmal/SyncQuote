import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AutomationService, CreateWorkflowDto, UpdateWorkflowDto } from './automation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('templates')
  getTemplates() {
    return this.automationService.getWorkflowTemplates();
  }

  @Post()
  async create(@Req() req: any, @Body() data: CreateWorkflowDto) {
    return this.automationService.create(req.user.sub, data);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.automationService.findAll(req.user.sub);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.automationService.findOne(id, req.user.sub);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() data: UpdateWorkflowDto) {
    return this.automationService.update(id, req.user.sub, data);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.automationService.delete(id, req.user.sub);
  }

  @Post(':id/toggle')
  async toggle(@Req() req: any, @Param('id') id: string) {
    return this.automationService.toggle(id, req.user.sub);
  }
}
