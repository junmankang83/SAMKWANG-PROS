import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateSparePartItemDto, LedgerEntriesQueryDto, LedgerEntryBodyDto, LedgerPeriodQueryDto, SparePartItemsQueryDto, UpdateSparePartItemDto, UpsertLedgerPeriodBodyDto } from './dto/spare-parts.dto';
import { SparePartsService } from './spare-parts.service';

@Controller('spare-parts')
export class SparePartsController {
  constructor(private readonly spareParts: SparePartsService) {}

  @Get('items')
  listItems(@Query() query: SparePartItemsQueryDto) {
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listItemsForMonth(month);
  }

  @Get('inventory')
  listInventory(@Query() query: LedgerEntriesQueryDto) {
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listInventory(month, query.q);
  }

  @Get('inbound-entries')
  listInboundEntries(@Query() query: LedgerEntriesQueryDto) {
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listInboundEntries(month, query.q);
  }

  @Get('outbound-entries')
  listOutboundEntries(@Query() query: LedgerEntriesQueryDto) {
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listOutboundEntries(month, query.q);
  }

  @Post('items')
  createItem(@Body() dto: CreateSparePartItemDto) {
    return this.spareParts.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateSparePartItemDto) {
    return this.spareParts.updateItem(id, dto);
  }

  @Get('masters/:masterId/stock')
  getMasterStock(@Param('masterId') masterId: string) {
    return this.spareParts.getStockForMaster(masterId);
  }

  @Post('masters/:masterId/inbound')
  inboundByMaster(@Param('masterId') masterId: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postInboundByMaster(masterId, dto.qty, dto.occurredAt, dto.note);
  }

  @Post('masters/:masterId/outbound')
  outboundByMaster(@Param('masterId') masterId: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postOutboundByMaster(masterId, dto.qty, dto.occurredAt, dto.note);
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
