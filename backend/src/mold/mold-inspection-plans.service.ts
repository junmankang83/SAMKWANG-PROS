import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION, moldParentGroupMatchesKey } from '@samkwang/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function prismaSchemaMismatchMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2021') {
      return (
        '데이터베이스에 MoldInspectionPlan(점검계획) 테이블이 없습니다. ' +
        '백엔드 루트에서 `pnpm exec prisma migrate deploy`를 실행한 뒤 API 서버를 재시작해 주세요.'
      );
    }
    if (e.code === 'P2022') {
      return (
        'MoldInspectionPlan 테이블과 앱 스키마가 맞지 않습니다(컬럼 누락 등). ' +
        '특히 `recordMetaJson` 컬럼이 없으면 이 메시지가 납니다. ' +
        '`pnpm exec prisma migrate deploy`로 최신 마이그레이션을 적용한 뒤 서버를 재시작해 주세요.'
      );
    }
  }
  return (
    '점검계획 DB 스키마를 확인할 수 없습니다. `pnpm exec prisma migrate deploy` 적용 후 다시 시도해 주세요.'
  );
}

function isPrismaSchemaMismatch(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === 'P2021' || e.code === 'P2022')
  );
}

export type MoldInspectionPlanRow = {
  id: string;
  categoryItemId: string;
  year: number;
  planJson: Prisma.JsonValue;
  actualJson: Prisma.JsonValue;
  recordMetaJson: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

function mapPlan(p: {
  id: string;
  categoryItemId: string;
  year: number;
  planJson: Prisma.JsonValue;
  actualJson: Prisma.JsonValue;
  recordMetaJson?: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): MoldInspectionPlanRow {
  return {
    id: p.id,
    categoryItemId: p.categoryItemId,
    year: p.year,
    planJson: p.planJson,
    actualJson: p.actualJson,
    recordMetaJson: p.recordMetaJson ?? {},
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function normalizeMonthWeekMap(
  raw: unknown,
  validItemIds: Set<string>,
): Prisma.InputJsonValue {
  const out: Record<string, Record<string, number>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return out;
  }
  for (const [itemId, monthObj] of Object.entries(raw as Record<string, unknown>)) {
    if (!validItemIds.has(itemId)) {
      continue;
    }
    if (!monthObj || typeof monthObj !== 'object' || Array.isArray(monthObj)) {
      continue;
    }
    const monthMap: Record<string, number> = {};
    for (const [monthKey, weekVal] of Object.entries(monthObj as Record<string, unknown>)) {
      const m = parseInt(monthKey, 10);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        continue;
      }
      if (weekVal == null || weekVal === '') {
        continue;
      }
      const w = typeof weekVal === 'number' ? weekVal : parseInt(String(weekVal), 10);
      if (!Number.isFinite(w) || w < 1 || w > 5) {
        continue;
      }
      monthMap[String(m)] = w;
    }
    if (Object.keys(monthMap).length > 0) {
      out[itemId] = monthMap;
    }
  }
  return out as Prisma.InputJsonValue;
}

const RECORD_META_MAX_REMARKS = 4000;
const RECORD_META_MAX_NOTES = 16000;

function normalizeRecordMeta(
  raw: unknown,
  validItemIds: Set<string>,
): Prisma.InputJsonValue {
  const out: Record<string, { remarks: string; inspectionNotes: string }> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return out as Prisma.InputJsonValue;
  }
  for (const [itemId, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!validItemIds.has(itemId)) {
      continue;
    }
    const o =
      val && typeof val === 'object' && !Array.isArray(val)
        ? (val as Record<string, unknown>)
        : {};
    const remarks =
      typeof o.remarks === 'string'
        ? o.remarks.trim().slice(0, RECORD_META_MAX_REMARKS)
        : '';
    const inspectionNotes =
      typeof o.inspectionNotes === 'string'
        ? o.inspectionNotes.trim().slice(0, RECORD_META_MAX_NOTES)
        : '';
    out[itemId] = { remarks, inspectionNotes };
  }
  return out as Prisma.InputJsonValue;
}

@Injectable()
export class MoldInspectionPlansService {
  private readonly log = new Logger(MoldInspectionPlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async ensureEquipmentCategoryItem(id: string) {
    const item = await this.prisma.moldCodeItem.findUnique({
      where: { id },
      include: { group: true },
    });
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

  async get(categoryItemId: string, year: number): Promise<MoldInspectionPlanRow | null> {
    await this.ensureEquipmentCategoryItem(categoryItemId);
    try {
      const row = await this.prisma.moldInspectionPlan.findUnique({
        where: {
          categoryItemId_year: { categoryItemId, year },
        },
      });
      return row ? mapPlan(row) : null;
    } catch (e) {
      if (isPrismaSchemaMismatch(e)) {
        this.log.warn(
          `MoldInspectionPlan 조회 생략(DB 스키마 불일치): ${e instanceof Error ? e.message : String(e)}`,
        );
        return null;
      }
      throw e;
    }
  }

  async upsert(
    categoryItemId: string,
    year: number,
    planJson: Record<string, unknown>,
    actualJson: Record<string, unknown> | undefined,
    recordMetaJson: Record<string, unknown> | undefined,
  ): Promise<MoldInspectionPlanRow> {
    await this.ensureEquipmentCategoryItem(categoryItemId);

    const items = await this.prisma.moldInspectionItem.findMany({
      where: { categoryItemId },
      select: { id: true },
    });
    const validIds = new Set(items.map((i) => i.id));

    const plan = normalizeMonthWeekMap(planJson, validIds);
    /** 계획만 저장하는 요청에서는 actualJson을 보내지 않음 → 기존 실적 유지(다른 화면에서 등록) */
    const normalizedActual =
      actualJson !== undefined ? normalizeMonthWeekMap(actualJson, validIds) : undefined;
    /** 실적 화면 전용 메타(비고·점검내용) — 생략 시 기존 값 유지 */
    const normalizedRecordMeta =
      recordMetaJson !== undefined ? normalizeRecordMeta(recordMetaJson, validIds) : undefined;

    try {
      const row = await this.prisma.moldInspectionPlan.upsert({
        where: {
          categoryItemId_year: { categoryItemId, year },
        },
        create: {
          categoryItemId,
          year,
          planJson: plan,
          actualJson: normalizedActual ?? {},
          recordMetaJson: (normalizedRecordMeta ?? {}) as Prisma.InputJsonValue,
        },
        update: {
          planJson: plan,
          ...(normalizedActual !== undefined ? { actualJson: normalizedActual } : {}),
          ...(normalizedRecordMeta !== undefined
            ? { recordMetaJson: normalizedRecordMeta as Prisma.InputJsonValue }
            : {}),
        },
      });
      return mapPlan(row);
    } catch (e) {
      if (isPrismaSchemaMismatch(e)) {
        throw new ServiceUnavailableException(prismaSchemaMismatchMessage(e));
      }
      throw e;
    }
  }
}
