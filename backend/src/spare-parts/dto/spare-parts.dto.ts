import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateSparePartItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  masterId?: string;

  @ValidateIf((o: CreateSparePartItemDto) => !o.masterId)
  @IsString()
  @IsNotEmpty()
  machineBrand?: string;

  @ValidateIf((o: CreateSparePartItemDto) => !o.masterId)
  @IsString()
  @IsNotEmpty()
  productName?: string;

  @IsOptional()
  @IsString()
  spec?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  optimalQty?: number;

  @IsOptional()
  @IsString()
  remarks?: string | null;
}

export class UpdateSparePartItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  machineBrand?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productName?: string;

  @IsOptional()
  @IsString()
  spec?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  optimalQty?: number;

  @IsOptional()
  @IsString()
  remarks?: string | null;
}

export class LedgerEntryBodyDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qty!: number;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  toolId?: string | null;
}

export class SparePartItemsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}

/** 입·출고 내역 목록 조회 (기간 또는 월) */
export class LedgerEntriesQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inboundStart?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inboundEnd?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inboundStart?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inboundEnd?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOfDate?: string;
}

export class LedgerPeriodQueryDto {
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;
}

export class UpsertLedgerPeriodBodyDto {
  @Matches(/^\d{4}-\d{2}$/)
  periodMonth!: string;

  @IsOptional()
  @IsString()
  preparedBy?: string | null;

  @IsOptional()
  @IsISO8601()
  preparedAt?: string | null;

  @IsOptional()
  @IsString()
  reviewedBy?: string | null;

  @IsOptional()
  @IsISO8601()
  reviewedAt?: string | null;

  @IsOptional()
  @IsString()
  confirmedBy?: string | null;

  @IsOptional()
  @IsISO8601()
  confirmedAt?: string | null;

  @IsOptional()
  @IsString()
  teamLeadBy?: string | null;

  @IsOptional()
  @IsISO8601()
  teamLeadAt?: string | null;
}
