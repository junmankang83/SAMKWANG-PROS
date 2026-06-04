import { Controller, Get, Query } from '@nestjs/common';
import { PuDelvInItemsQueryDto } from './dto/pu-delv-in-items.query.dto';
import { ErpPuDelvInItemsService } from './erp-pu-delv-in-items.service';

@Controller('erp/pu-delv-in-items')
export class ErpPuDelvInItemsController {
  constructor(private readonly puDelvInItems: ErpPuDelvInItemsService) {}

  @Get()
  list(@Query() query: PuDelvInItemsQueryDto) {
    return this.puDelvInItems.listByDelvInDateRange(query.from, query.to, query.limit);
  }
}
