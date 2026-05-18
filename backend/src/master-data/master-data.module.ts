import { Module } from '@nestjs/common';
import { SparePartMasterController } from './spare-part-master.controller';
import { SparePartMasterService } from './spare-part-master.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [SparePartMasterController, UsersController],
  providers: [SparePartMasterService, UsersService],
  exports: [SparePartMasterService, UsersService],
})
export class MasterDataModule {}
