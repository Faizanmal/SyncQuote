import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Parse expiration string to number of seconds
        const parseExpiration = (expiration: string): number => {
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
        };

        return {
          secret: config.get<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn: parseExpiration(config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m')),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, GoogleStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
