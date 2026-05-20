import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SparePartLedgerEntryType } from '@prisma/client';
import type {
  SparePartInventoryRow,
  SparePartItemRow,
  SparePartLedgerEntryRow,
  SparePartLedgerPeriodResponse,
} from '@samkwang/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSparePartItemDto, LedgerEntryBodyDto, UpdateSparePartItemDto, UpsertLedgerPeriodBodyDto } from './dto/spare-parts.dto';

function resolveMachineName(
  master: { machineBrand: string; tool?: { toolName: string } | null } | null,
  itemMachineBrand: string,
): string {
  if (master?.tool?.toolName) {
    return master.tool.toolName;
  }
  if (master?.machineBrand) {
    return master.machineBrand;
  }
  return itemMachineBrand;
}

/** 입고 이력 기준 사출기(설비) 그룹 키 */
function inboundToolGroupKey(entry: {
  toolId: string | null;
  toolNameSnapshot: string | null;
}): string {
  if (entry.toolId) {
    return `id:${entry.toolId}`;
  }
  const snap = entry.toolNameSnapshot?.trim();
  if (snap) {
    return `snap:${snap}`;
  }
  return '_none';
}

function resolveInboundMachineName(entry: {
  tool?: { toolName: string } | null;
  toolNameSnapshot: string | null;
}): string {
  const fromTool = entry.tool?.toolName?.trim();
  if (fromTool) {
    return fromTool;
  }
  const snap = entry.toolNameSnapshot?.trim();
  if (snap) {
    return snap;
  }
  return '—';
}

function monthWindow(periodMonth: string): { start: Date; end: Date } {
  const [y, m] = periodMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
  }
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
}

function inboundDateRangeWindow(inboundStart: string, inboundEnd: string): { start: Date; end: Date } {
  const startParts = inboundStart.split('-').map(Number);
  const endParts = inboundEnd.split('-').map(Number);
  if (startParts.length !== 3 || endParts.length !== 3) {
    throw new BadRequestException('입고일자는 YYYY-MM-DD 형식이어야 합니다.');
  }
  const [ys, ms, ds] = startParts;
  const [ye, me, de] = endParts;
  const start = new Date(Date.UTC(ys, ms - 1, ds, 0, 0, 0, 0));
  const end = new Date(Date.UTC(ye, me - 1, de + 1, 0, 0, 0, 0));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new BadRequestException('입고종료일자는 입고시작일자 이후여야 합니다.');
  }
  return { start, end };
}

function asOfDateExclusiveEnd(asOfDate: string): Date {
  const parts = asOfDate.split('-').map(Number);
  if (parts.length !== 3) {
    throw new BadRequestException('기준일은 YYYY-MM-DD 형식이어야 합니다.');
  }
  const [y, m, d] = parts;
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  if (Number.isNaN(end.getTime())) {
    throw new BadRequestException('기준일은 YYYY-MM-DD 형식이어야 합니다.');
  }
  return end;
}

function currentPeriodMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${mo}`;
}

function decStr(v: Prisma.Decimal): string {
  return v.toString();
}

/** 재고현황: 동일 마스터(제품) 행 합산, 재고 0 제외 */
function aggregateInventoryByMaster(rows: SparePartInventoryRow[]): SparePartInventoryRow[] {
  type Acc = {
    masterId: string;
    partCode: string | null;
    productName: string;
    spec: string | null;
    unit: string | null;
    optimalQty: string;
    inbound: Prisma.Decimal;
    outbound: Prisma.Decimal;
    stock: Prisma.Decimal;
    machineName: string;
    remarks: string | null;
  };

  const byMaster = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.masterId) {
      continue;
    }
    const inbound = new Prisma.Decimal(row.inboundQtyInMonth);
    const outbound = new Prisma.Decimal(row.outboundQtyInMonth);
    const stock = new Prisma.Decimal(row.currentQty);

    let acc = byMaster.get(row.masterId);
    if (!acc) {
      byMaster.set(row.masterId, {
        masterId: row.masterId,
        partCode: row.partCode,
        productName: row.productName,
        spec: row.spec,
        unit: row.unit,
        optimalQty: row.optimalQty,
        inbound,
        outbound,
        stock,
        machineName: row.machineName,
        remarks: row.remarks,
      });
      continue;
    }

    acc.inbound = acc.inbound.add(inbound);
    acc.outbound = acc.outbound.add(outbound);
    acc.stock = acc.stock.add(stock);

    if (acc.machineName !== row.machineName) {
      acc.machineName = '—';
    }

    if (!acc.remarks && row.remarks) {
      acc.remarks = row.remarks;
    }
  }

  return [...byMaster.values()]
    .filter((a) => a.stock.gt(0))
    .sort((a, b) => (a.partCode ?? '').localeCompare(b.partCode ?? '', 'ko'))
    .map((a) => ({
      id: a.masterId,
      masterId: a.masterId,
      partCode: a.partCode,
      machineName: a.machineName,
      productName: a.productName,
      spec: a.spec,
      unit: a.unit,
      optimalQty: a.optimalQty,
      inboundQtyInMonth: decStr(a.inbound),
      outboundQtyInMonth: decStr(a.outbound),
      currentQty: decStr(a.stock),
      lastInboundDateInMonth: null,
      lastOutboundDateInMonth: null,
      remarks: a.remarks,
    }));
}

function toIsoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

@Injectable()
export class SparePartsService {
  constructor(private readonly prisma: PrismaService) {}

  resolveMonth(month: string | undefined): string {
    if (!month) {
      return currentPeriodMonth();
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
    }
    return month;
  }

  async listItemsForMonth(periodMonth: string): Promise<SparePartItemRow[]> {
    const { start, end } = monthWindow(periodMonth);
    const items = await this.prisma.sparePartItem.findMany({
      orderBy: [{ machineBrand: 'asc' }, { productName: 'asc' }],
    });
    if (items.length === 0) {
      return [];
    }

    const entries = await this.prisma.sparePartLedgerEntry.findMany({
      where: {
        occurredAt: { gte: start, lt: end },
      },
    });

    const agg = new Map<
      string,
      { inbound: Prisma.Decimal; outbound: Prisma.Decimal; lastInbound: Date | null }
    >();
    for (const item of items) {
      agg.set(item.id, {
        inbound: new Prisma.Decimal(0),
        outbound: new Prisma.Decimal(0),
        lastInbound: null,
      });
    }

    for (const e of entries) {
      const row = agg.get(e.itemId);
      if (!row) {
        continue;
      }
      if (e.type === SparePartLedgerEntryType.INBOUND) {
        row.inbound = row.inbound.add(e.qty);
        if (!row.lastInbound || e.occurredAt > row.lastInbound) {
          row.lastInbound = e.occurredAt;
        }
      } else {
        row.outbound = row.outbound.add(e.qty);
      }
    }

    return items.map((item) => {
      const a = agg.get(item.id)!;
      return {
        id: item.id,
        machineBrand: item.machineBrand,
        productName: item.productName,
        spec: item.spec,
        optimalQty: decStr(item.optimalQty),
        currentQty: decStr(item.currentQty),
        remarks: item.remarks,
        lastInboundDateInMonth: a.lastInbound ? a.lastInbound.toISOString().slice(0, 10) : null,
        inboundQtyInMonth: decStr(a.inbound),
        outboundQtyInMonth: decStr(a.outbound),
      };
    });
  }

  async listInventoryAsOf(asOfDate: string, q?: string): Promise<SparePartInventoryRow[]> {
    const end = asOfDateExclusiveEnd(asOfDate);
    const term = q?.trim().toLowerCase();

    const items = await this.prisma.sparePartItem.findMany({
      where: {
        masterId: { not: null },
        ...(term
          ? {
              OR: [
                { productName: { contains: term, mode: 'insensitive' } },
                { master: { partCode: { contains: term, mode: 'insensitive' } } },
                { master: { productName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { master: { include: { tool: true } } },
      orderBy: [{ master: { sortOrder: 'asc' } }, { master: { partCode: 'asc' } }],
    });

    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((i) => i.id);
    const entries = await this.prisma.sparePartLedgerEntry.findMany({
      where: {
        itemId: { in: itemIds },
        occurredAt: { lt: end },
      },
    });

    const agg = new Map<
      string,
      { inbound: Prisma.Decimal; outbound: Prisma.Decimal; lastInbound: Date | null }
    >();
    for (const item of items) {
      agg.set(item.id, {
        inbound: new Prisma.Decimal(0),
        outbound: new Prisma.Decimal(0),
        lastInbound: null,
      });
    }

    for (const e of entries) {
      const row = agg.get(e.itemId);
      if (!row) {
        continue;
      }
      if (e.type === SparePartLedgerEntryType.INBOUND) {
        row.inbound = row.inbound.add(e.qty);
        if (!row.lastInbound || e.occurredAt > row.lastInbound) {
          row.lastInbound = e.occurredAt;
        }
      } else {
        row.outbound = row.outbound.add(e.qty);
      }
    }

    const rows = items.map((item) => {
      const master = item.master!;
      const a = agg.get(item.id)!;
      const stock = a.inbound.sub(a.outbound);
      return {
        id: item.id,
        masterId: item.masterId,
        partCode: master.partCode,
        machineName: resolveMachineName(master, item.machineBrand),
        productName: master.productName,
        spec: master.spec ?? item.spec,
        unit: master.unit,
        optimalQty: decStr(master.optimalQty),
        inboundQtyInMonth: decStr(a.inbound),
        outboundQtyInMonth: decStr(a.outbound),
        currentQty: decStr(stock),
        lastInboundDateInMonth: a.lastInbound ? a.lastInbound.toISOString().slice(0, 10) : null,
        lastOutboundDateInMonth: null,
        remarks: item.remarks ?? master.remarks,
      };
    });

    return aggregateInventoryByMaster(rows);
  }

  async listInventory(
    periodMonth: string | undefined,
    q?: string,
    inboundRange?: { inboundStart: string; inboundEnd: string },
  ): Promise<SparePartInventoryRow[]> {
    if (inboundRange) {
      return this.listInventoryByInboundTool(inboundRange, q);
    }

    const { start, end } = monthWindow(this.resolveMonth(periodMonth));
    const term = q?.trim().toLowerCase();

    const items = await this.prisma.sparePartItem.findMany({
      where: {
        masterId: { not: null },
        ...(term
          ? {
              OR: [
                { productName: { contains: term, mode: 'insensitive' } },
                { master: { partCode: { contains: term, mode: 'insensitive' } } },
                { master: { productName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { master: { include: { tool: true } } },
      orderBy: [{ master: { sortOrder: 'asc' } }, { master: { partCode: 'asc' } }],
    });

    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((i) => i.id);
    const entries = await this.prisma.sparePartLedgerEntry.findMany({
      where: {
        itemId: { in: itemIds },
        occurredAt: { gte: start, lt: end },
      },
    });

    const agg = new Map<
      string,
      { inbound: Prisma.Decimal; outbound: Prisma.Decimal; lastInbound: Date | null }
    >();
    for (const item of items) {
      agg.set(item.id, {
        inbound: new Prisma.Decimal(0),
        outbound: new Prisma.Decimal(0),
        lastInbound: null,
      });
    }

    for (const e of entries) {
      const row = agg.get(e.itemId);
      if (!row) {
        continue;
      }
      if (e.type === SparePartLedgerEntryType.INBOUND) {
        row.inbound = row.inbound.add(e.qty);
        if (!row.lastInbound || e.occurredAt > row.lastInbound) {
          row.lastInbound = e.occurredAt;
        }
      } else {
        row.outbound = row.outbound.add(e.qty);
      }
    }

    return items.map((item) => {
      const master = item.master!;
      const a = agg.get(item.id)!;
      return {
        id: item.id,
        masterId: item.masterId,
        partCode: master.partCode,
        machineName: resolveMachineName(master, item.machineBrand),
        productName: master.productName,
        spec: master.spec ?? item.spec,
        unit: master.unit,
        optimalQty: decStr(master.optimalQty),
        inboundQtyInMonth: decStr(a.inbound),
        outboundQtyInMonth: decStr(a.outbound),
        currentQty: decStr(item.currentQty),
        lastInboundDateInMonth: a.lastInbound ? a.lastInbound.toISOString().slice(0, 10) : null,
        lastOutboundDateInMonth: null,
        remarks: item.remarks ?? master.remarks,
      };
    });
  }

  /**
   * 부품 입출고 대장: 입고 설비(사출기)별·기간 내 입출고를 FIFO로 매칭해 행 분리
   */
  async listInventoryByInboundTool(
    inboundRange: { inboundStart: string; inboundEnd: string },
    q?: string,
  ): Promise<SparePartInventoryRow[]> {
    const { start, end } = inboundDateRangeWindow(inboundRange.inboundStart, inboundRange.inboundEnd);
    const term = q?.trim().toLowerCase();

    const items = await this.prisma.sparePartItem.findMany({
      where: {
        masterId: { not: null },
        ...(term
          ? {
              OR: [
                { productName: { contains: term, mode: 'insensitive' } },
                { master: { partCode: { contains: term, mode: 'insensitive' } } },
                { master: { productName: { contains: term, mode: 'insensitive' } } },
                { master: { machineBrand: { contains: term, mode: 'insensitive' } } },
                { master: { tool: { toolName: { contains: term, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: { master: { include: { tool: true } } },
    });

    if (items.length === 0) {
      return [];
    }

    const itemById = new Map(items.map((i) => [i.id, i]));
    const itemIds = items.map((i) => i.id);
    const entries = await this.prisma.sparePartLedgerEntry.findMany({
      where: {
        itemId: { in: itemIds },
        occurredAt: { gte: start, lt: end },
      },
      include: { tool: true },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    type Lot = {
      toolGroup: string;
      machineName: string;
      occurredAt: Date;
      qtyRemaining: Prisma.Decimal;
    };

    type PinnedRow = {
      itemId: string;
      toolGroup: string;
      machineName: string;
      inboundDate: string | null;
      inboundQty: Prisma.Decimal;
      outboundDate: string | null;
      outboundQty: Prisma.Decimal;
    };

    const byItemInboundLots = new Map<string, Lot[]>();
    const byItemOutboundEvts = new Map<string, { occurredAt: Date; qty: Prisma.Decimal }[]>();

    for (const e of entries) {
      if (e.type === SparePartLedgerEntryType.INBOUND) {
        const toolGroup = inboundToolGroupKey(e);
        const machineName = resolveInboundMachineName(e);
        const list = byItemInboundLots.get(e.itemId) ?? [];
        list.push({
          toolGroup,
          machineName,
          occurredAt: e.occurredAt,
          qtyRemaining: new Prisma.Decimal(e.qty),
        });
        byItemInboundLots.set(e.itemId, list);
      } else {
        const list = byItemOutboundEvts.get(e.itemId) ?? [];
        list.push({
          occurredAt: e.occurredAt,
          qty: new Prisma.Decimal(e.qty),
        });
        byItemOutboundEvts.set(e.itemId, list);
      }
    }

    const pinnedRows: PinnedRow[] = [];
    const uniqueItemIds = [...new Set(itemIds)];

    for (const itemId of uniqueItemIds) {
      const lots = (byItemInboundLots.get(itemId) ?? []).map((l) => ({
        toolGroup: l.toolGroup,
        machineName: l.machineName,
        occurredAt: l.occurredAt,
        qtyRemaining: new Prisma.Decimal(l.qtyRemaining),
      }));
      const outs = byItemOutboundEvts.get(itemId) ?? [];

      let lotIdx = 0;

      const advanceLot = (): void => {
        while (lotIdx < lots.length && !lots[lotIdx].qtyRemaining.gt(0)) {
          lotIdx += 1;
        }
      };

      for (const o of outs) {
        let qRem = new Prisma.Decimal(o.qty);
        const outDay = o.occurredAt.toISOString().slice(0, 10);
        while (qRem.gt(0)) {
          advanceLot();
          if (lotIdx >= lots.length) {
            pinnedRows.push({
              itemId,
              toolGroup: '_none',
              machineName: '—',
              inboundDate: null,
              inboundQty: new Prisma.Decimal(0),
              outboundDate: outDay,
              outboundQty: new Prisma.Decimal(qRem),
            });
            qRem = new Prisma.Decimal(0);
            break;
          }
          const lot = lots[lotIdx];
          const take = lot.qtyRemaining.lt(qRem) ? new Prisma.Decimal(lot.qtyRemaining) : new Prisma.Decimal(qRem);
          const inDay = lot.occurredAt.toISOString().slice(0, 10);
          pinnedRows.push({
            itemId,
            toolGroup: lot.toolGroup,
            machineName: lot.machineName,
            inboundDate: inDay,
            inboundQty: take,
            outboundDate: outDay,
            outboundQty: take,
          });
          lot.qtyRemaining = lot.qtyRemaining.minus(take);
          qRem = qRem.minus(take);
        }
      }

      for (let j = 0; j < lots.length; j++) {
        const lot = lots[j];
        if (!lot.qtyRemaining.gt(0)) {
          continue;
        }
        const inDay = lot.occurredAt.toISOString().slice(0, 10);
        pinnedRows.push({
          itemId,
          toolGroup: lot.toolGroup,
          machineName: lot.machineName,
          inboundDate: inDay,
          inboundQty: new Prisma.Decimal(lot.qtyRemaining),
          outboundDate: null,
          outboundQty: new Prisma.Decimal(0),
        });
      }
    }

    const result: SparePartInventoryRow[] = [];
    let rowSeq = 0;

    for (const pr of pinnedRows) {
      const item = itemById.get(pr.itemId);
      if (!item?.master) {
        continue;
      }
      const master = item.master;
      const hasActivity = pr.inboundQty.gt(0) || pr.outboundQty.gt(0);
      if (!hasActivity) {
        continue;
      }
      if (term) {
        const machineLower = pr.machineName.toLowerCase();
        const matchesMachine = machineLower.includes(term);
        const matchesItem =
          item.productName.toLowerCase().includes(term) ||
          master.partCode.toLowerCase().includes(term) ||
          master.productName.toLowerCase().includes(term) ||
          master.machineBrand.toLowerCase().includes(term) ||
          (master.tool?.toolName?.toLowerCase().includes(term) ?? false);
        if (!matchesMachine && !matchesItem) {
          continue;
        }
      }
      result.push({
        id: `${pr.itemId}::${rowSeq++}`,
        masterId: item.masterId,
        partCode: master.partCode,
        machineName: pr.machineName,
        productName: master.productName,
        spec: master.spec ?? item.spec,
        unit: master.unit,
        optimalQty: decStr(master.optimalQty),
        inboundQtyInMonth: decStr(pr.inboundQty),
        outboundQtyInMonth: decStr(pr.outboundQty),
        currentQty: decStr(item.currentQty),
        lastInboundDateInMonth: pr.inboundDate,
        lastOutboundDateInMonth: pr.outboundDate,
        remarks: item.remarks ?? master.remarks,
      });
    }

    result.sort((a, b) => {
      const code = (a.partCode ?? '').localeCompare(b.partCode ?? '', 'ko');
      if (code !== 0) {
        return code;
      }
      const machine = a.machineName.localeCompare(b.machineName, 'ko');
      if (machine !== 0) {
        return machine;
      }
      const pn = a.productName.localeCompare(b.productName, 'ko');
      if (pn !== 0) {
        return pn;
      }
      const inD = (a.lastInboundDateInMonth ?? '').localeCompare(b.lastInboundDateInMonth ?? '', 'ko');
      if (inD !== 0) {
        return inD;
      }
      return (a.lastOutboundDateInMonth ?? '').localeCompare(b.lastOutboundDateInMonth ?? '', 'ko');
    });

    return result;
  }

  async createItem(dto: CreateSparePartItemDto) {
    if (dto.masterId) {
      const master = await this.prisma.sparePartMaster.findUnique({
        where: { id: dto.masterId },
      });
      if (!master) {
        throw new NotFoundException('기초정보를 찾을 수 없습니다.');
      }
      if (!master.isActive) {
        throw new BadRequestException('비활성화된 기초정보는 사용할 수 없습니다.');
      }
      const optimal =
        dto.optimalQty !== undefined
          ? new Prisma.Decimal(dto.optimalQty)
          : master.optimalQty;
      return this.prisma.sparePartItem.create({
        data: {
          masterId: master.id,
          machineBrand: master.machineBrand,
          productName: master.productName,
          spec: master.spec,
          optimalQty: optimal,
          currentQty: new Prisma.Decimal(0),
          remarks: dto.remarks ?? master.remarks,
        },
      });
    }

    if (!dto.machineBrand?.trim() || !dto.productName?.trim()) {
      throw new BadRequestException('masterId 또는 사출기·제품명이 필요합니다.');
    }

    const optimal = new Prisma.Decimal(dto.optimalQty ?? 0);
    return this.prisma.sparePartItem.create({
      data: {
        machineBrand: dto.machineBrand.trim(),
        productName: dto.productName.trim(),
        spec: dto.spec ?? null,
        optimalQty: optimal,
        currentQty: new Prisma.Decimal(0),
        remarks: dto.remarks ?? null,
      },
    });
  }

  async updateItem(id: string, dto: UpdateSparePartItemDto) {
    try {
      return await this.prisma.sparePartItem.update({
        where: { id },
        data: {
          ...(dto.machineBrand !== undefined && { machineBrand: dto.machineBrand }),
          ...(dto.productName !== undefined && { productName: dto.productName }),
          ...(dto.spec !== undefined && { spec: dto.spec }),
          ...(dto.optimalQty !== undefined && { optimalQty: new Prisma.Decimal(dto.optimalQty) }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        },
      });
    } catch {
      throw new NotFoundException('부품 항목을 찾을 수 없습니다.');
    }
  }

  private async listEntriesByTypeInRange(
    start: Date,
    end: Date,
    type: SparePartLedgerEntryType,
    q?: string,
  ): Promise<SparePartLedgerEntryRow[]> {
    const term = q?.trim();
    const entries = await this.prisma.sparePartLedgerEntry.findMany({
      where: {
        type,
        occurredAt: { gte: start, lt: end },
        ...(term
          ? {
              item: {
                OR: [
                  { productName: { contains: term, mode: 'insensitive' } },
                  { machineBrand: { contains: term, mode: 'insensitive' } },
                  { master: { partCode: { contains: term, mode: 'insensitive' } } },
                ],
              },
            }
          : {}),
      },
      include: {
        item: { include: { master: { include: { tool: true } } } },
        tool: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return entries.map((e) => {
      const toolName =
        e.tool?.toolName ?? e.toolNameSnapshot ?? e.item.master?.tool?.toolName ?? null;
      const machineBrand = toolName ?? e.item.machineBrand;
      return {
        id: e.id,
        itemId: e.itemId,
        partCode: e.item.master?.partCode ?? null,
        toolId: e.toolId,
        toolName,
        machineBrand,
        productName: e.item.productName,
        spec: e.item.spec,
        unit: e.item.master?.unit ?? null,
        qty: decStr(e.qty),
        occurredAt: e.occurredAt.toISOString(),
        note: e.note,
      };
    });
  }

  private listEntriesByType(
    periodMonth: string,
    type: SparePartLedgerEntryType,
    q?: string,
  ): Promise<SparePartLedgerEntryRow[]> {
    const { start, end } = monthWindow(periodMonth);
    return this.listEntriesByTypeInRange(start, end, type, q);
  }

  listInboundEntries(periodMonth: string, q?: string): Promise<SparePartLedgerEntryRow[]> {
    return this.listEntriesByType(periodMonth, SparePartLedgerEntryType.INBOUND, q);
  }

  listOutboundEntries(periodMonth: string, q?: string): Promise<SparePartLedgerEntryRow[]> {
    return this.listEntriesByType(periodMonth, SparePartLedgerEntryType.OUTBOUND, q);
  }

  listInboundEntriesByDateRange(
    inboundStart: string,
    inboundEnd: string,
    q?: string,
  ): Promise<SparePartLedgerEntryRow[]> {
    const { start, end } = inboundDateRangeWindow(inboundStart, inboundEnd);
    return this.listEntriesByTypeInRange(start, end, SparePartLedgerEntryType.INBOUND, q);
  }

  listOutboundEntriesByDateRange(
    inboundStart: string,
    inboundEnd: string,
    q?: string,
  ): Promise<SparePartLedgerEntryRow[]> {
    const { start, end } = inboundDateRangeWindow(inboundStart, inboundEnd);
    return this.listEntriesByTypeInRange(start, end, SparePartLedgerEntryType.OUTBOUND, q);
  }

  async ensureItemForMaster(masterId: string) {
    const master = await this.prisma.sparePartMaster.findUnique({ where: { id: masterId } });
    if (!master) {
      throw new NotFoundException('부품정보를 찾을 수 없습니다.');
    }
    if (!master.isActive) {
      throw new BadRequestException('비활성화된 부품정보는 사용할 수 없습니다.');
    }
    const existing = await this.prisma.sparePartItem.findFirst({ where: { masterId } });
    if (existing) {
      return existing;
    }
    return this.createItem({ masterId });
  }

  async getStockForMaster(masterId: string): Promise<{ currentQty: string }> {
    const item = await this.prisma.sparePartItem.findFirst({ where: { masterId } });
    return { currentQty: item ? decStr(item.currentQty) : '0' };
  }

  private async resolveInboundTool(
    toolId: string | null | undefined,
    masterId?: string,
  ): Promise<{ toolId: string | null; toolNameSnapshot: string | null }> {
    let resolvedToolId = toolId ?? null;
    if (!resolvedToolId && masterId) {
      const master = await this.prisma.sparePartMaster.findUnique({
        where: { id: masterId },
        select: { toolId: true },
      });
      resolvedToolId = master?.toolId ?? null;
    }
    if (!resolvedToolId) {
      return { toolId: null, toolNameSnapshot: null };
    }
    const tool = await this.prisma.tool.findUnique({ where: { id: resolvedToolId } });
    if (!tool) {
      throw new BadRequestException('설비정보를 찾을 수 없습니다.');
    }
    return { toolId: tool.id, toolNameSnapshot: tool.toolName };
  }

  async postInboundByMaster(
    masterId: string,
    qty: number,
    occurredAt: string,
    note: string | null | undefined,
    toolId?: string | null,
  ) {
    const item = await this.ensureItemForMaster(masterId);
    const toolSnap = await this.resolveInboundTool(toolId, masterId);
    await this.postInbound(item.id, qty, occurredAt, note, toolSnap.toolId, toolSnap.toolNameSnapshot);
    return { ok: true as const };
  }

  async postOutboundByMaster(
    masterId: string,
    qty: number,
    occurredAt: string,
    note: string | null | undefined,
  ) {
    const item = await this.ensureItemForMaster(masterId);
    await this.postOutbound(item.id, qty, occurredAt, note);
    return { ok: true as const };
  }

  async postInbound(
    itemId: string,
    qty: number,
    occurredAt: string,
    note: string | null | undefined,
    toolId?: string | null,
    toolNameSnapshot?: string | null,
  ) {
    const at = new Date(occurredAt);
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('occurredAt이 올바른 날짜가 아닙니다.');
    }
    let resolvedToolId = toolId ?? null;
    let resolvedSnapshot = toolNameSnapshot ?? null;
    if (toolId && !resolvedSnapshot) {
      const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
      if (!tool) {
        throw new BadRequestException('설비정보를 찾을 수 없습니다.');
      }
      resolvedToolId = tool.id;
      resolvedSnapshot = tool.toolName;
    }
    const q = new Prisma.Decimal(qty);
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.sparePartItem.findUnique({ where: { id: itemId } });
      if (!item) {
        throw new NotFoundException('부품 항목을 찾을 수 없습니다.');
      }
      await tx.sparePartLedgerEntry.create({
        data: {
          itemId,
          type: SparePartLedgerEntryType.INBOUND,
          qty: q,
          occurredAt: at,
          note: note ?? null,
          toolId: resolvedToolId,
          toolNameSnapshot: resolvedSnapshot,
        },
      });
      await tx.sparePartItem.update({
        where: { id: itemId },
        data: { currentQty: item.currentQty.add(q) },
      });
    });
  }

  async postOutbound(itemId: string, qty: number, occurredAt: string, note: string | null | undefined) {
    const at = new Date(occurredAt);
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('occurredAt이 올바른 날짜가 아닙니다.');
    }
    const q = new Prisma.Decimal(qty);
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.sparePartItem.findUnique({ where: { id: itemId } });
      if (!item) {
        throw new NotFoundException('부품 항목을 찾을 수 없습니다.');
      }
      const next = item.currentQty.minus(q);
      if (next.lt(0)) {
        throw new BadRequestException('출고 수량이 현재고를 초과합니다.');
      }
      await tx.sparePartLedgerEntry.create({
        data: {
          itemId,
          type: SparePartLedgerEntryType.OUTBOUND,
          qty: q,
          occurredAt: at,
          note: note ?? null,
        },
      });
      await tx.sparePartItem.update({
        where: { id: itemId },
        data: { currentQty: next },
      });
    });
  }

  async updateLedgerEntry(entryId: string, dto: LedgerEntryBodyDto): Promise<{ ok: true }> {
    const at = new Date(dto.occurredAt);
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('occurredAt이 올바른 날짜가 아닙니다.');
    }
    const newQty = new Prisma.Decimal(dto.qty);

    await this.prisma.$transaction(async (tx) => {
      const entry = await tx.sparePartLedgerEntry.findUnique({
        where: { id: entryId },
        include: { item: true },
      });
      if (!entry) {
        throw new NotFoundException('입출고 내역을 찾을 수 없습니다.');
      }

      const oldQty = entry.qty;
      const delta = newQty.sub(oldQty);
      const inc =
        entry.type === SparePartLedgerEntryType.INBOUND ? delta : oldQty.sub(newQty);
      const nextItemQty = entry.item.currentQty.add(inc);
      if (nextItemQty.lt(0)) {
        throw new BadRequestException('수정 후 재고가 음수가 됩니다. 수량을 줄이거나 출고 수량을 확인해 주세요.');
      }

      let toolId = entry.toolId;
      let toolNameSnapshot = entry.toolNameSnapshot;
      if (entry.type === SparePartLedgerEntryType.INBOUND && dto.toolId !== undefined) {
        const snap = await this.resolveInboundTool(dto.toolId, entry.item.masterId ?? undefined);
        toolId = snap.toolId;
        toolNameSnapshot = snap.toolNameSnapshot;
      }

      await tx.sparePartLedgerEntry.update({
        where: { id: entryId },
        data: {
          qty: newQty,
          occurredAt: at,
          note: dto.note ?? null,
          ...(entry.type === SparePartLedgerEntryType.INBOUND && dto.toolId !== undefined
            ? { toolId, toolNameSnapshot }
            : {}),
        },
      });
      await tx.sparePartItem.update({
        where: { id: entry.itemId },
        data: { currentQty: nextItemQty },
      });
    });

    return { ok: true as const };
  }

  async deleteLedgerEntry(entryId: string): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      const entry = await tx.sparePartLedgerEntry.findUnique({
        where: { id: entryId },
        include: { item: true },
      });
      if (!entry) {
        throw new NotFoundException('입출고 내역을 찾을 수 없습니다.');
      }

      const q = entry.qty;
      const inc =
        entry.type === SparePartLedgerEntryType.INBOUND ? q.negated() : q;
      const nextItemQty = entry.item.currentQty.add(inc);
      if (nextItemQty.lt(0)) {
        throw new BadRequestException('삭제 후 재고가 음수가 됩니다.');
      }

      await tx.sparePartLedgerEntry.delete({ where: { id: entryId } });
      await tx.sparePartItem.update({
        where: { id: entry.itemId },
        data: { currentQty: nextItemQty },
      });
    });

    return { ok: true as const };
  }

  async getLedgerPeriod(periodMonth: string): Promise<SparePartLedgerPeriodResponse> {
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
    }
    const row = await this.prisma.sparePartLedgerPeriod.findUnique({
      where: { periodMonth },
    });
    return {
      periodMonth,
      preparedBy: row?.preparedBy ?? null,
      preparedAt: toIsoOrNull(row?.preparedAt ?? null),
      reviewedBy: row?.reviewedBy ?? null,
      reviewedAt: toIsoOrNull(row?.reviewedAt ?? null),
      confirmedBy: row?.confirmedBy ?? null,
      confirmedAt: toIsoOrNull(row?.confirmedAt ?? null),
      teamLeadBy: row?.teamLeadBy ?? null,
      teamLeadAt: toIsoOrNull(row?.teamLeadAt ?? null),
    };
  }

  async upsertLedgerPeriod(dto: UpsertLedgerPeriodBodyDto): Promise<SparePartLedgerPeriodResponse> {
    const parseDate = (v: string | null | undefined): Date | null | undefined => {
      if (v === undefined) {
        return undefined;
      }
      if (v === null || v === '') {
        return null;
      }
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('날짜 형식이 올바르지 않습니다.');
      }
      return d;
    };

    const updateData: Prisma.SparePartLedgerPeriodUpdateInput = {};
    if (dto.preparedBy !== undefined) {
      updateData.preparedBy = dto.preparedBy;
    }
    if (dto.preparedAt !== undefined) {
      updateData.preparedAt = parseDate(dto.preparedAt) ?? null;
    }
    if (dto.reviewedBy !== undefined) {
      updateData.reviewedBy = dto.reviewedBy;
    }
    if (dto.reviewedAt !== undefined) {
      updateData.reviewedAt = parseDate(dto.reviewedAt) ?? null;
    }
    if (dto.confirmedBy !== undefined) {
      updateData.confirmedBy = dto.confirmedBy;
    }
    if (dto.confirmedAt !== undefined) {
      updateData.confirmedAt = parseDate(dto.confirmedAt) ?? null;
    }
    if (dto.teamLeadBy !== undefined) {
      updateData.teamLeadBy = dto.teamLeadBy;
    }
    if (dto.teamLeadAt !== undefined) {
      updateData.teamLeadAt = parseDate(dto.teamLeadAt) ?? null;
    }

    await this.prisma.sparePartLedgerPeriod.upsert({
      where: { periodMonth: dto.periodMonth },
      create: {
        periodMonth: dto.periodMonth,
        preparedBy: dto.preparedBy ?? null,
        preparedAt: parseDate(dto.preparedAt) ?? null,
        reviewedBy: dto.reviewedBy ?? null,
        reviewedAt: parseDate(dto.reviewedAt) ?? null,
        confirmedBy: dto.confirmedBy ?? null,
        confirmedAt: parseDate(dto.confirmedAt) ?? null,
        teamLeadBy: dto.teamLeadBy ?? null,
        teamLeadAt: parseDate(dto.teamLeadAt) ?? null,
      },
      update: updateData,
    });

    return this.getLedgerPeriod(dto.periodMonth);
  }
}
