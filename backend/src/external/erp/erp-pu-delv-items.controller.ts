import { Controller, Get, Query } from '@nestjs/common';
import { PuDelvItemsQueryDto } from './dto/pu-delv-items.query.dto';
import { ErpPuDelvItemsService } from './erp-pu-delv-items.service';

@Controller('erp/pu-delv-items')
export class ErpPuDelvItemsController {
  constructor(private readonly puDelvItems: ErpPuDelvItemsService) {}

  @Get()
  list(@Query() query: PuDelvItemsQueryDto) {
    return this.puDelvItems.listByDelvDateRange(query.from, query.to, query.limit, query.schemaMeta);
  }
}
