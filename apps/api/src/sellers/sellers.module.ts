import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersModule } from '../orders/orders.module';
import {
  AdminSellersController,
  SellerAccountController,
  SellerAuthController,
  SellerCatalogController,
  SellerOrdersController,
} from './sellers.controller';
import { SellersService } from './sellers.service';

/** Marketplace: outside sellers, their seller panel API and the admin tools to manage them. */
@Module({
  imports: [AuthModule, CatalogModule, OrdersModule],
  controllers: [SellerAuthController, SellerAccountController, SellerCatalogController, SellerOrdersController, AdminSellersController],
  providers: [SellersService],
})
export class SellersModule {}
