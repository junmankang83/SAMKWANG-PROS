import { Controller, Get, Query } from '@nestjs/common';
import { TslSalesDailyAnalysisQueryDto } from './dto/tsl-sales-daily-analysis.query.dto';
import { ErpTslSalesDailyAnalysisService } from './erp-tsl-sales-daily-analysis.service';

/** 일자별판매실적분석 — `_TSLSalesItem`·`_TSLInvoiceItem`·`_TSLBillItem` */
@Controller('erp/tsl-sales-daily-analysis')
export class ErpTslSalesDailyAnalysisController {
  constructor(private readonly analysis: ErpTslSalesDailyAnalysisService) {}

  @Get()
  list(@Query() query: TslSalesDailyAnalysisQueryDto) {
    return this.analysis.listByDateRange(query.from, query.to, query.limit);
  }
}
