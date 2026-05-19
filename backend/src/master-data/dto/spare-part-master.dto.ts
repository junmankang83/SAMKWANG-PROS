import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const PART_CODE_PATTERN = /^[A-Z0-9-]+$/;

export class SparePartMasterListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false) {
      return false;
    }
    if (value === 'true' || value === true) {
      return true;
    }
    return undefined;
  })
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateSparePartMasterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(PART_CODE_PATTERN, { message: '부품코드는 영문 대문자, 숫자, 하이픈만 사용할 수 있습니다.' })
  partCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  machineBrand?: string;

  @IsOptional()
  @IsString()
  toolId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  optimalQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  storageLocation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number | null;

  @IsOptional()
  @IsString()
  remarks?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSparePartMasterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  machineBrand?: string;

  @IsOptional()
  @IsString()
  toolId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  optimalQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  storageLocation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number | null;

  @IsOptional()
  @IsString()
  remarks?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
