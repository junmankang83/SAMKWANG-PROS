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

/** 입·출고 집계 기반 재고현황 행 */
export interface SparePartInventoryRow {
  id: string;
  masterId: string | null;
  partCode: string | null;
  productName: string;
  spec: string | null;
  unit: string | null;
  optimalQty: string;
  inboundQtyInMonth: string;
  outboundQtyInMonth: string;
  currentQty: string;
  lastInboundDateInMonth: string | null;
  remarks: string | null;
}

export interface SparePartItemCreateRequest {
  masterId?: string | null;
  machineBrand?: string;
  productName?: string;
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

/** 입·출고 개별 이력 행 */
export interface SparePartLedgerEntryRow {
  id: string;
  itemId: string;
  partCode: string | null;
  machineBrand: string;
  productName: string;
  spec: string | null;
  unit: string | null;
  qty: string;
  occurredAt: string;
  note: string | null;
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
