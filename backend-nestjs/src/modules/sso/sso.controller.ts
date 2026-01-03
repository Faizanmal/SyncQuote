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
  Headers,
} from '@nestjs/common';
import { SsoService } from './sso.service';
import { SamlService } from './saml.service';
import { DirectorySyncService } from './directory-sync.service';
import { SecurityService } from './security.service';
import {
  CreateSsoConfigDto,
  UpdateSsoConfigDto,
  SamlLoginDto,
  CreateDirectorySyncDto,
  UpdateDirectorySyncDto,
  UpdateSecurityPolicyDto,
  TerminateSessionDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sso')
@UseGuards(JwtAuthGuard)
export class SsoController {
  constructor(
    private readonly ssoService: SsoService,
    private readonly samlService: SamlService,
    private readonly directorySyncService: DirectorySyncService,
    private readonly securityService: SecurityService,
  ) {}

  // ==================== SSO CONFIG ====================

  /**
   * Create SSO configuration
   */
  @Post('configs')
  async createSsoConfig(@Request() req: any, @Body() dto: CreateSsoConfigDto) {
    const userId = req.user.id;
    const teamId = req.user.teamId; // Assumes user has teamId
    return this.ssoService.createSsoConfig(userId, teamId, dto);
  }

  /**
   * List SSO configurations
   */
  @Get('configs')
  async listSsoConfigs(@Request() req: any) {
    const teamId = req.user.teamId;
    return this.ssoService.listSsoConfigs(teamId);
  }

  /**
   * Get SSO configuration
   */
  @Get('configs/:id')
  async getSsoConfig(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.ssoService.getSsoConfig(teamId, id);
  }

  /**
   * Update SSO configuration
   */
  @Put('configs/:id')
  async updateSsoConfig(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSsoConfigDto,
  ) {
    const teamId = req.user.teamId;
    return this.ssoService.updateSsoConfig(teamId, id, dto);
  }

  /**
   * Delete SSO configuration
   */
  @Delete('configs/:id')
  async deleteSsoConfig(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.ssoService.deleteSsoConfig(teamId, id);
  }

  /**
   * Get SSO statistics
   */
  @Get('configs/:id/stats')
  async getSsoStats(@Request() req: any, @Param('id') id: string, @Query('days') days?: number) {
    const teamId = req.user.teamId;
    return this.ssoService.getSsoStats(teamId, id, days || 30);
  }

  /**
   * Test SSO configuration
   */
  @Post('configs/:id/test')
  async testSsoConfig(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.ssoService.testSsoConfig(teamId, id);
  }

  // ==================== SAML ====================

  /**
   * Get SAML metadata
   */
  @Get('saml/:configId/metadata')
  async getSamlMetadata(@Param('configId') configId: string) {
    const metadata = await this.samlService.getMetadata(configId);
    return { metadata };
  }

  /**
   * Initiate SAML login
   */
  @Post('saml/login')
  async initiateSamlLogin(@Body() dto: SamlLoginDto) {
    const loginUrl = await this.samlService.createLoginUrl(dto.configId, dto.relayState);
    return { loginUrl };
  }

  // ==================== DIRECTORY SYNC ====================

  /**
   * Create directory sync configuration
   */
  @Post('directory-sync')
  async createDirectorySync(@Request() req: any, @Body() dto: CreateDirectorySyncDto) {
    const teamId = req.user.teamId;
    return this.directorySyncService.createDirectorySync(teamId, dto);
  }

  /**
   * List directory sync configurations
   */
  @Get('directory-sync')
  async listDirectorySyncs(@Request() req: any) {
    const teamId = req.user.teamId;
    return this.directorySyncService.listDirectorySyncs(teamId);
  }

  /**
   * Get directory sync configuration
   */
  @Get('directory-sync/:id')
  async getDirectorySync(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.directorySyncService.getDirectorySync(teamId, id);
  }

  /**
   * Update directory sync configuration
   */
  @Put('directory-sync/:id')
  async updateDirectorySync(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDirectorySyncDto,
  ) {
    const teamId = req.user.teamId;
    return this.directorySyncService.updateDirectorySync(teamId, id, dto);
  }

  /**
   * Delete directory sync configuration
   */
  @Delete('directory-sync/:id')
  async deleteDirectorySync(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.directorySyncService.deleteDirectorySync(teamId, id);
  }

  /**
   * Regenerate SCIM bearer token
   */
  @Post('directory-sync/:id/regenerate-token')
  async regenerateBearerToken(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.directorySyncService.regenerateBearerToken(teamId, id);
  }

  /**
   * Get directory sync logs
   */
  @Get('directory-sync/:id/logs')
  async getSyncLogs(@Request() req: any, @Param('id') id: string, @Query('limit') limit?: number) {
    const teamId = req.user.teamId;
    return this.directorySyncService.getSyncLogs(teamId, id, limit || 50);
  }

  /**
   * Trigger manual sync
   */
  @Post('directory-sync/:id/sync')
  async triggerManualSync(@Request() req: any, @Param('id') id: string) {
    const teamId = req.user.teamId;
    return this.directorySyncService.triggerManualSync(teamId, id);
  }

  // ==================== SECURITY POLICY ====================

  /**
   * Get security policy
   */
  @Get('security/policy')
  async getSecurityPolicy(@Request() req: any) {
    const teamId = req.user.teamId;
    return this.securityService.getSecurityPolicy(teamId);
  }

  /**
   * Update security policy
   */
  @Put('security/policy')
  async updateSecurityPolicy(@Request() req: any, @Body() dto: UpdateSecurityPolicyDto) {
    const teamId = req.user.teamId;
    return this.securityService.updateSecurityPolicy(teamId, dto);
  }

  /**
   * Get active sessions
   */
  @Get('security/sessions')
  async getActiveSessions(@Request() req: any) {
    return this.securityService.getActiveSessions(req.user.id);
  }

  /**
   * Terminate session
   */
  @Delete('security/sessions/:sessionId')
  async terminateSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.securityService.terminateSession(req.user.id, sessionId);
  }

  /**
   * Terminate all sessions
   */
  @Post('security/sessions/terminate-all')
  async terminateAllSessions(@Request() req: any, @Body() body: { exceptCurrent?: boolean }) {
    const exceptSessionId = body.exceptCurrent ? req.user.sessionId : undefined;
    return this.securityService.terminateAllSessions(req.user.id, exceptSessionId);
  }

  /**
   * Get security audit log
   */
  @Get('security/audit-log')
  async getAuditLog(
    @Request() req: any,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
  ) {
    const teamId = req.user.teamId;
    return this.securityService.getAuditLog(teamId, limit || 100, {
      userId,
      eventType,
      startDate,
    });
  }

  /**
   * Validate password
   */
  @Post('security/validate-password')
  async validatePassword(@Request() req: any, @Body() body: { password: string }) {
    const teamId = req.user.teamId;
    return this.securityService.validatePassword(teamId, body.password);
  }
}
