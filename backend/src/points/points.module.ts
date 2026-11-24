import { Module } from '@nestjs/common';
import { GeocodeService } from './geocode.service';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  controllers: [PointsController],
  providers: [PointsService, GeocodeService],
  exports: [PointsService, GeocodeService],
})
export class PointsModule {}
