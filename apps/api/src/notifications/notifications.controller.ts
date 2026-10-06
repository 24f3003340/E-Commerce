import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { UserPrincipal } from '../common/auth.types';
import { CurrentUser } from '../common/decorators';
import { UserAuthGuard } from '../common/guards';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(UserAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: UserPrincipal) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, unread };
  }

  @HttpCode(200)
  @Post('read-all')
  async readAll(@CurrentUser() user: UserPrincipal) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @HttpCode(200)
  @Post(':id/read')
  async read(@CurrentUser() user: UserPrincipal, @Param('id') id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
