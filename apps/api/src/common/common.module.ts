import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { EmailService } from './email.service';
import { AdminAuthGuard, OptionalUserGuard, UserAuthGuard } from './guards';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    CacheService,
    AuditService,
    SettingsService,
    EmailService,
    UserAuthGuard,
    OptionalUserGuard,
    AdminAuthGuard,
  ],
  exports: [
    JwtModule,
    CacheService,
    AuditService,
    SettingsService,
    EmailService,
    UserAuthGuard,
    OptionalUserGuard,
    AdminAuthGuard,
  ],
})
export class CommonModule {}
