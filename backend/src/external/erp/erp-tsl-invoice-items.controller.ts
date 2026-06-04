import { Controller, Get, Query } from '@nestjs/common';
import { TslInvoiceItemsQueryDto } from './dto/tsl-invoice-items.query.dto';
import { ErpTslInvoiceItemsService } from './erp-tsl-invoice-items.service';

@Controller('erp/tsl-invoice-items')
export class ErpTslInvoiceItemsController {
  constructor(private readonly tslInvoiceItems: ErpTslInvoiceItemsService) {}

  @Get()
  list(@Query() query: TslInvoiceItemsQueryDto) {
    return this.tslInvoiceItems.listByInvoiceDateRange(query.from, query.to, query.limit);
  }
}
