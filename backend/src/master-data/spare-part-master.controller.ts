import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateSparePartMasterDto,
  SparePartMasterListQueryDto,
  UpdateSparePartMasterDto,
} from './dto/spare-part-master.dto';
import { SparePartMasterService } from './spare-part-master.service';

@Controller('master-data/spare-parts')
export class SparePartMasterController {
  constructor(private readonly masters: SparePartMasterService) {}

  @Get()
  list(@Query() query: SparePartMasterListQueryDto) {
    const activeOnly = query.activeOnly !== false;
    return this.masters.list(query.q, activeOnly);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.masters.getById(id);
  }

  @Post()
  create(@Body() dto: CreateSparePartMasterDto, @Req() req: Request) {
    return this.masters.create(dto, req.sessionUser?.username);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSparePartMasterDto,
    @Req() req: Request,
  ) {
    return this.masters.update(id, dto, req.sessionUser?.username);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.masters.remove(id);
  }
}
