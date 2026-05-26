import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateMoldInspectionItemDto,
  ListMoldInspectionItemsQueryDto,
  UpdateMoldInspectionItemDto,
} from './dto/mold-inspection-items.dto';
import { MoldInspectionItemsService } from './mold-inspection-items.service';

@Controller('mold/inspection-items')
export class MoldInspectionItemsController {
  constructor(private readonly inspectionItems: MoldInspectionItemsService) {}

  @Get()
  list(@Query() query: ListMoldInspectionItemsQueryDto) {
    return this.inspectionItems.list(query.categoryItemId ?? undefined, query.typeItemId ?? undefined);
  }

  @Post()
  create(@Body() dto: CreateMoldInspectionItemDto) {
    return this.inspectionItems.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMoldInspectionItemDto) {
    return this.inspectionItems.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inspectionItems.remove(id);
  }
}
