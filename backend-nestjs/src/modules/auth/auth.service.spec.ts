import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { TeamsService } from '../teams/teams.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    securityPolicy: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('test-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockUsersService = {
    sanitizeUser: jest.fn((user: { password?: string }) => {
      const { password: _password, ...rest } = user;
      return rest;
    }),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockTeamsService = {
    acceptInvitationByToken: jest.fn().mockResolvedValue(undefined),
    acceptPendingInvitationsForEmail: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should create a new user with hashed password and send verification email', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const mockUser = {
        id: '1',
        email: dto.email,
        name: dto.name,
        password: 'hashed-password',
        role: 'USER',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.signUp(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        dto.email,
        expect.any(String),
      );
    });

    it('should throw error if user already exists', async () => {
      const dto = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        email: dto.email,
      });

      await expect(service.signUp(dto)).rejects.toThrow();
    });
  });

  describe('signIn', () => {
    it('should return tokens for valid credentials', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const hashedPassword = await bcrypt.hash(dto.password, 12);
      const mockUser = {
        id: '1',
        email: dto.email,
        password: hashedPassword,
        role: 'USER',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.signIn(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for invalid password', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword', 12);
      const mockUser = {
        id: '1',
        email: dto.email,
        password: hashedPassword,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.signIn(dto)).rejects.toThrow();
    });
  });

  describe('verifyEmail', () => {
    it('should mark the user as verified for a valid token', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        emailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: new Date(Date.now() + 60_000),
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('valid-token');

      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });
    });

    it('should throw for an invalid or expired token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('expired')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
