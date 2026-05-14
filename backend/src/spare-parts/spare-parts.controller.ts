import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateSparePartItemDto, LedgerEntryBodyDto, LedgerPeriodQueryDto, SparePartItemsQueryDto, UpdateSparePartItemDto, UpsertLedgerPeriodBodyDto } from './dto/spare-parts.dto';
import { SparePartsService } from './spare-parts.service';

@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly spareParts: SparePartsService) {}

  @Get('items')
  listItems(@Query() query: SparePartItemsQueryDto) {
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listItemsForMonth(month);
  }

  @Post('items')
  createItem(@Body() dto: CreateSparePartItemDto) {
    return this.spareParts.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateSparePartItemDto) {
    return this.spareParts.updateItem(id, dto);
  }

  @Post('items/:id/inbound')
  inbound(@Param('id') id: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postInbound(id, dto.qty, dto.occurredAt, dto.note);
  }

  @Post('items/:id/outbound')
  outbound(@Param('id') id: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postOutbound(id, dto.qty, dto.occurredAt, dto.note);
  }

  @Get('ledger-period')
  getPeriod(@Query() query: LedgerPeriodQueryDto) {
    return this.spareParts.getLedgerPeriod(query.month);
  }

  @Put('ledger-period')
  putPeriod(@Body() dto: UpsertLedgerPeriodBodyDto) {
    return this.spareParts.upsertLedgerPeriod(dto);
  }
}
