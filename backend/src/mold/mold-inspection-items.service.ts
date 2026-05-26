import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION,
  MOLD_PARENT_CODE_GROUP_EQUIPMENT_TYPE,
  moldParentGroupMatchesKey,
} from '@samkwang/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateMoldInspectionItemDto,
  UpdateMoldInspectionItemDto,
} from './dto/mold-inspection-items.dto';

export type MoldInspectionItemRow = {
  id: string;
  categoryItemId: string;
  typeItemId: string | null;
  inspectionCategory: string;
  itemCode: string;
  itemName: string;
  method: string;
  detail: string;
  criteria: string;
  cycle: string;
  remarks: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function mapRow(r: {
  id: string;
  categoryItemId: string;
  typeItemId: string | null;
  inspectionCategory: string;
  itemCode: string;
  itemName: string;
  method: string;
  detail: string;
  criteria: string;
  cycle: string;
  remarks: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): MoldInspectionItemRow {
  return {
    id: r.id,
    categoryItemId: r.categoryItemId,
    typeItemId: r.typeItemId,
    inspectionCategory: r.inspectionCategory,
    itemCode: r.itemCode,
    itemName: r.itemName,
    method: r.method,
    detail: r.detail,
    criteria: r.criteria,
    cycle: r.cycle,
    remarks: r.remarks,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function isPrismaValueTooLong(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2000';
}

function isPrismaForeignKeyViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';
}

/** PDF·엑셀 등 복사 시 섞일 수 있는 NUL 및 C0 제어문 제거(줄바꿈·탭은 유지) */
function sanitizeMoldText(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0) {
      continue;
    }
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
      continue;
    }
    out += s[i];
  }
  return out;
}

function mapUnhandledPrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    throw new BadRequestException(
      `DB 오류(${e.code}). 서버 마이그레이션 적용 여부와 입력 값을 확인해 주세요.`,
    );
  }
  throw e;
}

