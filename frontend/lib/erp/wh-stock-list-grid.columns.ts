/**
 * 창고별 재고조회 — 엑셀 동일 42열 의미(고정 10 + 합계 수량·금액 + 창고×2).
 * 백엔드 `wh-stock-list-grid.columns.ts`와 동기.
 * 엑셀 기준: `backend/src/external/erp/data/wh-stock-excel-reference.json`.
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

/** `Sp_Inventory_NQL` A recordset 기준 — 창고 가로열 메타(C.ColIDX 조인용). 백엔드와 동기. */
export type WhStockWarehouseColumnInfo = {
  displayName: string;
  titleSeq: number | null;
  titleSeq2: number | null;
  colIndexes: number[];
};

export type WhStockListExcelListResponse = {
  asOf: string;
  truncated: boolean;
  warehouseHeaders: string[];
  warehouseColumns?: WhStockWarehouseColumnInfo[];
  summary: WhStockListExcelDataRow | null;
  items: WhStockListExcelDataRow[];
};
