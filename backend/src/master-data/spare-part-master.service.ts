import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SparePartMasterRow, ToolSummary } from '@samkwang/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSparePartMasterDto,
  UpdateSparePartMasterDto,
} from './dto/spare-part-master.dto';

function decStr(v: Prisma.Decimal): string {
  return v.toString();
}

function toToolSummary(tool: {
  id: string;
  toolSeq: number;
  toolName: string;
  toolNo: string;
} | null): ToolSummary | null {
  if (!tool) {
    return null;
  }
  return {
    id: tool.id,
    toolSeq: tool.toolSeq,
    toolName: tool.toolName,
    toolNo: tool.toolNo,
  };
}

function toRow(record: {
  id: string;
  partCode: string;
  machineBrand: string;
  toolId: string | null;
  tool: { id: string; toolSeq: number; toolName: string; toolNo: string } | null;
  productName: string;
  spec: string | null;
  unit: string;
  optimalQty: Prisma.Decimal;
  manufacturer: string | null;
  storageLocation: string | null;
  leadTimeDays: number | null;
  remarks: string | null;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SparePartMasterRow {
  return {
    id: record.id,
    partCode: record.partCode,
    machineBrand: record.machineBrand,
    toolId: record.toolId,
    tool: toToolSummary(record.tool),
    productName: record.productName,
    spec: record.spec,
    unit: record.unit,
    optimalQty: decStr(record.optimalQty),
    manufacturer: record.manufacturer,
    storageLocation: record.storageLocation,
    leadTimeDays: record.leadTimeDays,
    remarks: record.remarks,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const toolInclude = {
  tool: {
    select: { id: true, toolSeq: true, toolName: true, toolNo: true },
  },
} as const;

@Injectable()
export class SparePartMasterService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveMachineBrand(
    toolId: string | null | undefined,
    machineBrand?: string,
  ): Promise<{ toolId: string | null; machineBrand: string }> {
    if (toolId) {
      const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
      if (!tool) {
        throw new BadRequestException('설비정보를 찾을 수 없습니다.');
      }
      if (!tool.isActive) {
        throw new BadRequestException('비활성화된 설비정보는 사용할 수 없습니다.');
      }
      return { toolId: tool.id, machineBrand: tool.toolName };
    }
    return { toolId: null, machineBrand: machineBrand?.trim() ?? '' };
  }

  async list(q?: string, activeOnly = true): Promise<SparePartMasterRow[]> {
    const where: Prisma.SparePartMasterWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { partCode: { contains: term, mode: 'insensitive' } },
        { machineBrand: { contains: term, mode: 'insensitive' } },
        { productName: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.sparePartMaster.findMany({
      where,
      include: toolInclude,
      orderBy: [{ sortOrder: 'asc' }, { partCode: 'asc' }],
    });
    return rows.map(toRow);
  }

  async getById(id: string): Promise<SparePartMasterRow> {
    const row = await this.prisma.sparePartMaster.findUnique({
      where: { id },
      include: toolInclude,
    });
    if (!row) {
      throw new NotFoundException('기초정보를 찾을 수 없습니다.');
    }
    return toRow(row);
  }

  async create(dto: CreateSparePartMasterDto, username?: string): Promise<SparePartMasterRow> {
    const partCode = dto.partCode.trim().toUpperCase();
    const { toolId, machineBrand } = await this.resolveMachineBrand(dto.toolId, dto.machineBrand);
    try {
      const row = await this.prisma.sparePartMaster.create({
        data: {
          partCode,
          machineBrand,
          toolId,
          productName: dto.productName.trim(),
          spec: dto.spec?.trim() || null,
          unit: dto.unit?.trim() || 'EA',
          optimalQty: new Prisma.Decimal(dto.optimalQty ?? 0),
          manufacturer: dto.manufacturer?.trim() || null,
          storageLocation: dto.storageLocation?.trim() || null,
          leadTimeDays: dto.leadTimeDays ?? null,
          remarks: dto.remarks?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          createdBy: username ?? null,
          updatedBy: username ?? null,
        },
        include: toolInclude,
      });
      return toRow(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 사용 중인 부품코드입니다.');
      }
      throw e;
    }
  }

  async update(
    id: string,
    dto: UpdateSparePartMasterDto,
    username?: string,
  ): Promise<SparePartMasterRow> {
    let toolIdUpdate: string | null | undefined;
    let machineBrandUpdate: string | undefined;

    if (dto.toolId !== undefined) {
      const resolved = await this.resolveMachineBrand(dto.toolId, dto.machineBrand);
      toolIdUpdate = resolved.toolId;
      machineBrandUpdate = resolved.machineBrand;
    } else if (dto.machineBrand !== undefined) {
      machineBrandUpdate = dto.machineBrand.trim();
    }

    try {
      const row = await this.prisma.sparePartMaster.update({
        where: { id },
        data: {
          ...(toolIdUpdate !== undefined && { toolId: toolIdUpdate }),
          ...(machineBrandUpdate !== undefined && { machineBrand: machineBrandUpdate }),
          ...(dto.productName !== undefined && { productName: dto.productName.trim() }),
          ...(dto.spec !== undefined && { spec: dto.spec?.trim() || null }),
          ...(dto.unit !== undefined && { unit: dto.unit.trim() }),
          ...(dto.optimalQty !== undefined && {
            optimalQty: new Prisma.Decimal(dto.optimalQty),
          }),
          ...(dto.manufacturer !== undefined && {
            manufacturer: dto.manufacturer?.trim() || null,
          }),
          ...(dto.storageLocation !== undefined && {
            storageLocation: dto.storageLocation?.trim() || null,
          }),
          ...(dto.leadTimeDays !== undefined && { leadTimeDays: dto.leadTimeDays }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks?.trim() || null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          updatedBy: username ?? null,
        },
        include: toolInclude,
      });
      return toRow(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('기초정보를 찾을 수 없습니다.');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.sparePartMaster.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('기초정보를 찾을 수 없습니다.');
      }
      throw e;
    }
  }
}
