import { Module } from '@nestjs/common';
import { ErpToolsService } from './erp-tools.service';
import { ErpUsersService } from './erp-users.service';

@Module({
  providers: [ErpToolsService, ErpUsersService],
  exports: [ErpToolsService, ErpUsersService],
})
export class ErpModule {}
