import { Controller, Get, Query } from '@nestjs/common';
import { OspDelvItemsQueryDto } from './dto/osp-delv-items.query.dto';
import { ErpOspDelvItemsService } from './erp-osp-delv-items.service';

@Controller('erp/osp-delv-items')
export class ErpOspDelvItemsController {
  constructor(private readonly ospDelvItems: ErpOspDelvItemsService) {}

  @Get()
  list(@Query() query: OspDelvItemsQueryDto) {
    return this.ospDelvItems.listByDelvDateRange(query.from, query.to, query.limit, query.schemaMeta);
  }
}
