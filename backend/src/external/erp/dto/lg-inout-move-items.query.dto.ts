import { Type } from 'class-transformer';
import { IsDateString, IsOptional, Max, Min } from 'class-validator';

export class LgInoutMoveItemsQueryDto {
  /** 시작일 (YYYY-MM-DD) — 이동일 기준 */
  @IsDateString()
  from!: string;

  /** 종료일 (YYYY-MM-DD) */
  @IsDateString()
  to!: string;

  /** 최대 반환 행 (기본 8000, 상한 10000) */
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10_000)
  limit?: number;
}
