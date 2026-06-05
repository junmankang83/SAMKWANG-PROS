import { Module } from '@nestjs/common';
import { ErpPuDelvInItemsController } from './erp-pu-delv-in-items.controller';
import { ErpPuDelvInItemsService } from './erp-pu-delv-in-items.service';
import { ErpPuDelvItemsController } from './erp-pu-delv-items.controller';
import { ErpPuDelvItemsService } from './erp-pu-delv-items.service';
import { ErpTslExportInvoiceItemsController } from './erp-tsl-export-invoice-items.controller';
import { ErpTslExportInvoiceItemsService } from './erp-tsl-export-invoice-items.service';
import { ErpTslDvReqItemsController } from './erp-tsl-dv-req-items.controller';
import { ErpTslDvReqItemsService } from './erp-tsl-dv-req-items.service';
import { ErpTslInvoiceItemsController } from './erp-tsl-invoice-items.controller';
import { ErpTslInvoiceItemsService } from './erp-tsl-invoice-items.service';
import { ErpToolsService } from './erp-tools.service';
import { ErpUsersService } from './erp-users.service';

@Module({
  controllers: [
    ErpTslInvoiceItemsController,
    ErpTslExportInvoiceItemsController,
    ErpTslDvReqItemsController,
    ErpPuDelvInItemsController,
    ErpPuDelvItemsController,
  ],
  providers: [
    ErpToolsService,
    ErpUsersService,
    ErpTslInvoiceItemsService,
    ErpTslExportInvoiceItemsService,
    ErpTslDvReqItemsService,
    ErpPuDelvInItemsService,
    ErpPuDelvItemsService,
  ],
  exports: [
    ErpToolsService,
    ErpUsersService,
    ErpTslInvoiceItemsService,
    ErpTslExportInvoiceItemsService,
    ErpTslDvReqItemsService,
    ErpPuDelvInItemsService,
    ErpPuDelvItemsService,
  ],
})
export class ErpModule {}
