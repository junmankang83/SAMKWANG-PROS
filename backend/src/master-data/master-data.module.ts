import { Module } from '@nestjs/common';
import { ErpModule } from '../external/erp/erp.module';
import { SparePartMasterController } from './spare-part-master.controller';
import { SparePartMasterService } from './spare-part-master.service';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ErpModule],
  controllers: [SparePartMasterController, ToolsController, UsersController],
  providers: [SparePartMasterService, ToolsService, UsersService],
  exports: [SparePartMasterService, ToolsService, UsersService],
})
export class MasterDataModule {}