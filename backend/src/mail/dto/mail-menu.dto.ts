import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateMailMenuDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultSubject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  defaultBody?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateMailMenuDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultSubject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  defaultBody?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
