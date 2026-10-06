import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminPrincipal, UserPrincipal } from '../common/auth.types';
import { CurrentAdmin, CurrentUser } from '../common/decorators';
import { AdminAuthGuard, UserAuthGuard } from '../common/guards';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto, ChangePasswordDto, ForgotPasswordDto, LoginDto, OtpDto, RefreshDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { AuthService, publicUser } from './auth.service';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshUser(dto.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(UserAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: UserPrincipal) {
    return publicUser(await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  }

  @UseGuards(UserAuthGuard)
  @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentUser() user: UserPrincipal, @Body() dto: ChangePasswordDto) {
    return this.auth.changeUserPassword(user.id, dto);
  }
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshAdmin(dto.refreshToken);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(AdminAuthGuard)
  @Get('me')
  me(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.adminMe(admin.id);
  }

  @UseGuards(AdminAuthGuard)
  @Post('2fa/setup')
  setup2fa(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.setupTwoFactor(admin.id);
  }

  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @Post('2fa/enable')
  enable2fa(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: OtpDto) {
    return this.auth.enableTwoFactor(admin.id, dto.otp);
  }

  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @Post('2fa/disable')
  disable2fa(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: OtpDto) {
    return this.auth.disableTwoFactor(admin.id, dto.otp);
  }
}
