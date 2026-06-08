import { Controller, Get, Query } from '@nestjs/common';
import { OspDelvInItemsQueryDto } from './dto/osp-delv-in-items.query.dto';
import { ErpOspDelvInItemsService } from './erp-osp-delv-in-items.service';

@Controller('erp/osp-delv-in-items')
export class ErpOspDelvInItemsController {
  constructor(private readonly ospDelvInItems: ErpOspDelvInItemsService) {}

  @Get()
  list(@Query() query: OspDelvInItemsQueryDto) {
    return this.ospDelvInItems.listByDelvInDateRange(query.from, query.to, query.limit);
  }
}
