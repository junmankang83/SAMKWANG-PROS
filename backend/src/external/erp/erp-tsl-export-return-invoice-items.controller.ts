import { Controller, Get, Query } from '@nestjs/common';
import { TslExportReturnInvoiceItemsQueryDto } from './dto/tsl-export-return-invoice-items.query.dto';
import { ErpTslExportInvoiceItemsService } from './erp-tsl-export-invoice-items.service';

@Controller('erp/tsl-export-return-invoice-items')
export class ErpTslExportReturnInvoiceItemsController {
  constructor(private readonly exportInvoiceItems: ErpTslExportInvoiceItemsService) {}

  @Get()
  list(@Query() query: TslExportReturnInvoiceItemsQueryDto) {
    return this.exportInvoiceItems.listExportReturnByInvoiceDateRange(query.from, query.to, query.limit);
  }
}
