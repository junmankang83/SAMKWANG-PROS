/**
 * 창고별수불집계조회 — 엑셀 `창고별수불집계조회_skkr_*.xlsx` 38열 + 순번.
 * 백엔드 `wh-stock-sum-grid.columns.ts`와 동기.
 */
export type WhStockSumGridKey =
  | 'assetGrpName'
  | 'classLName'
  | 'classMName'
  | 'classSName'
  | 'itemName'
  | 'itemNo'
  | 'spec'
  | 'unitName'
  | 'itemStatus'
  | 'whDivName'
  | 'whName'
  | 'whGroupName'
  | 'storageLoc'
  | 'whCode'
  | 'carryQty'
  | 'carryAmt'
  | 'inQty'
  | 'inAmt'
  | 'outQty'
  | 'outAmt'
  | 'stkQty'
  | 'stkAmt'
  | 'safetyQty'
  | 'safetyAmt'
  | 'stdPrice'
  | 'settlePrice'
  | 'inMove'
  | 'inSubst'
  | 'inProd'
  | 'inOutsrc'
  | 'inPurchase'
  | 'inImport'
  | 'outTrx'
  | 'outExportInv'
  | 'outEtc'
  | 'outMove'
  | 'outSubst'
  | 'outWork';

export type WhStockSumColDef = {
  key: WhStockSumGridKey;
  header: string;
  numeric: boolean;
  groupHeader?: string;
};

export const WH_STOCK_SUM_GRID_COLUMNS: readonly WhStockSumColDef[] = [
  { key: 'assetGrpName', header: '품목자산분류', numeric: false },
  { key: 'classLName', header: '품목대분류', numeric: false },
  { key: 'classMName', header: '품목중분류', numeric: false },
  { key: 'classSName', header: '품목소분류', numeric: false },
  { key: 'itemName', header: '품명', numeric: false },
  { key: 'itemNo', header: '품번', numeric: false },
  { key: 'spec', header: '규격', numeric: false },
  { key: 'unitName', header: '단위', numeric: false },
  { key: 'itemStatus', header: '품목상태', numeric: false },
  { key: 'whDivName', header: '창고구분', numeric: false },
  { key: 'whName', header: '창고', numeric: false },
  { key: 'whGroupName', header: '창고그룹', numeric: false },
  { key: 'storageLoc', header: '보관위치', numeric: false },
  { key: 'whCode', header: '창고코드', numeric: false },
  { key: 'carryQty', header: '이월수량', numeric: true },
  { key: 'carryAmt', header: '이월금액', numeric: true },
  { key: 'inQty', header: '입고수량', numeric: true },
  { key: 'inAmt', header: '입고금액', numeric: true },
  { key: 'outQty', header: '출고수량', numeric: true },
  { key: 'outAmt', header: '출고금액', numeric: true },
  { key: 'stkQty', header: '재고수량', numeric: true },
  { key: 'stkAmt', header: '재고금액', numeric: true },
  { key: 'safetyQty', header: '안전재고수량', numeric: true },
  { key: 'safetyAmt', header: '안전재고금액', numeric: true },
  { key: 'stdPrice', header: '표준단가', numeric: true },
  { key: 'settlePrice', header: '결산단가', numeric: true },
  { key: 'inMove', header: '이동처리', numeric: true, groupHeader: '입고' },
  { key: 'inSubst', header: '품목대체', numeric: true, groupHeader: '입고' },
  { key: 'inProd', header: '생산입고', numeric: true, groupHeader: '입고' },
  { key: 'inOutsrc', header: '외주입고', numeric: true, groupHeader: '입고' },
  { key: 'inPurchase', header: '구매입고', numeric: true, groupHeader: '입고' },
  { key: 'inImport', header: '수입입고', numeric: true, groupHeader: '입고' },
  { key: 'outTrx', header: '거래명세표', numeric: true, groupHeader: '출고' },
  { key: 'outExportInv', header: '수출Invoice', numeric: true, groupHeader: '출고' },
  { key: 'outEtc', header: '기타출고', numeric: true, groupHeader: '출고' },
  { key: 'outMove', header: '이동처리', numeric: true, groupHeader: '출고' },
  { key: 'outSubst', header: '품목대체', numeric: true, groupHeader: '출고' },
  { key: 'outWork', header: '작업실적', numeric: true, groupHeader: '출고' },
] as const;

export type WhStockSumGridRow = {
  rowNo: number;
  isTotal?: boolean;
} & Partial<Record<WhStockSumGridKey, string | number | Date | null>>;

export const WH_STOCK_SUM_DETAIL_GROUP_START = 26;
