import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CreateCabinetDto, UpdateCabinetDto } from './cabinets.dto';
import { CabinetsService } from './cabinets.service';

@Controller('cabinets')
@Roles('admin')
export class CabinetsController {
  constructor(private readonly cabinets: CabinetsService) {}

  @Get()
  list() {
    return this.cabinets.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.cabinets.get(id);
  }

  @Post()
  create(@Body() dto: CreateCabinetDto) {
    return this.cabinets.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCabinetDto) {
    return this.cabinets.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.cabinets.remove(id);
  }
}
