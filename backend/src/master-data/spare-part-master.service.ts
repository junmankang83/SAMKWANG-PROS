import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SparePartMasterRow } from '@samkwang/shared';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSparePartMasterDto,
  UpdateSparePartMasterDto,
} from './dto/spare-part-master.dto';

function decStr(v: Prisma.Decimal): string {
  return v.toString();
}

function toRow(record: {
  id: string;
  partCode: string;
  machineBrand: string;
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

@Injectable()
export class SparePartMasterService {
  constructor(private readonly prisma: PrismaService) {}

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
      orderBy: [{ sortOrder: 'asc' }, { partCode: 'asc' }],
    });
    return rows.map(toRow);
  }

  async getById(id: string): Promise<SparePartMasterRow> {
    const row = await this.prisma.sparePartMaster.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('기초정보를 찾을 수 없습니다.');
    }
    return toRow(row);
  }

  async create(dto: CreateSparePartMasterDto, username?: string): Promise<SparePartMasterRow> {
    const partCode = dto.partCode.trim().toUpperCase();
    try {
      const row = await this.prisma.sparePartMaster.create({
        data: {
          partCode,
          machineBrand: dto.machineBrand?.trim() ?? '',
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
    try {
      const row = await this.prisma.sparePartMaster.update({
        where: { id },
        data: {
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
