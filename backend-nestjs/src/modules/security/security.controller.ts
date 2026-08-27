import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  private userId(req: any) {
    return req.user?.id || req.user?.sub || req.user?.userId;
  }

  @Get('settings')
  getSettings(@Request() req: any) {
    return this.securityService.getSettings(this.userId(req));
  }

  @Patch('settings')
  updateSettings(@Request() req: any, @Body() body: any) {
    return this.securityService.updateSettings(this.userId(req), body);
  }

  @Get('audit-logs')
  getAuditLogs(@Request() req: any) {
    return this.securityService.getAuditLogs(this.userId(req));
  }

  @Get('sessions')
  getSessions(@Request() req: any) {
    return this.securityService.getSessions(this.userId(req));
  }

  @Delete('sessions/:id')
  revokeSession(@Request() req: any, @Param('id') id: string) {
    return this.securityService.revokeSession(this.userId(req), id);
  }

  @Get('threats')
  getThreats(@Request() req: any) {
    return this.securityService.getThreats(this.userId(req));
  }

  @Get('api-keys')
  listApiKeys(@Request() req: any) {
    return this.securityService.listApiKeys(this.userId(req));
  }

  @Post('api-keys')
  createApiKey(@Request() req: any, @Body() body: any) {
    return this.securityService.createApiKey(this.userId(req), body);
  }

  @Delete('api-keys/:id')
  deleteApiKey(@Request() req: any, @Param('id') id: string) {
    return this.securityService.deleteApiKey(this.userId(req), id);
  }

  @Get('2fa/qr')
  getQr(@Request() req: any) {
    return this.securityService.getQr(this.userId(req));
  }

  @Post('2fa/enable')
  enable2fa(@Request() req: any, @Body() body: { password: string; code: string }) {
    return this.securityService.enable2fa(this.userId(req), body.password, body.code);
  }

  @Post('2fa/disable')
  disable2fa(@Request() req: any) {
    return this.securityService.disable2fa(this.userId(req));
  }
}
