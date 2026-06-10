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
import { ErpPdsfcWorkReportController } from './erp-pdsfc-work-report.controller';
import { ErpPdsfcWorkReportService } from './erp-pdsfc-work-report.service';
import { ErpWhStockListController } from './erp-wh-stock-list.controller';
import { ErpWhStockListService } from './erp-wh-stock-list.service';
import { ErpWhStockSumController } from './erp-wh-stock-sum.controller';
import { ErpWhStockSumService } from './erp-wh-stock-sum.service';
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
    ErpPdsfcWorkReportController,
    ErpWhStockSumController,
    ErpWhStockListController,
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
    ErpPdsfcWorkReportService,
    ErpWhStockSumService,
    ErpWhStockListService,
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
    ErpPdsfcWorkReportService,
    ErpWhStockSumService,
    ErpWhStockListService,
  ],
})
export class ErpModule {}
