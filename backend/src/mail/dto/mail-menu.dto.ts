import { Transform, Type } from 'class-transformer';
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

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  menuQuery?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  recipientEmails?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(127)
  sendDaysMask?: number;

  /** "HH:mm" 문자열 배열 (서비스에서 형식 검증·정규화) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(48)
  @IsString({ each: true })
  sendTimes?: string[];

  /** 메뉴 자동 발송 시 사용할 SMTP 프로필(비우면 규칙 프로필 사용) */
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? undefined : String(value)))
  @IsString()
  mailSmtpProfileId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  scheduleAutoSendEnabled?: boolean;
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

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  menuQuery?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  recipientEmails?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(127)
  sendDaysMask?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(48)
  @IsString({ each: true })
  sendTimes?: string[];

  @IsOptional()
  @Transform(({ value }) => (value === null ? '' : value === undefined ? undefined : String(value)))
  @IsString()
  mailSmtpProfileId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  scheduleAutoSendEnabled?: boolean;
}

/** 메뉴 기본 제목·본문으로 즉시 발송 (규칙 없음) */
export class MailMenuSendNowDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  toAddresses!: string[];

  @IsOptional()
  @Transform(({ value }) => (value === null ? '' : value === undefined ? undefined : String(value)))
  @IsString()
  mailSmtpProfileId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(127)
  sendDaysMask?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(48)
  @IsString({ each: true })
  sendTimes?: string[];
}
