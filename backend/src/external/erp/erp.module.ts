import { Module } from '@nestjs/common';
import { ErpPuDelvInItemsController } from './erp-pu-delv-in-items.controller';
import { ErpPuDelvInItemsService } from './erp-pu-delv-in-items.service';
import { ErpTslInvoiceItemsController } from './erp-tsl-invoice-items.controller';
import { ErpTslInvoiceItemsService } from './erp-tsl-invoice-items.service';
import { ErpToolsService } from './erp-tools.service';
import { ErpUsersService } from './erp-users.service';

@Module({
  controllers: [ErpTslInvoiceItemsController, ErpPuDelvInItemsController],
  providers: [ErpToolsService, ErpUsersService, ErpTslInvoiceItemsService, ErpPuDelvInItemsService],
  exports: [ErpToolsService, ErpUsersService, ErpTslInvoiceItemsService, ErpPuDelvInItemsService],
})
export class ErpModule {}
