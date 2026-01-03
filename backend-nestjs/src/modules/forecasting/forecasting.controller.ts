import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('forecasting')
@UseGuards(JwtAuthGuard)
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  // Pipeline Stages
  @Get('pipeline/stages')
  async getPipelineStages(@Req() req: any) {
    return this.forecastingService.getPipelineStages(req.user.sub);
  }

  @Post('pipeline/stages')
  async createPipelineStage(
    @Req() req: any,
    @Body() data: { name: string; order: number; probability: number; color?: string },
  ) {
    return this.forecastingService.createPipelineStage(req.user.sub, data);
  }

  @Put('pipeline/stages/:id')
  async updatePipelineStage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { name?: string; order?: number; probability?: number; color?: string },
  ) {
    return this.forecastingService.updatePipelineStage(id, req.user.sub, data);
  }

  @Delete('pipeline/stages/:id')
  async deletePipelineStage(@Req() req: any, @Param('id') id: string) {
    return this.forecastingService.deletePipelineStage(id, req.user.sub);
  }

  @Post('pipeline/stages/initialize')
  async initializeDefaultStages(@Req() req: any) {
    return this.forecastingService.initializeDefaultStages(req.user.sub);
  }

  // Pipeline Data
  @Get('pipeline')
  async getPipelineData(@Req() req: any) {
    return this.forecastingService.getPipelineData(req.user.sub);
  }

  // Forecast
  @Get('forecast')
  async getForecast(@Req() req: any) {
    return this.forecastingService.getForecast(req.user.sub);
  }

  // Win Rate Analysis
  @Get('win-rate')
  async getWinRateAnalysis(@Req() req: any) {
    return this.forecastingService.getWinRateAnalysis(req.user.sub);
  }

  // Team Performance
  @Get('team-performance')
  async getTeamPerformance(@Req() req: any) {
    return this.forecastingService.getTeamPerformance(req.user.sub);
  }
}
