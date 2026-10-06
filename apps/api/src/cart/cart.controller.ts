import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, HttpCode } from '@nestjs/common';
import { UserPrincipal } from '../common/auth.types';
import { CurrentUser } from '../common/decorators';
import { UserAuthGuard } from '../common/guards';
import { AddCartItemDto, MergeCartDto, QuoteDto, UpdateCartItemDto } from './cart.dto';
import { CartService } from './cart.service';

@UseGuards(UserAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  view(@CurrentUser() user: UserPrincipal) {
    return this.cart.view(user.id);
  }

  @HttpCode(200)
  @Post('quote')
  quote(@CurrentUser() user: UserPrincipal, @Body() dto: QuoteDto) {
    return this.cart.quote(user.id, dto);
  }

  @Post('items')
  add(@CurrentUser() user: UserPrincipal, @Body() dto: AddCartItemDto) {
    return this.cart.add(user.id, dto.variantId, dto.quantity);
  }

  @Patch('items/:id')
  update(@CurrentUser() user: UserPrincipal, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.update(user.id, id, dto.quantity);
  }

  @Delete('items/:id')
  remove(@CurrentUser() user: UserPrincipal, @Param('id') id: string) {
    return this.cart.remove(user.id, id);
  }

  @HttpCode(200)
  @Post('merge')
  merge(@CurrentUser() user: UserPrincipal, @Body() dto: MergeCartDto) {
    return this.cart.merge(user.id, dto.items);
  }
}
