import { Module } from '@nestjs/common';
import { ErpToolsService } from './erp-tools.service';

@Module({
  providers: [ErpToolsService],
  exports: [ErpToolsService],
})
export class ErpModule {}
