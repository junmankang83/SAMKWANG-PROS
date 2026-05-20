import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  CreateSparePartItemDto,
  InventoryQueryDto,
  LedgerEntriesQueryDto,
  LedgerEntryBodyDto,
  LedgerPeriodQueryDto,
  SparePartItemsQueryDto,
  UpdateSparePartItemDto,
  UpsertLedgerPeriodBodyDto,
} from './dto/spare-parts.dto';
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
  listInventory(@Query() query: InventoryQueryDto) {
    if (query.asOfDate) {
      return this.spareParts.listInventoryAsOf(query.asOfDate, query.q);
    }
    if (query.inboundStart || query.inboundEnd) {
      if (!query.inboundStart || !query.inboundEnd) {
        throw new BadRequestException('입고시작일자와 입고종료일자를 모두 입력해 주세요.');
      }
      return this.spareParts.listInventory(undefined, query.q, {
        inboundStart: query.inboundStart,
        inboundEnd: query.inboundEnd,
      });
    }
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listInventory(month, query.q);
  }

  @Get('inbound-entries')
  listInboundEntries(@Query() query: LedgerEntriesQueryDto) {
    if (query.inboundStart || query.inboundEnd) {
      if (!query.inboundStart || !query.inboundEnd) {
        throw new BadRequestException('시작일자와 종료일자를 모두 입력해 주세요.');
      }
      return this.spareParts.listInboundEntriesByDateRange(
        query.inboundStart,
        query.inboundEnd,
        query.q,
      );
    }
    const month = this.spareParts.resolveMonth(query.month);
    return this.spareParts.listInboundEntries(month, query.q);
  }

  @Get('outbound-entries')
  listOutboundEntries(@Query() query: LedgerEntriesQueryDto) {
    if (query.inboundStart || query.inboundEnd) {
      if (!query.inboundStart || !query.inboundEnd) {
        throw new BadRequestException('시작일자와 종료일자를 모두 입력해 주세요.');
      }
      return this.spareParts.listOutboundEntriesByDateRange(
        query.inboundStart,
        query.inboundEnd,
        query.q,
      );
    }
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
    return this.spareParts.postInboundByMaster(
      masterId,
      dto.qty,
      dto.occurredAt,
      dto.note,
      dto.toolId,
    );
  }

  @Post('masters/:masterId/outbound')
  outboundByMaster(@Param('masterId') masterId: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postOutboundByMaster(masterId, dto.qty, dto.occurredAt, dto.note);
  }

  @Post('items/:id/inbound')
  inbound(@Param('id') id: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postInbound(id, dto.qty, dto.occurredAt, dto.note, dto.toolId);
  }

  @Post('items/:id/outbound')
  outbound(@Param('id') id: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.postOutbound(id, dto.qty, dto.occurredAt, dto.note);
  }

  @Patch('ledger-entries/:id')
  patchLedgerEntry(@Param('id') id: string, @Body() dto: LedgerEntryBodyDto) {
    return this.spareParts.updateLedgerEntry(id, dto);
  }

  @Delete('ledger-entries/:id')
  deleteLedgerEntry(@Param('id') id: string) {
    return this.spareParts.deleteLedgerEntry(id);
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
