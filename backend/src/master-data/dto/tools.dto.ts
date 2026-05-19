import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ToolsSyncQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

export class ToolsSyncBodyDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10000)
  @Type(() => Number)
  @IsInt({ each: true })
  toolSeqs?: number[];
}

export class ToolListQueryDto {
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

export class CreateToolDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toolSeq!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  toolName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  toolNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  spec?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  smStatus?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  smStatusNm?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  umToolKind?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  umToolKindName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetSeq?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  asstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  asstNo?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deptSeq?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deptName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  empSeq?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empName?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  toolName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  toolNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  spec?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  smStatus?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  smStatusNm?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  umToolKind?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  umToolKindName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetSeq?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  asstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  asstNo?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deptSeq?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deptName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  empSeq?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empName?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
