import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateMoldCodeGroupDto,
  CreateMoldCodeItemDto,
  UpdateMoldCodeGroupDto,
  UpdateMoldCodeItemDto,
} from './dto/mold-code.dto';

export type MoldCodeGroupRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MoldCodeItemRow = {
  id: string;
  groupId: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function mapGroup(g: {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): MoldCodeGroupRow {
  return {
    id: g.id,
    code: g.code,
    name: g.name,
    category: g.category,
    description: g.description,
    sortOrder: g.sortOrder,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

function mapItem(i: {
  id: string;
  groupId: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): MoldCodeItemRow {
  return {
    id: i.id,
    groupId: i.groupId,
    code: i.code,
    name: i.name,
    category: i.category,
    description: i.description,
    sortOrder: i.sortOrder,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function isPrismaSchemaMismatch(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === 'P2021' || e.code === 'P2022')
  );
}

const MIGRATION_HINT =
  '데이터베이스 마이그레이션이 필요합니다. 서버에서 prisma migrate deploy 실행 후 다시 시도해 주세요.';

@Injectable()
export class MoldCodesService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowIfSchemaMismatch(e: unknown): void {
    if (isPrismaSchemaMismatch(e)) {
      throw new ServiceUnavailableException(MIGRATION_HINT);
    }
  }

  async listGroups(): Promise<MoldCodeGroupRow[]> {
    try {
      const rows = await this.prisma.moldCodeGroup.findMany({
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });
      return rows.map(mapGroup);
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
  }

  async createGroup(dto: CreateMoldCodeGroupDto): Promise<MoldCodeGroupRow> {
    const code = dto.code.trim();
    const name = dto.name.trim();
    try {
      const g = await this.prisma.moldCodeGroup.create({
        data: {
          code,
          name,
          category: (dto.category ?? '').trim(),
          description: (dto.description ?? '').trim(),
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return mapGroup(g);
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      if (isPrismaUniqueViolation(e)) {
        throw new ConflictException('동일한 코드가 이미 있습니다.');
      }
      throw e;
    }
  }

  async updateGroup(id: string, dto: UpdateMoldCodeGroupDto): Promise<MoldCodeGroupRow> {
    let existing: { id: string } | null;
    try {
      existing = await this.prisma.moldCodeGroup.findUnique({ where: { id } });
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
    if (!existing) {
      throw new NotFoundException('상위 코드를 찾을 수 없습니다.');
    }
    const data: Prisma.MoldCodeGroupUpdateInput = {};
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      data.category = dto.category.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    try {
      const g = await this.prisma.moldCodeGroup.update({
        where: { id },
        data,
      });
      return mapGroup(g);
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      if (isPrismaUniqueViolation(e)) {
        throw new ConflictException('동일한 코드가 이미 있습니다.');
      }
      throw e;
    }
  }

  async removeGroup(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.moldCodeGroup.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('상위 코드를 찾을 수 없습니다.');
      }
      throw e;
    }
  }

  private async ensureGroup(id: string) {
    try {
      const g = await this.prisma.moldCodeGroup.findUnique({ where: { id } });
      if (!g) {
        throw new NotFoundException('상위 코드를 찾을 수 없습니다.');
      }
      return g;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
  }

  async listItems(groupId: string): Promise<MoldCodeItemRow[]> {
    try {
      await this.ensureGroup(groupId);
      const rows = await this.prisma.moldCodeItem.findMany({
        where: { groupId },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });
      return rows.map(mapItem);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
  }

  /** 기준정보 상위 그룹의 `code` 또는 `name`이 parentKey와 일치할 때 그 하위 코드 목록 */
  async listItemsByParentGroupCode(parentGroupCode: string | undefined | null): Promise<MoldCodeItemRow[]> {
    const key = typeof parentGroupCode === 'string' ? parentGroupCode.trim() : '';
    if (!key) {
      return [];
    }
    try {
      const group = await this.prisma.moldCodeGroup.findFirst({
        where: {
          OR: [{ code: key }, { name: key }],
        },
      });
      if (!group) {
        return [];
      }
      const rows = await this.prisma.moldCodeItem.findMany({
        where: { groupId: group.id },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      });
      return rows.map(mapItem);
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
  }

  async createItem(groupId: string, dto: CreateMoldCodeItemDto): Promise<MoldCodeItemRow> {
    await this.ensureGroup(groupId);
    const code = dto.code.trim();
    const name = dto.name.trim();
    try {
      const row = await this.prisma.moldCodeItem.create({
        data: {
          groupId,
          code,
          name,
          category: (dto.category ?? '').trim(),
          description: (dto.description ?? '').trim(),
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return mapItem(row);
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      if (isPrismaUniqueViolation(e)) {
        throw new ConflictException('이 상위 코드 안에 동일한 하위 코드가 이미 있습니다.');
      }
      throw e;
    }
  }

  async updateItem(
    groupId: string,
    itemId: string,
    dto: UpdateMoldCodeItemDto,
  ): Promise<MoldCodeItemRow> {
    let row: { id: string } | null;
    try {
      row = await this.prisma.moldCodeItem.findFirst({
        where: { id: itemId, groupId },
      });
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
    if (!row) {
      throw new NotFoundException('하위 코드를 찾을 수 없습니다.');
    }
    const data: Prisma.MoldCodeItemUpdateInput = {};
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      data.category = dto.category.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    try {
      const updated = await this.prisma.moldCodeItem.update({
        where: { id: itemId },
        data,
      });
      return mapItem(updated);
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      if (isPrismaUniqueViolation(e)) {
        throw new ConflictException('이 상위 코드 안에 동일한 하위 코드가 이미 있습니다.');
      }
      throw e;
    }
  }

  async removeItem(groupId: string, itemId: string): Promise<{ ok: true }> {
    let row: { id: string } | null;
    try {
      row = await this.prisma.moldCodeItem.findFirst({
        where: { id: itemId, groupId },
      });
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
    if (!row) {
      throw new NotFoundException('하위 코드를 찾을 수 없습니다.');
    }
    try {
      await this.prisma.moldCodeItem.delete({ where: { id: itemId } });
      return { ok: true };
    } catch (e) {
      this.rethrowIfSchemaMismatch(e);
      throw e;
    }
  }
}
