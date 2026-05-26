import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateMoldCodeGroupDto, UpdateMoldCodeGroupDto } from './dto/mold-code.dto';
import { MoldCodesService } from './mold-codes.service';

@Controller('mold/code-groups')
export class MoldCodeGroupsController {
  constructor(private readonly moldCodes: MoldCodesService) {}

  /** 점검항목 필터: `parentCode`에 해당하는 상위 그룹의 하위 코드만 반환 (예: 설비구분, 설비유형) */
  @Get('filter-items')
  listFilterItems(@Query('parentCode') raw?: string | string[]) {
    const first = Array.isArray(raw) ? raw[0] : raw;
    const parentCode = typeof first === 'string' ? first : '';
    return this.moldCodes.listItemsByParentGroupCode(parentCode);
  }

  @Get()
  list() {
    return this.moldCodes.listGroups();
  }

  @Post()
  create(@Body() dto: CreateMoldCodeGroupDto) {
    return this.moldCodes.createGroup(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMoldCodeGroupDto) {
    return this.moldCodes.updateGroup(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.moldCodes.removeGroup(id);
  }
}
