import {
  Body,
  Controller,
  Delete,
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
