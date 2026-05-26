import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

function emptyToUndefined(v: unknown): unknown {
  return v === '' || v === undefined || v === null ? undefined : v;
}

export class ListMoldInspectionItemsQueryDto {
  /** 생략·빈 값이면 전체 설비구분(하위코드 기준) */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  categoryItemId?: string;

  /** 생략·빈 값이면 전체 설비유형 */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  typeItemId?: string;
}

export class CreateMoldInspectionItemDto {
  @IsString()
  @IsNotEmpty()
  categoryItemId!: string;

  @IsOptional()
  @IsString()
  typeItemId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspectionCategory?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  detail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  criteria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cycle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  remarks?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateMoldInspectionItemDto {
  @IsOptional()
  @IsString()
  categoryItemId?: string;

  @IsOptional()
  @IsString()
  typeItemId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspectionCategory?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  itemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  detail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  criteria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cycle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  remarks?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
