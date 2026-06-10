import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, Max, Min } from 'class-validator';

export class PdsfcWorkReportQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10_000)
  limit?: number;

  /** true이면 응답에 사용한 테이블명·실적일자 컬럼명 등 `schemaMeta` 포함 */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  schemaMeta?: boolean;
}
