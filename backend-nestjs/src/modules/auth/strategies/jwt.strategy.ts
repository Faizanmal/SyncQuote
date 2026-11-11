import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

function requireJwtSecret(config: ConfigService, key: string): string {
  const secret = config.get<string>(key)?.trim();
  if (!secret || secret === 'default-secret') {
    throw new Error(
      `${key} must be set to a strong secret (refusing insecure default)`,
    );
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: requireJwtSecret(config, 'JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return null;
    }

    // Return user data (will be attached to req.user)
    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
