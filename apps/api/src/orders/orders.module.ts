import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsController } from '../payments/payments.controller';
import { RazorpayGateway } from '../payments/razorpay.gateway';
import { ShippingController } from '../shipping/shipping.controller';
import { ShippingService } from '../shipping/shipping.service';
import { ShiprocketClient } from '../shipping/shiprocket.client';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, CouponsModule, CatalogModule],
  controllers: [OrdersController, AdminOrdersController, PaymentsController, ShippingController],
  providers: [OrdersService, RazorpayGateway, ShippingService, ShiprocketClient],
  exports: [OrdersService, RazorpayGateway, ShippingService],
})
export class OrdersModule {}
