import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Authentication (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Apply same pipes as in production
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        prisma = app.get<PrismaService>(PrismaService);

        await app.init();
    });

    afterAll(async () => {
        await prisma.$disconnect();
        await app.close();
    });

    describe('/api/v1/auth/register (POST)', () => {
        it('should register a new user', () => {
            return request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                    name: 'Test User',
                })
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('accessToken');
                    expect(res.body).toHaveProperty('user');
                    expect(res.body.user.email).toBe('test@example.com');
                });
        });

        it('should fail with invalid email', () => {
            return request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'SecurePass123!',
                })
                .expect(400);
        });

        it('should fail with weak password', () => {
            return request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    email: 'test2@example.com',
                    password: '123',
                })
                .expect(400);
        });
    });

    describe('/api/v1/auth/login (POST)', () => {
        beforeAll(async () => {
            // Create a test user
            await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    email: 'login@example.com',
                    password: 'SecurePass123!',
                });
        });

        it('should login with valid credentials', () => {
            return request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'SecurePass123!',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('accessToken');
                    expect(res.body).toHaveProperty('refreshToken');
                });
        });

        it('should fail with invalid password', () => {
            return request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'WrongPassword',
                })
                .expect(401);
        });

        it('should fail with non-existent user', () => {
            return request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'SecurePass123!',
                })
                .expect(401);
        });
    });
});
