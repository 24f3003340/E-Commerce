import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DemoDataService } from './demo-data.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [AdminController],
  providers: [AdminService, DemoDataService],
})
export class AdminModule {}
