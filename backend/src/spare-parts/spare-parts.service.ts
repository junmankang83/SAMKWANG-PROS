import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SparePartLedgerEntryType } from '@prisma/client';
import type {
  SparePartInventoryRow,
  SparePartItemRow,
  SparePartLedgerEntryRow,
  SparePartLedgerPeriodResponse,
} from '@samkwang/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSparePartItemDto, UpdateSparePartItemDto, UpsertLedgerPeriodBodyDto } from './dto/spare-parts.dto';

function monthWindow(periodMonth: string): { start: Date; end: Date } {
  const [y, m] = periodMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new BadRequestException('month는 YYYY-MM 형식이어야 합니다.');
  }
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
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

  async listInventory(periodMonth: string, q?: string): Promise<SparePartInventoryRow[]> {
    const { start, end } = monthWindow(periodMonth);
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
      include: { master: true },
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
        productName: master.productName,
        spec: master.spec ?? item.spec,
        unit: master.unit,
        optimalQty: decStr(master.optimalQty),
        inboundQtyInMonth: decStr(a.inbound),
        outboundQtyInMonth: decStr(a.outbound),
        currentQty: decStr(item.currentQty),
        lastInboundDateInMonth: a.lastInbound ? a.lastInbound.toISOString().slice(0, 10) : null,
        remarks: item.remarks ?? master.remarks,
      };
    });
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

  private async listEntriesByType(
    periodMonth: string,
    type: SparePartLedgerEntryType,
    q?: string,
  ): Promise<SparePartLedgerEntryRow[]> {
    const { start, end } = monthWindow(periodMonth);
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
        item: { include: { master: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return entries.map((e) => ({
      id: e.id,
      itemId: e.itemId,
      partCode: e.item.master?.partCode ?? null,
      machineBrand: e.item.machineBrand,
      productName: e.item.productName,
      spec: e.item.spec,
      unit: e.item.master?.unit ?? null,
      qty: decStr(e.qty),
      occurredAt: e.occurredAt.toISOString(),
      note: e.note,
    }));
  }

  listInboundEntries(periodMonth: string, q?: string): Promise<SparePartLedgerEntryRow[]> {
    return this.listEntriesByType(periodMonth, SparePartLedgerEntryType.INBOUND, q);
  }

  listOutboundEntries(periodMonth: string, q?: string): Promise<SparePartLedgerEntryRow[]> {
    return this.listEntriesByType(periodMonth, SparePartLedgerEntryType.OUTBOUND, q);
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

  async postInboundByMaster(
    masterId: string,
    qty: number,
    occurredAt: string,
    note: string | null | undefined,
  ) {
    const item = await this.ensureItemForMaster(masterId);
    await this.postInbound(item.id, qty, occurredAt, note);
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

  async postInbound(itemId: string, qty: number, occurredAt: string, note: string | null | undefined) {
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
      await tx.sparePartLedgerEntry.create({
        data: {
          itemId,
          type: SparePartLedgerEntryType.INBOUND,
          qty: q,
          occurredAt: at,
          note: note ?? null,
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
