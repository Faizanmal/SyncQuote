import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

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
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.refreshToken;
        },
      ]),
      secretOrKey: requireJwtSecret(config, 'JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; email: string }) {
    const refreshToken = req.cookies?.refreshToken;
    return {
      sub: payload.sub,
      email: payload.email,
      refreshToken,
    };
  }
}
