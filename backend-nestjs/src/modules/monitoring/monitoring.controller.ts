import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  @Get('metrics')
  getMetrics(@Request() req: any, @Query('range') range?: string, @Query('env') env?: string) {
    return this.monitoringService.getMetrics(this.userId(req), range, env);
  }

  @Get('alerts')
  getAlerts(@Request() req: any, @Query('severity') severity?: string) {
    return this.monitoringService.listAlerts(this.userId(req), severity);
  }

  @Post('alerts/rules')
  createRule(@Request() req: any, @Body() body: any) {
    return this.monitoringService.createAlertRule(this.userId(req), body);
  }

  @Patch('alerts/:id/acknowledge')
  acknowledge(@Request() req: any, @Param('id') id: string) {
    return this.monitoringService.acknowledgeAlert(this.userId(req), id);
  }

  @Patch('alerts/:id/resolve')
  resolve(@Request() req: any, @Param('id') id: string) {
    return this.monitoringService.resolveAlert(this.userId(req), id);
  }

  @Get('performance')
  getPerformance(@Query('range') range?: string) {
    return this.monitoringService.getPerformance(range);
  }

  @Get('errors')
  getErrors(@Request() req: any, @Query('search') search?: string) {
    return this.monitoringService.listErrors(this.userId(req), search);
  }

  @Get('integrations')
  getIntegrations() {
    return this.monitoringService.getIntegrations();
  }

  @Get('deployments')
  getDeployments(@Request() req: any, @Query('env') env?: string) {
    return this.monitoringService.listDeployments(this.userId(req), env);
  }

  @Post('deployments/:id/rollback')
  rollback(@Request() req: any, @Param('id') id: string) {
    return this.monitoringService.rollbackDeployment(this.userId(req), id);
  }

  @Get('uptime')
  getUptime() {
    return this.monitoringService.getUptime();
  }
}
