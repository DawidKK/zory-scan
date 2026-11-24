import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { CabinetsController } from './cabinets.controller';
import { CabinetsService } from './cabinets.service';

@Module({
  imports: [PointsModule],
  controllers: [CabinetsController],
  providers: [CabinetsService],
})
export class NetworkModule {}
