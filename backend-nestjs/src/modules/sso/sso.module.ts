import { Module } from '@nestjs/common';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { SamlService } from './saml.service';
import { DirectorySyncService } from './directory-sync.service';
import { SecurityService } from './security.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SsoController],
  providers: [SsoService, SamlService, DirectorySyncService, SecurityService],
  exports: [SsoService, SamlService, DirectorySyncService, SecurityService],
})
export class SsoModule {}
