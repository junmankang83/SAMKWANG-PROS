import { Type } from 'class-transformer';
import { IsDateString, IsOptional, Max, Min } from 'class-validator';

/** 창고별 재고조회 — ERP `#BIZ_*` 배치 + `_SWLGWHStockListQuery`(USER2). `limit`만 서버에서 적용. */
export class WhStockListQueryDto {
  /** 조회일(ISO `YYYY-MM-DD`). `date`와 동일 의미. */
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10_000)
  limit?: number;

  /** 사업단위(`#BIZ_IN_DataBlock1.BizUnit`). 생략 시 `ERP_WH_STOCK_LIST_BIZ_UNIT`·기본 1. */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(999999)
  bizUnit?: number;
}
