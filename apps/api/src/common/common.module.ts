import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { EmailService } from './email.service';
import { AdminAuthGuard, OptionalUserGuard, SellerAuthGuard, UserAuthGuard } from './guards';
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
    SellerAuthGuard,
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
    SellerAuthGuard,
  ],
})
export class CommonModule {}
