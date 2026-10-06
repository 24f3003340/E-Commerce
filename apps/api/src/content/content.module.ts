import { Module } from '@nestjs/common';
import { AdminContentController, ContentController } from './content.controller';

@Module({ controllers: [ContentController, AdminContentController] })
export class ContentModule {}
