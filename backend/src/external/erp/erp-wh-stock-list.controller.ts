import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { WhStockListQueryDto } from './dto/wh-stock-list.query.dto';
import { ErpWhStockListService } from './erp-wh-stock-list.service';

/** 창고별 재고조회 — 조회일 기준(`asOf` 또는 `date`) */
@Controller('erp/wh-stock-list')
export class ErpWhStockListController {
  constructor(private readonly svc: ErpWhStockListService) {}

  @Get()
  list(@Query() query: WhStockListQueryDto) {
    const asOf = query.asOf ?? query.date;
    if (!asOf) {
      throw new BadRequestException('조회일은 asOf 또는 date(YYYY-MM-DD)로 지정하세요.');
    }
    return this.svc.listAsOf(asOf, query.limit, query.bizUnit);
  }
}
