import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminReturnsController, ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [OrdersModule, CatalogModule],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
