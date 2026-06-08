import { Controller, Get, Query } from '@nestjs/common';
import { LgInoutMoveItemsQueryDto } from './dto/lg-inout-move-items.query.dto';
import { ErpLgInoutMoveItemsService } from './erp-lg-inout-move-items.service';

/** 이동품목조회 — `_TLGInoutDaily`·`_TLGInoutDailyItem`, `InOutType = 80` */
@Controller('erp/lg-inout-move-items')
export class ErpLgInoutMoveItemsController {
  constructor(private readonly lgMove: ErpLgInoutMoveItemsService) {}

  @Get()
  list(@Query() query: LgInoutMoveItemsQueryDto) {
    return this.lgMove.listByMoveDateRange(query.from, query.to, query.limit);
  }
}
