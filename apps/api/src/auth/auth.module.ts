import { Module } from '@nestjs/common';
import { AdminAuthController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

@Module({
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, TokensService],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
