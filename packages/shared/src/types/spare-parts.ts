/** YYYY-MM */
export type PeriodMonth = string;

export type SparePartLedgerEntryType = 'INBOUND' | 'OUTBOUND';

export interface SparePartItemRow {
  id: string;
  machineBrand: string;
  productName: string;
  spec: string | null;
  optimalQty: string;
  currentQty: string;
  remarks: string | null;
  /** 선택 월 내 마지막 입고일 (해당 월 입고 이력 없으면 null) */
  lastInboundDateInMonth: string | null;
  /** 선택 월 입고 수량 합계 */
  inboundQtyInMonth: string;
  /** 선택 월 출고 수량 합계 */
  outboundQtyInMonth: string;
}

export interface SparePartItemCreateRequest {
  machineBrand: string;
  productName: string;
  spec?: string | null;
  optimalQty?: number;
  remarks?: string | null;
}

export interface SparePartItemUpdateRequest {
  machineBrand?: string;
  productName?: string;
  spec?: string | null;
  optimalQty?: number;
  remarks?: string | null;
}

export interface SparePartLedgerPostRequest {
  qty: number;
  occurredAt: string;
  note?: string | null;
}

export interface SparePartLedgerPeriodResponse {
  periodMonth: PeriodMonth;
  preparedBy: string | null;
  preparedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  teamLeadBy: string | null;
  teamLeadAt: string | null;
}

export interface SparePartLedgerPeriodUpsertRequest {
  periodMonth: PeriodMonth;
  preparedBy?: string | null;
  preparedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  teamLeadBy?: string | null;
  teamLeadAt?: string | null;
}
