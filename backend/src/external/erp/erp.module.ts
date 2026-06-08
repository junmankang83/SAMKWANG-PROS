import { Module } from '@nestjs/common';
import { ErpPuDelvInItemsController } from './erp-pu-delv-in-items.controller';
import { ErpPuDelvInItemsService } from './erp-pu-delv-in-items.service';
import { ErpOspDelvInItemsController } from './erp-osp-delv-in-items.controller';
import { ErpOspDelvInItemsService } from './erp-osp-delv-in-items.service';
import { ErpPuDelvItemsController } from './erp-pu-delv-items.controller';
import { ErpPuDelvItemsService } from './erp-pu-delv-items.service';
import { ErpOspDelvItemsController } from './erp-osp-delv-items.controller';
import { ErpOspDelvItemsService } from './erp-osp-delv-items.service';
import { ErpLgInoutMoveItemsController } from './erp-lg-inout-move-items.controller';
import { ErpLgInoutMoveItemsService } from './erp-lg-inout-move-items.service';
import { ErpTslExportInvoiceItemsController } from './erp-tsl-export-invoice-items.controller';
import { ErpTslExportInvoiceItemsService } from './erp-tsl-export-invoice-items.service';
import { ErpTslExportReturnInvoiceItemsController } from './erp-tsl-export-return-invoice-items.controller';
import { ErpTslDvReqItemsController } from './erp-tsl-dv-req-items.controller';
import { ErpTslDvReqItemsService } from './erp-tsl-dv-req-items.service';
import { ErpTslInvoiceItemsController } from './erp-tsl-invoice-items.controller';
import { ErpTslInvoiceItemsService } from './erp-tsl-invoice-items.service';
import { ErpTslSalesDailyAnalysisController } from './erp-tsl-sales-daily-analysis.controller';
import { ErpTslSalesDailyAnalysisService } from './erp-tsl-sales-daily-analysis.service';
import { ErpToolsService } from './erp-tools.service';
import { ErpUsersService } from './erp-users.service';

@Module({
  controllers: [
    ErpTslInvoiceItemsController,
    ErpTslExportInvoiceItemsController,
    ErpTslExportReturnInvoiceItemsController,
    ErpTslDvReqItemsController,
    ErpPuDelvInItemsController,
    ErpOspDelvInItemsController,
    ErpPuDelvItemsController,
    ErpOspDelvItemsController,
    ErpLgInoutMoveItemsController,
    ErpTslSalesDailyAnalysisController,
  ],
  providers: [
    ErpToolsService,
    ErpUsersService,
    ErpTslInvoiceItemsService,
    ErpTslExportInvoiceItemsService,
    ErpTslDvReqItemsService,
    ErpPuDelvInItemsService,
    ErpOspDelvInItemsService,
    ErpPuDelvItemsService,
    ErpOspDelvItemsService,
    ErpLgInoutMoveItemsService,
    ErpTslSalesDailyAnalysisService,
  ],
  exports: [
    ErpToolsService,
    ErpUsersService,
    ErpTslInvoiceItemsService,
    ErpTslExportInvoiceItemsService,
    ErpTslDvReqItemsService,
    ErpPuDelvInItemsService,
    ErpOspDelvInItemsService,
    ErpPuDelvItemsService,
    ErpOspDelvItemsService,
    ErpLgInoutMoveItemsService,
    ErpTslSalesDailyAnalysisService,
  ],
})
export class ErpModule {}
