import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health.controller';
import { PointsModule } from './points/points.module';
import { ScansModule } from './scans/scans.module';

@Module({
  imports: [DbModule, AuthModule, PointsModule, ScansModule],
  controllers: [HealthController],
})
export class AppModule {}