@Injectable()
export class MoldInspectionItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadItemWithGroup(id: string) {
    return this.prisma.moldCodeItem.findUnique({
      where: { id },
      include: { group: true },
    });
  }

  /** 기준정보 상위 코드 `설비구분` 그룹의 하위만 허용 */
  private async ensureCategoryDivisionItem(id: string) {
    const item = await this.loadItemWithGroup(id);
    if (!item) {
      throw new NotFoundException('설비구분 코드를 찾을 수 없습니다.');
    }
    if (!moldParentGroupMatchesKey(item.group, MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION)) {
      throw new BadRequestException(
        `설비구분은 기준정보에서 상위의 코드 또는 명이 「${MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION}」인 그룹의 하위만 선택할 수 있습니다.`,
      );
    }
    return item;
  }

  /** 기준정보 상위 코드 `설비유형` 그룹의 하위만 허용 */
  private async validateTypeItemOrNull(typeItemId: string | null | undefined) {
    if (typeItemId == null || typeItemId === '') {
      return null;
    }
    const item = await this.loadItemWithGroup(typeItemId);
    if (!item) {
      throw new BadRequestException('설비유형 코드를 찾을 수 없습니다.');
    }
    if (!moldParentGroupMatchesKey(item.group, MOLD_PARENT_CODE_GROUP_EQUIPMENT_TYPE)) {
      throw new BadRequestException(
        `설비유형은 기준정보에서 상위의 코드 또는 명이 「${MOLD_PARENT_CODE_GROUP_EQUIPMENT_TYPE}」인 그룹의 하위만 선택할 수 있습니다.`,
      );
    }
    return typeItemId;
  }

  async list(categoryItemId?: string, typeItemId?: string): Promise<MoldInspectionItemRow[]> {
    const hasCategory = Boolean(categoryItemId?.trim());
    const hasType = Boolean(typeItemId?.trim());

    if (hasCategory) {
      await this.ensureCategoryDivisionItem(categoryItemId!);
    }
    if (hasType) {
      await this.validateTypeItemOrNull(typeItemId!);
    }

    const where: Prisma.MoldInspectionItemWhereInput = {};
    if (hasCategory) {
      where.categoryItemId = categoryItemId!;
    }
    if (hasType) {
      where.typeItemId = typeItemId!;
    }

    const rows = await this.prisma.moldInspectionItem.findMany({
      where,
      orderBy: [{ categoryItemId: 'asc' }, { sortOrder: 'asc' }, { itemCode: 'asc' }],
    });
    return rows.map(mapRow);
  }

  async create(dto: CreateMoldInspectionItemDto): Promise<MoldInspectionItemRow> {
    await this.ensureCategoryDivisionItem(dto.categoryItemId);
    const typeId = await this.validateTypeItemOrNull(dto.typeItemId);
    try {
      const row = await this.prisma.moldInspectionItem.create({
        data: {
          categoryItemId: dto.categoryItemId,
          typeItemId: typeId,
          inspectionCategory: sanitizeMoldText((dto.inspectionCategory ?? '').trim()),
          itemCode: sanitizeMoldText(dto.itemCode.trim()),
          itemName: sanitizeMoldText(dto.itemName.trim()),
          method: sanitizeMoldText((dto.method ?? '').trim()),
          detail: sanitizeMoldText((dto.detail ?? '').trim()),
          criteria: sanitizeMoldText((dto.criteria ?? '').trim()),
          cycle: sanitizeMoldText((dto.cycle ?? '').trim()),
          remarks: sanitizeMoldText((dto.remarks ?? '').trim()),
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return mapRow(row);
    } catch (e) {
      if (isPrismaUniqueViolation(e)) {
        throw new ConflictException('같은 설비구분(하위)에 동일한 점검항목코드가 이미 있습니다.');
      }
      if (isPrismaValueTooLong(e)) {
        const meta =
          e instanceof Prisma.PrismaClientKnownRequestError && e.meta && typeof e.meta === 'object'
            ? (e.meta as Record<string, unknown>)
            : undefined;
        const col = meta?.column_name != null ? String(meta.column_name) : '';
        throw new BadRequestException(
          col
            ? `입력 길이가 초과되었습니다(컬럼: ${col}). 긴 절차 문장은 2번째 줄 「점검항목상세내역」에 넣어 주세요.`
            : '입력 길이가 초과되었습니다. 긴 절차 문장은 「점검항목상세내역」에, 짧은 항목명·코드는 윗줄에 맞춰 주세요.',
        );
      }
      if (isPrismaForeignKeyViolation(e)) {
        throw new BadRequestException(
          '설비구분 또는 설비유형 참조가 유효하지 않습니다. 필터를 다시 선택한 뒤 저장해 주세요.',
        );
      }
      mapUnhandledPrismaError(e);
    }
  }

  async update(id: string, dto: UpdateMoldInspectionItemDto): Promise<MoldInspectionItemRow> {
    const existing = await this.prisma.moldInspectionItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('점검항목을 찾을 수 없습니다.');
    }
    const data: Prisma.MoldInspectionItemUpdateInput = {};

    if (dto.categoryItemId !== undefined) {
      await this.ensureCategoryDivisionItem(dto.categoryItemId);
      data.categoryItem = { connect: { id: dto.categoryItemId } };
    }

    if (dto.typeItemId !== undefined) {
      const resolved = await this.validateTypeItemOrNull(dto.typeItemId);
      if (resolved) {
        data.typeItem = { connect: { id: resolved } };
      } else {
        data.typeItem = { disconnect: true };
      }
    }
    if (dto.inspectionCategory !== undefined) {
      data.inspectionCategory = sanitizeMoldText(dto.inspectionCategory.trim());
    }
    if (dto.itemCode !== undefined) {
      data.itemCode = sanitizeMoldText(dto.itemCode.trim());
    }
    if (dto.itemName !== undefined) {
      data.itemName = sanitizeMoldText(dto.itemName.trim());
    }
    if (dto.method !== undefined) {
      data.method = sanitizeMoldText(dto.method.trim());
    }
    if (dto.detail !== undefined) {
      data.detail = sanitizeMoldText(dto.detail.trim());
    }
    if (dto.criteria !== undefined) {
      data.criteria = sanitizeMoldText(dto.criteria.trim());
    }
    if (dto.cycle !== undefined) {
      data.cycle = sanitizeMoldText(dto.cycle.trim());
    }
    if (dto.remarks !== undefined) {
      data.remarks = sanitizeMoldText(dto.remarks.trim());
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    try {
      const row = await this.prisma.moldInspectionItem.update({
        where: { id },
        data,
      });
      return mapRow(row);
    } catch (e) {
      if (isPrismaUniqueViolation(e)) {
        throw new ConflictException('같은 설비구분(하위)에 동일한 점검항목코드가 이미 있습니다.');
      }
      if (isPrismaValueTooLong(e)) {
        const meta =
          e instanceof Prisma.PrismaClientKnownRequestError && e.meta && typeof e.meta === 'object'
            ? (e.meta as Record<string, unknown>)
            : undefined;
        const col = meta?.column_name != null ? String(meta.column_name) : '';
        throw new BadRequestException(
          col
            ? `입력 길이가 초과되었습니다(컬럼: ${col}). 긴 절차 문장은 2번째 줄 「점검항목상세내역」에 넣어 주세요.`
            : '입력 길이가 초과되었습니다. 긴 절차 문장은 「점검항목상세내역」에, 짧은 항목명·코드는 윗줄에 맞춰 주세요.',
        );
      }
      if (isPrismaForeignKeyViolation(e)) {
        throw new BadRequestException(
          '설비구분 또는 설비유형 참조가 유효하지 않습니다. 필터를 다시 선택한 뒤 저장해 주세요.',
        );
      }
      mapUnhandledPrismaError(e);
    }
  }

  async remove(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.moldInspectionItem.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('점검항목을 찾을 수 없습니다.');
      }
      mapUnhandledPrismaError(e);
    }
  }
}
