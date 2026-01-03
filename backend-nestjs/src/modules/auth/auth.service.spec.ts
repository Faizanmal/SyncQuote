import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
    let service: AuthService;
    let prisma: PrismaService;
    let jwtService: JwtService;

    const mockPrismaService = {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockJwtService = {
        sign: jest.fn(),
        verify: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn((key: string) => {
            const config: Record<string, string> = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
            };
            return config[key];
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        prisma = module.get<PrismaService>(PrismaService);
        jwtService = module.get<JwtService>(JwtService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should create a new user with hashed password', async () => {
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
            mockJwtService.sign.mockReturnValue('test-token');

            const result = await service.signUp(dto);

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('user');
            expect(mockPrismaService.user.create).toHaveBeenCalled();
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

    describe('login', () => {
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
            mockJwtService.sign.mockReturnValue('test-token');

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
});
