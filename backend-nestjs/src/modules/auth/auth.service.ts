import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { TeamsService } from '../teams/teams.service';
import { SignUpDto, SignInDto, ResetPasswordDto, ChangePasswordDto } from './dto';

type SessionContext = { ip?: string; userAgent?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
    private teamsService: TeamsService,
  ) {}

  /**
   * Sign up with email/password
   */
  async signUp(dto: SignUpDto, session?: SessionContext) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user with trial
    const trialDays = 14;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
      },
    });

    await this.sendVerificationEmail(user.id, user.email);

    if (dto.inviteToken) {
      try {
        await this.teamsService.acceptInvitationByToken(dto.inviteToken, user.id);
      } catch (error) {
        this.logger.warn(`Invite token on signup was not applied: ${(error as Error).message}`);
      }
    }

    await this.teamsService.acceptPendingInvitationsForEmail(user.email, user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Save refresh token
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    await this.recordLoginSession(user.id, session);

    return {
      user: this.usersService.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Sign in with email/password
   */
  async signIn(dto: SignInDto, session?: SessionContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Save refresh token
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    await this.teamsService.acceptPendingInvitationsForEmail(user.email, user.id);
    await this.recordLoginSession(user.id, session);

    return {
      user: this.usersService.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Google OAuth sign in/up
   */
  async googleAuth(profile: any, session?: SessionContext) {
    const email = profile.email ?? profile.emails?.[0]?.value;
    const googleId = profile.id;

    if (!email) {
      throw new UnauthorizedException('Google account did not provide an email');
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create new user
      const trialDays = 14;
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          name: profile.displayName,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
        },
      });
    } else if (!user.googleId) {
      // Link Google to existing account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    await this.teamsService.acceptPendingInvitationsForEmail(user.email, user.id);
    await this.recordLoginSession(user.id, session);

    return {
      user: this.usersService.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    // Verify refresh token
    const tokenMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatch) {
      throw new UnauthorizedException('Access denied');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    try {
      await this.prisma.userSession.deleteMany({ where: { userId } });
    } catch (error) {
      this.logger.warn(`Could not clear sessions on logout: ${(error as Error).message}`);
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${(error as Error).message}`,
      );
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password (when logged in)
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Verify email with the token from the signup email
   */
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  /**
   * Resend verification email. Same response whether or not the account exists.
   */
  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && !user.emailVerified) {
      await this.sendVerificationEmail(user.id, user.email);
    }

    return { message: 'If the email exists and is unverified, a link has been sent' };
  }

  /**
   * Store a verification token and send the email. Signup still succeeds if mail fails.
   */
  private async sendVerificationEmail(userId: string, email: string) {
    const verificationToken = nanoid(32);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires,
      },
    });

    try {
      await this.emailService.sendVerificationEmail(email, verificationToken);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${(error as Error).message}`,
      );
    }
  }

  private async recordLoginSession(userId: string, session?: SessionContext) {
    try {
      const policy = await this.prisma.securityPolicy.findUnique({ where: { userId } });
      const minutes =
        !policy?.sessionTimeout || policy.sessionTimeout === 3600 ? 60 : policy.sessionTimeout;
      await this.prisma.userSession.create({
        data: {
          userId,
          token: nanoid(48),
          ipAddress: session?.ip || null,
          userAgent: session?.userAgent || '',
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + minutes * 60 * 1000),
        },
      });
    } catch (error) {
      this.logger.warn(`Could not record login session: ${(error as Error).message}`);
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.parseExpiration(
            this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
          ),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.parseExpiration(
            this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
          ),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Parse expiration string to number of seconds
   */
  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // default to 15 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }

  /**
   * Update refresh token in database (hashed)
   */
  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }
}
