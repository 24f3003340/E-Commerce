import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { config } from './common/config';
import { originMatcher } from './common/cors';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { UPLOAD_DIR } from './uploads/uploads.controller';

async function bootstrap() {
  // rawBody is needed to verify Razorpay webhook signatures
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: originMatcher(config.corsOrigins), credentials: true });
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads/', maxAge: '30d', index: false });
  // Demo catalog artwork is committed to the repo so it survives redeploys on ephemeral disks
  app.useStaticAssets(join(__dirname, '..', 'assets'), { prefix: '/assets/', maxAge: '30d', index: false });
  app.enableShutdownHooks();
  await app.listen(config.port);
  Logger.log(`API listening on http://localhost:${config.port}`, 'Bootstrap');
}

void bootstrap();
