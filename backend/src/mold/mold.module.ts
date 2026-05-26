import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MoldCodeGroupsController } from './mold-code-groups.controller';
import { MoldCodeItemsController } from './mold-code-items.controller';
import { MoldInspectionItemsController } from './mold-inspection-items.controller';
import { MoldInspectionPlansController } from './mold-inspection-plans.controller';
import { MoldCodesService } from './mold-codes.service';
import { MoldInspectionItemsService } from './mold-inspection-items.service';
import { MoldInspectionPlansService } from './mold-inspection-plans.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    MoldCodeGroupsController,
    MoldCodeItemsController,
    MoldInspectionItemsController,
    MoldInspectionPlansController,
  ],
  providers: [MoldCodesService, MoldInspectionItemsService, MoldInspectionPlansService],
  exports: [MoldCodesService, MoldInspectionItemsService, MoldInspectionPlansService],
})
export class MoldModule {}
