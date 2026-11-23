import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateScanDto, ListScansQuery } from './scans.dto';
import { ScansService } from './scans.service';

@Controller('scans')
export class ScansController {
  constructor(private readonly scans: ScansService) {}

  @Post()
  @Roles('scanner')
  create(@Body() dto: CreateScanDto, @Headers('user-agent') userAgent?: string) {
    return this.scans.scan(dto.pointId, { userAgent, lat: dto.lat, lng: dto.lng });
  }

  @Get()
  @Roles('admin')
  list(@Query() query: ListScansQuery) {
    return this.scans.list(query.limit);
  }
}
