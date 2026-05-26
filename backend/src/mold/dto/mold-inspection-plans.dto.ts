import { Transform, Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

/** 쿼리스트링이 배열로 들어오는 경우(중복 키) 첫 값만 사용 */
function firstQueryValue({ value }: { value: unknown }): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export class ListMoldInspectionPlanQueryDto {
  @Transform(firstQueryValue)
  @IsString()
  categoryItemId!: string;

  @Transform(firstQueryValue)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

export class UpsertMoldInspectionPlanDto {
  @IsString()
  categoryItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsObject()
  planJson!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  actualJson?: Record<string, unknown>;

  /** 항목별 비고(remarks)·점검내용(inspectionNotes) — 생략 시 기존 recordMeta 유지 */
  @IsOptional()
  @IsObject()
  recordMetaJson?: Record<string, unknown>;
}
