import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMailSmtpProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(255)
  host!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsBoolean()
  secure!: boolean;

  @IsString()
  @MaxLength(255)
  user!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  password?: string;

  @IsString()
  @MaxLength(200)
  fromName!: string;

  @IsString()
  @IsEmail()
  @MaxLength(255)
  fromAddress!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateMailSmtpProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fromName?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  @MaxLength(255)
  fromAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class MailSmtpTestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  toAddresses!: string[];
}
