import { Type } from 'class-transformer';
import { IsDateString, IsOptional, Max, Min } from 'class-validator';

/** 창고별수불집계 — 조회기간 필수. API는 `YYYY-MM-DD`, SP에는 `YYYYMMDD`로 변환되어 `@BegDate`·`@EndDate` 등으로 전달됩니다. */
export class WhStockSumQueryDto {
  /** 조회시작일(ISO `YYYY-MM-DD`). `dateFr`가 있으면 그쪽이 우선. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** 조회종료일(ISO `YYYY-MM-DD`). `dateTo`가 있으면 그쪽이 우선. */
  @IsOptional()
  @IsDateString()
  to?: string;

  /** ERP `#BIZ_IN_DataBlock1.DateFr`와 동일 의미(조회시작일, ISO `YYYY-MM-DD`). */
  @IsOptional()
  @IsDateString()
  dateFr?: string;

  /** ERP `#BIZ_IN_DataBlock1.DateTo`와 동일 의미(조회종료일, ISO `YYYY-MM-DD`). */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10_000)
  limit?: number;

  /** 사업장(`#BIZ_IN_DataBlock1.BizUnit`). 미지정 시 `ERP_WH_STOCK_SUM_BIZ_UNIT`(기본 1). */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(999999)
  bizUnit?: number;
}
