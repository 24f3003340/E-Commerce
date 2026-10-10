import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserPrincipal } from '../common/auth.types';
import { CurrentUser } from '../common/decorators';
import { UserAuthGuard } from '../common/guards';
import { OrderStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { publicUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto, UpdateProfileDto } from './users.dto';

@UseGuards(UserAuthGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch()
  async updateProfile(@CurrentUser() user: UserPrincipal, @Body() dto: UpdateProfileDto) {
    return publicUser(await this.prisma.user.update({ where: { id: user.id }, data: dto }));
  }

  /**
   * Deletes the customer's account (required in-app by the App Store and Play Store). Personal
   * data is erased and sign-in is disabled; orders stay for GST / accounting records with only the
   * delivery-address snapshot they were placed with.
   */
  @Delete()
  async deleteAccount(@CurrentUser() user: UserPrincipal) {
    const open = await this.prisma.order.count({
      where: { userId: user.id, status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } },
    });
    if (open > 0) {
      throw new ForbiddenException('You have orders on the way. Please delete your account after they are delivered or cancelled.');
    }
    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId: user.id } }),
      this.prisma.cart.deleteMany({ where: { userId: user.id } }),
      this.prisma.wishlistItem.deleteMany({ where: { userId: user.id } }),
      this.prisma.notification.deleteMany({ where: { userId: user.id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          name: 'Deleted user',
          email: `deleted-${user.id}@deleted.invalid`,
          phone: null,
          passwordHash: randomBytes(32).toString('hex'),
        },
      }),
    ]);
    return { deleted: true };
  }

  @Get('addresses')
  addresses(@CurrentUser() user: UserPrincipal) {
    return this.prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Post('addresses')
  async createAddress(@CurrentUser() user: UserPrincipal, @Body() dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId: user.id } });
    const isDefault = dto.isDefault || count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }
      return tx.address.create({ data: { ...dto, isDefault, userId: user.id } });
    });
  }

  @Put('addresses/:id')
  async updateAddress(@CurrentUser() user: UserPrincipal, @Param('id') id: string, @Body() dto: AddressDto) {
    await this.ownAddress(user.id, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  @Delete('addresses/:id')
  async deleteAddress(@CurrentUser() user: UserPrincipal, @Param('id') id: string) {
    const address = await this.ownAddress(user.id, id);
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  }

  private async ownAddress(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }
}
