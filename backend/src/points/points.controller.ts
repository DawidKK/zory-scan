import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreatePointDto, UpdatePointDto } from './points.dto';
import { PointsService } from './points.service';

@Controller('points')
@Roles('admin')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  list() {
    return this.points.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.points.get(id);
  }

  @Post()
  create(@Body() dto: CreatePointDto) {
    return this.points.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePointDto) {
    return this.points.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.points.remove(id);
  }
}
