/**
 * 창고별 재고조회 — 엑셀 동일 42열 의미(고정 10 + 합계 수량·금액 + 창고×2).
 * API 응답·프론트 표는 `WhStockListExcelDataRow`·`warehouseHeaders` 사용.
 * 엑셀 기준 검증: `창고별 재고조회_20260609.xlsx` → `scripts/read-wh-stock-xlsx.py` 출력·`data/wh-stock-excel-reference.json`.
 */

export const WH_STOCK_LIST_EXCEL_TITLE = '창고별 재고조회' as const;

export const WH_STOCK_LIST_EXCEL_FIXED_COL_HEADERS = [
  '품목자산분류',
  '품목대분류',
  '품목중분류',
  '품목소분류',
  '중요도',
  '품명',
  '품번',
  '규격',
  '단위',
  '품목상태',
] as const;

/** 엑셀 샘플 기준 15창고 순서(A안). `ERP_WH_STOCK_LIST_EXCEL_WH_HEADERS`로 덮어쓸 수 있음. */
export const WH_STOCK_LIST_DEFAULT_WAREHOUSE_HEADERS: readonly string[] = [
  '개발창고',
  '경유창고',
  '부자재창고',
  '사출창고',
  '사출창고(불)',
  '세인테크',
  '원자재창고',
  '제품창고',
  '조립창고',
  '조립창고(불)',
  '청야텍(삼광)',
  '태령기업',
  '품_시료창고(불)',
  'MCT창고',
  'MCT창고(불)',
] as const;

export type WhStockListExcelWarehouseCell = { qty: number | null; amt: number | null };

export type WhStockListExcelDataRow = {
  rowKind: 'TOTAL' | 'ITEM';
  assetClass: string | null;
  classL: string | null;
  classM: string | null;
  classS: string | null;
  importance: string | null;
  itemName: string | null;
  itemNo: string | null;
  spec: string | null;
  unit: string | null;
  itemStatus: string | null;
  totalQty: number | null;
  totalAmt: number | null;
  warehouses: WhStockListExcelWarehouseCell[];
};

/** `Sp_Inventory_NQL` A recordset 기준 — 창고 가로열 메타(C.ColIDX 조인용). */
export type WhStockWarehouseColumnInfo = {
  /** 화면·엑셀 헤더 (A.Title, 창고명칭) */
  displayName: string;
  /** A.TitleSeq — 수평 나열 순서(재고수량 열 기준) */
  titleSeq: number | null;
  titleSeq2: number | null;
  /** 이 창고에 대응하는 A.ColIDX 목록(창고 열 ID). C.RowIDX·C.ColIDX 조인에 사용 */
  colIndexes: number[];
};

export type WhStockListExcelListResponse = {
  asOf: string;
  truncated: boolean;
  warehouseHeaders: string[];
  /** NQL A 메타가 있을 때만 — ColIDX·TitleSeq 기반 창고 열 설명 */
  warehouseColumns?: WhStockWarehouseColumnInfo[];
  summary: WhStockListExcelDataRow | null;
  items: WhStockListExcelDataRow[];
};
