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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AbTestingService } from './ab-testing.service';
import {
  CreateAbTestDto,
  UpdateAbTestDto,
  RecordConversionDto,
  TestStatus,
  UpdateVariantTrafficDto,
} from './dto/ab-testing.dto';

@ApiTags('A/B Testing')
@Controller('ab-tests')
export class AbTestingController {
  constructor(private readonly abTestingService: AbTestingService) {}

  // Protected routes
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new A/B test' })
  async createTest(@Request() req: any, @Body() dto: CreateAbTestDto) {
    return this.abTestingService.createTest(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all A/B tests' })
  async getTests(@Request() req: any, @Query('status') status?: TestStatus) {
    return this.abTestingService.getTests(req.user.id, status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get A/B test by ID' })
  async getTest(@Request() req: any, @Param('id') id: string) {
    return this.abTestingService.getTest(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/results')
  @ApiOperation({ summary: 'Get A/B test results with statistical analysis' })
  async getTestResults(@Request() req: any, @Param('id') id: string) {
    return this.abTestingService.getTestResults(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update A/B test' })
  async updateTest(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAbTestDto) {
    return this.abTestingService.updateTest(req.user.id, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  @ApiOperation({ summary: 'Start A/B test' })
  async startTest(@Request() req: any, @Param('id') id: string) {
    return this.abTestingService.startTest(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause A/B test' })
  async pauseTest(@Request() req: any, @Param('id') id: string) {
    return this.abTestingService.pauseTest(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete A/B test and optionally select winner' })
  async completeTest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { winnerId?: string },
  ) {
    return this.abTestingService.completeTest(req.user.id, id, body.winnerId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete A/B test' })
  async deleteTest(@Request() req: any, @Param('id') id: string) {
    return this.abTestingService.deleteTest(req.user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/traffic')
  @ApiOperation({ summary: 'Update variant traffic allocation' })
  async updateTrafficAllocation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateVariantTrafficDto,
  ) {
    return this.abTestingService.updateTrafficAllocation(req.user.id, id, dto);
  }

  // Public routes for tracking
  @Post('assign')
  @ApiOperation({ summary: 'Assign visitor to test variant' })
  async assignVariant(@Body() body: { testId: string; sessionId: string }) {
    return this.abTestingService.assignVariant(body.testId, body.sessionId);
  }

  @Post('conversion')
  @ApiOperation({ summary: 'Record a conversion event' })
  async recordConversion(@Body() dto: RecordConversionDto) {
    return this.abTestingService.recordConversion(dto);
  }
}
