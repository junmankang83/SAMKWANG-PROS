import { MailScheduleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateMailSendRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsEnum(MailScheduleType)
  scheduleType!: MailScheduleType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cronExpression?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  dailyTime?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(127)
  dailyDaysMask?: number;

  @IsArray()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  toAddresses!: string[];

  @IsString()
  @MaxLength(500)
  subject!: string;

  @IsString()
  @MaxLength(100000)
  body!: string;

  @IsOptional()
  @IsString()
  mailMenuId?: string | null;

  @IsString()
  @MinLength(1)
  mailSmtpProfileId!: string;
}

export class UpdateMailSendRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(MailScheduleType)
  scheduleType?: MailScheduleType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cronExpression?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  dailyTime?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(127)
  dailyDaysMask?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  toAddresses?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  body?: string;

  @IsOptional()
  @IsString()
  mailMenuId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  mailSmtpProfileId?: string;
}

/** 즉시 발송 — 메뉴관리에서 선택한 메뉴 + 발송정보 규칙 + (선택) 추가 수신·요일·시각 */
export class ManualSendDto {
  @IsString()
  @MinLength(1)
  mailMenuId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsEmail({}, { each: true })
  additionalToAddresses?: string[];

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

  /** 비워 두면 규칙에 연결된 SMTP 프로필 사용 */
  @IsOptional()
  @IsString()
  mailSmtpProfileId?: string;
}
