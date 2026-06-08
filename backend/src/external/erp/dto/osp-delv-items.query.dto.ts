import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, Max, Min } from 'class-validator';

export class OspDelvItemsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(10_000)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  schemaMeta?: boolean;
}
