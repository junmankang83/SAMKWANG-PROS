import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { WhStockSumQueryDto } from './dto/wh-stock-sum.query.dto';
import { ErpWhStockSumService } from './erp-wh-stock-sum.service';

/** 창고별수불집계 — 조회기간(`dateFr`·`dateTo` 또는 `from`·`to`, ISO 날짜). NQL 경로: `Sp_StockSumListQuery_NQL @BegDate,@EndDate`(8자). */
@Controller('erp/wh-stock-sum')
export class ErpWhStockSumController {
  constructor(private readonly svc: ErpWhStockSumService) {}

  @Get()
  list(@Query() query: WhStockSumQueryDto) {
    const fromIso = query.dateFr ?? query.from;
    const toIso = query.dateTo ?? query.to;
    if (!fromIso || !toIso) {
      throw new BadRequestException('조회시작일·조회종료일은 dateFr/dateTo 또는 from/to(YYYY-MM-DD)로 지정하세요.');
    }
    return this.svc.listByDateRange(fromIso, toIso, query.limit, query.bizUnit);
  }
}
