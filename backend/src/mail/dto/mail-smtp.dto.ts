import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class UpsertMailSmtpDto {
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

  /** 비워 두면 기존 비밀번호 유지 */
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
}

export class MailSmtpTestDto {
  @IsEmail()
  @MaxLength(255)
  to!: string;
}
