import { Controller, Get, Query } from '@nestjs/common';
import { TslExportInvoiceItemsQueryDto } from './dto/tsl-export-invoice-items.query.dto';
import { ErpTslExportInvoiceItemsService } from './erp-tsl-export-invoice-items.service';

@Controller('erp/tsl-export-invoice-items')
export class ErpTslExportInvoiceItemsController {
  constructor(private readonly exportInvoiceItems: ErpTslExportInvoiceItemsService) {}

  @Get()
  list(@Query() query: TslExportInvoiceItemsQueryDto) {
    return this.exportInvoiceItems.listExportByInvoiceDateRange(query.from, query.to, query.limit);
  }
}
