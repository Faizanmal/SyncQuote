import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  SignUpDto,
  SignInDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto';
import { GetUser } from './decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private sessionContext(req: any) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress;
    return { ip, userAgent: req.headers?.['user-agent'] };
  }

  @Post('signup')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Sign up with email and password' })
  async signUp(@Body() dto: SignUpDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signUp(dto, this.sessionContext(req));

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  async signIn(@Body() dto: SignInDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signIn(dto, this.sessionContext(req));

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async googleAuth() {
    // Initiates Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.googleAuth(req.user, this.sessionContext(req));

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect to frontend with access token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(
    @GetUser('sub') userId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    const result = await this.authService.refreshTokens(userId, refreshToken);

    // Set new refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(@GetUser('sub') userId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }

  @Post('password/request-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset email' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (authenticated)' })
  async changePassword(@GetUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify email with token from signup email' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  getMe(@GetUser() user: any) {
    return { user };
  }
}
