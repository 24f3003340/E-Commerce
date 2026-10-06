import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminCouponsController, CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [CatalogModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
