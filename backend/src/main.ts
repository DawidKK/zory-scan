import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  await runMigrations();

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: config.corsOrigins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on :${config.port}`);
}

void bootstrap();
