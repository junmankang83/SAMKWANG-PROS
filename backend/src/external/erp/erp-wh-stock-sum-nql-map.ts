/**
 * `Sp_StockSumListQuery_NQL` 결과 행 → 창고별수불집계 엑셀(skkr)과 동일한 38열 그리드.
 * ERP 컬럼명이 환경마다 다를 수 있어 동의어·대소문자 무시로 매핑합니다.
 */

import type { WhStockSumGridRow } from './wh-stock-sum-grid.columns';

function rowVal(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(r, k)) return r[k];
    const lk = k.toLowerCase();
    for (const rk of Object.keys(r)) {
      if (rk.toLowerCase() === lk) return r[rk];
    }
  }
  return undefined;
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function firstStr(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = toStr(rowVal(r, k));
    if (v) return v;
  }
  return null;
}

function firstNum(r: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = toNum(rowVal(r, k));
    if (v != null) return v;
  }
  return null;
}

/** SP 결과 집합 중 품목·다열 형태 메인 테이블 선택 */
export function pickWhStockSumNqlMainRecordset(
  recordsets: Record<string, unknown>[][] | undefined,
  fallback: Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  const sets = Array.isArray(recordsets) ? recordsets.filter((s) => Array.isArray(s) && s.length > 0) : [];
  let best: Record<string, unknown>[] = [];
  let bestScore = -1;
  for (const s of sets) {
    const row0 = s[0] as Record<string, unknown> | undefined;
    if (!row0) continue;
    const keys = new Set(Object.keys(row0).map((x) => x.toLowerCase()));
    if (keys.size < 12) continue;
    const hasItem = keys.has('itemname') || keys.has('itemno') || keys.has('smaassetgrpname');
    if (!hasItem) continue;
    let sc = keys.size;
    if (keys.has('prevqty') || keys.has('carryqty') || keys.has('이월수량')) sc += 50;
    if (keys.has('stockqty') || keys.has('stkqty')) sc += 30;
    if (keys.has('inqty')) sc += 20;
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  if (best.length > 0) return best;
  return fallback ?? [];
}

export function mapStockSumNqlRowToGrid(r: Record<string, unknown>, rowNo: number): WhStockSumGridRow {
  const asset = firstStr(r, 'SMAssetGrpName', 'AssetGrpName', 'ItemAssetGrpName', '품목자산분류');
  const itemName = firstStr(r, 'ItemName', '품명');
  const isTotal =
    String(asset ?? '').toUpperCase() === 'TOTAL' ||
    String(itemName ?? '').toUpperCase() === 'TOTAL' ||
    String(toStr(rowVal(r, 'ItemNo')) ?? '').toUpperCase() === 'TOTAL';

  const whSeq = firstNum(r, 'WHSeq', 'WhSeq');

  return {
    rowNo,
    isTotal: isTotal || undefined,
    assetGrpName: asset,
    classLName: firstStr(r, 'ItemClassLName', 'ClassLName', '품목대분류'),
    classMName: firstStr(r, 'ItemClassMName', 'ClassMName', '품목중분류'),
    classSName: firstStr(r, 'ItemClassSName', 'ClassSName', 'ItemClassSName2', '품목소분류'),
    itemName,
    itemNo: firstStr(r, 'ItemNo', '품번'),
    spec: firstStr(r, 'Spec', '규격'),
    unitName: firstStr(r, 'UnitName', '단위'),
    itemStatus: firstStr(r, 'SMStatusName', 'ItemStatusName', '품목상태'),
    whDivName: firstStr(r, 'SMWHKindName', 'WHKindName', 'WhDivName', '창고구분', 'WHDivName'),
    whName: firstStr(r, 'WHName', '창고'),
    whGroupName: firstStr(r, 'WHGroupName', 'SMWHGroupName', '창고그룹'),
    storageLoc: firstStr(r, 'Location', 'StorageLoc', '보관위치'),
    whCode: whSeq != null ? String(Math.trunc(whSeq)) : firstStr(r, 'WHCode', 'WhCode', '창고코드'),
    carryQty: firstNum(r, 'PrevQty', 'CarryQty', 'BFQty', 'OpenQty', '이월수량') ?? undefined,
    carryAmt: firstNum(r, 'PrevAmt', 'CarryAmt', 'BFAmt', 'OpenAmt', '이월금액') ?? undefined,
    inQty: firstNum(r, 'InQty', 'TotInQty', '입고수량') ?? undefined,
    inAmt: firstNum(r, 'InAmt', 'TotInAmt', '입고금액') ?? undefined,
    outQty: firstNum(r, 'OutQty', 'TotOutQty', '출고수량') ?? undefined,
    outAmt: firstNum(r, 'OutAmt', 'TotOutAmt', '출고금액') ?? undefined,
    stkQty: firstNum(r, 'StockQty', 'StkQty', 'EndQty', '재고수량', 'ClosingQty') ?? undefined,
    stkAmt: firstNum(r, 'StockAmt', 'StkAmt', 'EndAmt', '재고금액', 'ClosingAmt') ?? undefined,
    safetyQty: firstNum(r, 'SafetyQty', 'SafetyStockQty', '안전재고수량') ?? undefined,
    safetyAmt: firstNum(r, 'SafetyAmt', 'SafetyStockAmt', '안전재고금액') ?? undefined,
    stdPrice: firstNum(r, 'STDPrice', 'StdPrice', 'StkPrice', '표준단가') ?? undefined,
    settlePrice: firstNum(r, 'SettlePrice', 'InvPrice', 'AvgPrice', '결산단가') ?? undefined,
    inMove: firstNum(r, 'InMoveQty', 'InMove', 'MoveInQty', '이동입고', '이동처리입고') ?? undefined,
    inSubst: firstNum(r, 'InSubstQty', 'InItemChgQty', 'InChangeQty', '품목대체입고') ?? undefined,
    inProd: firstNum(r, 'InProdQty', 'ProdInQty', '생산입고') ?? undefined,
    inOutsrc: firstNum(r, 'InOutSrcQty', 'OutWorkInQty', '외주입고') ?? undefined,
    inPurchase: firstNum(r, 'InPurQty', 'InPurchaseQty', '구매입고') ?? undefined,
    inImport: firstNum(r, 'InImpQty', 'InImportQty', '수입입고') ?? undefined,
    outTrx: firstNum(r, 'OutTrxQty', 'OutSlipQty', 'OutDOQty', '거래명세출고', '거래명세표') ?? undefined,
    outExportInv: firstNum(r, 'OutExpInvQty', 'OutExportInvoiceQty', '수출Invoice', '수출invoice') ?? undefined,
    outEtc: firstNum(r, 'OutEtcQty', 'OutOtherQty', '기타출고') ?? undefined,
    outMove: firstNum(r, 'OutMoveQty', 'MoveOutQty', '이동출고', '이동처리출고') ?? undefined,
    outSubst: firstNum(r, 'OutSubstQty', 'OutItemChgQty', '품목대체출고') ?? undefined,
    outWork: firstNum(r, 'OutWorkQty', 'WorkResultQty', '작업실적출고', '작업실적') ?? undefined,
  };
}
