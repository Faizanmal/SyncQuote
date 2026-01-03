import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { CreateOAuthAppDto, OAuthAuthorizeDto, OAuthTokenDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * Create OAuth app (requires auth)
   */
  @Post('apps')
  @UseGuards(JwtAuthGuard)
  async createOAuthApp(@Request() req: any, @Body() dto: CreateOAuthAppDto) {
    return this.oauthService.createOAuthApp(req.user.id, dto);
  }

  /**
   * List developer's OAuth apps
   */
  @Get('apps')
  @UseGuards(JwtAuthGuard)
  async listOAuthApps(@Request() req: any) {
    return this.oauthService.listOAuthApps(req.user.id);
  }

  /**
   * Get OAuth app details
   */
  @Get('apps/:id')
  @UseGuards(JwtAuthGuard)
  async getOAuthApp(@Request() req: any, @Param('id') id: string) {
    return this.oauthService.getOAuthApp(req.user.id, id);
  }

  /**
   * Delete OAuth app
   */
  @Delete('apps/:id')
  @UseGuards(JwtAuthGuard)
  async deleteOAuthApp(@Request() req: any, @Param('id') id: string) {
    return this.oauthService.deleteOAuthApp(req.user.id, id);
  }

  /**
   * Regenerate client secret
   */
  @Post('apps/:id/regenerate-secret')
  @UseGuards(JwtAuthGuard)
  async regenerateClientSecret(@Request() req: any, @Param('id') id: string) {
    return this.oauthService.regenerateClientSecret(req.user.id, id);
  }

  /**
   * OAuth2 authorize endpoint (requires user auth)
   */
  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  async authorize(@Request() req: any, @Body() dto: OAuthAuthorizeDto) {
    return this.oauthService.authorize(dto, req.user.id);
  }

  /**
   * OAuth2 token endpoint (public)
   */
  @Post('token')
  async token(@Body() dto: OAuthTokenDto) {
    return this.oauthService.exchangeToken(dto);
  }

  /**
   * OAuth2 revoke endpoint (public)
   */
  @Post('revoke')
  async revoke(
    @Body('token') token: string,
    @Body('token_type_hint') tokenTypeHint?: 'access_token' | 'refresh_token',
  ) {
    return this.oauthService.revokeToken(token, tokenTypeHint);
  }

  /**
   * Get apps user has authorized
   */
  @Get('authorized-apps')
  @UseGuards(JwtAuthGuard)
  async getAuthorizedApps(@Request() req: any) {
    return this.oauthService.getAuthorizedApps(req.user.id);
  }

  /**
   * Revoke authorization for an app
   */
  @Delete('authorized-apps/:appId')
  @UseGuards(JwtAuthGuard)
  async revokeAppAuthorization(@Request() req: any, @Param('appId') appId: string) {
    return this.oauthService.revokeAppAuthorization(req.user.id, appId);
  }
}
