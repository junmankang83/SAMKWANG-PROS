import { Controller, Get, Query } from '@nestjs/common';
import { TslDvReqItemsQueryDto } from './dto/tsl-dv-req-items.query.dto';
import { ErpTslDvReqItemsService } from './erp-tsl-dv-req-items.service';

@Controller('erp/tsl-dv-req-items')
export class ErpTslDvReqItemsController {
  constructor(private readonly tslDvReqItems: ErpTslDvReqItemsService) {}

  @Get()
  list(@Query() query: TslDvReqItemsQueryDto) {
    return this.tslDvReqItems.listByReqDateRange(query.from, query.to, query.limit);
  }
}
