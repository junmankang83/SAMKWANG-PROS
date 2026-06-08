import { Type } from 'class-transformer';
import { IsDateString, IsOptional, Max, Min } from 'class-validator';

export class TslSalesDailyAnalysisQueryDto {
  /** 시작일 (YYYY-MM-DD) — `업체일자`에 해당하는 컬럼(InvoiceItem 등) 구간 */
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10_000)
  limit?: number;
}
