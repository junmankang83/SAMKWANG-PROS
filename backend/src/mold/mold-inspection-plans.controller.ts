import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ListMoldInspectionPlanQueryDto, UpsertMoldInspectionPlanDto } from './dto/mold-inspection-plans.dto';
import { MoldInspectionPlansService } from './mold-inspection-plans.service';

@Controller('mold/inspection-plans')
export class MoldInspectionPlansController {
  constructor(private readonly plans: MoldInspectionPlansService) {}

  @Get()
  get(@Query() query: ListMoldInspectionPlanQueryDto) {
    return this.plans.get(query.categoryItemId, query.year);
  }

  @Put()
  upsert(@Body() dto: UpsertMoldInspectionPlanDto) {
    return this.plans.upsert(
      dto.categoryItemId,
      dto.year,
      dto.planJson,
      dto.actualJson,
      dto.recordMetaJson,
    );
  }
}
