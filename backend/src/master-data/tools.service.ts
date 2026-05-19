import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ErpToolRow, ToolRow, ToolsSyncResult } from '@samkwang/shared';
import { ErpToolsService, type ErpToolRecord } from '../external/erp/erp-tools.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateToolDto, UpdateToolDto } from './dto/tools.dto';

function toRow(record: {
  id: string;
  toolSeq: number;
  toolName: string;
  toolNo: string;
  spec: string | null;
  smStatus: number | null;
  smStatusNm: string | null;
  umToolKind: number | null;
  umToolKindName: string | null;
  assetSeq: number | null;
  asstName: string | null;
  asstNo: string | null;
  deptSeq: number | null;
  deptName: string | null;
  empSeq: number | null;
  empName: string | null;
  empid: string | null;
  lastUserName: string | null;
  lastDateTime: Date | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ToolRow {
  return {
    id: record.id,
    toolSeq: record.toolSeq,
    toolName: record.toolName,
    toolNo: record.toolNo,
    spec: record.spec,
    smStatus: record.smStatus,
    smStatusNm: record.smStatusNm,
    umToolKind: record.umToolKind,
    umToolKindName: record.umToolKindName,
    assetSeq: record.assetSeq,
    asstName: record.asstName,
    asstNo: record.asstNo,
    deptSeq: record.deptSeq,
    deptName: record.deptName,
    empSeq: record.empSeq,
    empName: record.empName,
    empid: record.empid,
    lastUserName: record.lastUserName,
    lastDateTime: record.lastDateTime?.toISOString() ?? null,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function erpRecordToToolData(row: ErpToolRecord) {
  const lastDateTime = row.lastDateTime ? new Date(row.lastDateTime) : null;
  return {
    toolName: row.toolName,
    toolNo: row.toolNo,
    spec: row.spec,
    smStatus: row.smStatus,
    smStatusNm: row.smStatusNm,
    umToolKind: row.umToolKind,
    umToolKindName: row.umToolKindName,
    assetSeq: row.assetSeq,
    asstName: row.asstName,
    asstNo: row.asstNo,
    deptSeq: row.deptSeq,
    deptName: row.deptName,
    empSeq: row.empSeq,
    empName: row.empName,
    empid: row.empid,
    lastUserName: row.lastUserName,
    lastDateTime: lastDateTime && !Number.isNaN(lastDateTime.getTime()) ? lastDateTime : null,
  };
}

@Injectable()
export class ToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpTools: ErpToolsService,
  ) {}

  async list(q?: string, activeOnly = true): Promise<ToolRow[]> {
    const where: Prisma.ToolWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { toolName: { contains: term, mode: 'insensitive' } },
        { toolNo: { contains: term, mode: 'insensitive' } },
        { asstName: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.tool.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { toolSeq: 'asc' }],
    });
    return rows.map(toRow);
  }

  async getById(id: string): Promise<ToolRow> {
    const row = await this.prisma.tool.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('설비정보를 찾을 수 없습니다.');
    }
    return toRow(row);
  }

  async create(dto: CreateToolDto, username?: string): Promise<ToolRow> {
    const now = new Date();
    try {
      const row = await this.prisma.tool.create({
        data: {
          toolSeq: dto.toolSeq,
          toolName: dto.toolName.trim(),
          toolNo: dto.toolNo.trim(),
          spec: dto.spec?.trim() || null,
          smStatus: dto.smStatus ?? null,
          smStatusNm: dto.smStatusNm?.trim() || null,
          umToolKind: dto.umToolKind ?? null,
          umToolKindName: dto.umToolKindName?.trim() || null,
          assetSeq: dto.assetSeq ?? null,
          asstName: dto.asstName?.trim() || null,
          asstNo: dto.asstNo?.trim() || null,
          deptSeq: dto.deptSeq ?? null,
          deptName: dto.deptName?.trim() || null,
          empSeq: dto.empSeq ?? null,
          empName: dto.empName?.trim() || null,
          empid: username ?? null,
          lastUserName: username ?? null,
          lastDateTime: now,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
      return toRow(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 사용 중인 설비코드(toolSeq)입니다.');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateToolDto, username?: string): Promise<ToolRow> {
    const now = new Date();
    try {
      const row = await this.prisma.tool.update({
        where: { id },
        data: {
          ...(dto.toolName !== undefined && { toolName: dto.toolName.trim() }),
          ...(dto.toolNo !== undefined && { toolNo: dto.toolNo.trim() }),
          ...(dto.spec !== undefined && { spec: dto.spec?.trim() || null }),
          ...(dto.smStatus !== undefined && { smStatus: dto.smStatus }),
          ...(dto.smStatusNm !== undefined && { smStatusNm: dto.smStatusNm?.trim() || null }),
          ...(dto.umToolKind !== undefined && { umToolKind: dto.umToolKind }),
          ...(dto.umToolKindName !== undefined && {
            umToolKindName: dto.umToolKindName?.trim() || null,
          }),
          ...(dto.assetSeq !== undefined && { assetSeq: dto.assetSeq }),
          ...(dto.asstName !== undefined && { asstName: dto.asstName?.trim() || null }),
          ...(dto.asstNo !== undefined && { asstNo: dto.asstNo?.trim() || null }),
          ...(dto.deptSeq !== undefined && { deptSeq: dto.deptSeq }),
          ...(dto.deptName !== undefined && { deptName: dto.deptName?.trim() || null }),
          ...(dto.empSeq !== undefined && { empSeq: dto.empSeq }),
          ...(dto.empName !== undefined && { empName: dto.empName?.trim() || null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          empid: username ?? null,
          lastUserName: username ?? null,
          lastDateTime: now,
        },
      });
      return toRow(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('설비정보를 찾을 수 없습니다.');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.tool.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('설비정보를 찾을 수 없습니다.');
      }
      throw e;
    }
  }

  async removeAll(): Promise<{ deleted: number }> {
    const result = await this.prisma.tool.deleteMany({});
    return { deleted: result.count };
  }

  async listSyncPreview(q?: string): Promise<ErpToolRow[]> {
    const erpRows = await this.erpTools.listTools(q);
    const existing = await this.prisma.tool.findMany({
      select: { toolSeq: true },
    });
    const existingSet = new Set(existing.map((r) => r.toolSeq));

    return erpRows.map((row) => ({
      ...row,
      status: existingSet.has(row.toolSeq) ? ('update' as const) : ('new' as const),
    }));
  }

  async syncFromErp(toolSeqs?: number[]): Promise<ToolsSyncResult> {
    const erpRows = await this.erpTools.listTools();
    if (toolSeqs && toolSeqs.length > 0) {
      const wanted = new Set(toolSeqs);
      const filtered = erpRows.filter((r) => wanted.has(r.toolSeq));
      return this.bulkUpsert(filtered);
    }
    return this.bulkUpsert(erpRows);
  }

  async bulkUpsert(rows: ErpToolRecord[]): Promise<ToolsSyncResult> {
    const existing = await this.prisma.tool.findMany({
      select: { toolSeq: true },
    });
    const existingSet = new Set(existing.map((r) => r.toolSeq));

    let inserted = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const data = erpRecordToToolData(row);
        const isUpdate = existingSet.has(row.toolSeq);
        await tx.tool.upsert({
          where: { toolSeq: row.toolSeq },
          create: {
            toolSeq: row.toolSeq,
            ...data,
            isActive: true,
            sortOrder: 0,
          },
          update: data,
        });
        if (isUpdate) {
          updated += 1;
        } else {
          inserted += 1;
          existingSet.add(row.toolSeq);
        }
      }
    });

    return {
      total: rows.length,
      inserted,
      updated,
    };
  }
}
