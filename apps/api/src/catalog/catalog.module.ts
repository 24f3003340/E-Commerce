import { Module } from '@nestjs/common';
import { AdminCatalogController, CatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { InventoryService } from './inventory.service';
import { ProductsService } from './products.service';

@Module({
  controllers: [CatalogController, AdminCatalogController],
  providers: [CategoriesService, ProductsService, InventoryService],
  exports: [CategoriesService, ProductsService, InventoryService],
})
export class CatalogModule {}
