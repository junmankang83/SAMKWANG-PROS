/**
 * `Sp_StockSumListQuery_NQL`(및 유사 SKKR 수불 SP) — 창고별재고 `Sp_Inventory_NQL`과 같이
 * **메타(A)**: `Title2`·`ColIDX`(·`Title`·`TitleSeq2`)로 입·출고 유형 열 정의
 * **마스터(B)**: 품목·창고·집계 수량/금액 (`RowIDX`로 피벗 행과 연결)
 * **피벗(C)**: `RowIDX`·`ColIDX`·`Qty` (또는 `StockQty` 등) — 상세 수량
 */

import { mapStockSumNqlRowToGrid } from './erp-wh-stock-sum-nql-map';
import type { WhStockSumGridKey, WhStockSumGridRow } from './wh-stock-sum-grid.columns';

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

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function keysOf(sample: Record<string, unknown> | undefined): Set<string> {
  if (!sample || typeof sample !== 'object') return new Set();
  return new Set(Object.keys(sample).map((x) => x.toLowerCase()));
}

function normTitle(s: string): string {
  return s.replace(/\s+/g, '');
}

/** C: `RowIDX`·`ColIDX`·수량류 — 한 행에 컬럼 수가 적은 피벗 */
function recordsetLooksLikeStockSumPivotC(sample: Record<string, unknown> | undefined): boolean {
  const k = keysOf(sample);
  if (!k.has('rowidx') || !k.has('colidx')) return false;
  const hasQtyCol =
    k.has('qty') ||
    k.has('stockqty') ||
    k.has('inqty') ||
    k.has('outqty') ||
    k.has('value') ||
    k.has('amt');
  if (!hasQtyCol) return false;
  if (k.size > 24) return false;
  return true;
}

/** A: 입·출고 유형 헤더 — `Title2`·`ColIDX` 등, 품목·피벗 수량 컬럼 없음 */
function recordsetLooksLikeStockSumMetaA(sample: Record<string, unknown> | undefined): boolean {
  const k = keysOf(sample);
  if (!k.has('colidx')) return false;
  if (!k.has('title2') && !k.has('title') && !k.has('inouttypename') && !k.has('iotypename')) return false;
  if (toNum(rowVal(sample as Record<string, unknown>, 'RowIDX', 'RowIdx')) != null) return false;
  if (k.has('itemname') || k.has('itemno')) return false;
  if (k.has('qty') || k.has('stockqty')) return false;
  return true;
}

/** B: 품목 마스터 — 피벗·메타가 아닌 고정행 */
function recordsetLooksLikeStockSumMasterB(sample: Record<string, unknown> | undefined): boolean {
  if (!sample) return false;
  if (recordsetLooksLikeStockSumPivotC(sample)) return false;
  if (recordsetLooksLikeStockSumMetaA(sample)) return false;
  const k = keysOf(sample);
  return k.has('itemname') || k.has('itemno') || k.has('smaassetgrpname');
}

const IN_DETAIL_KEYS: readonly WhStockSumGridKey[] = [
  'inMove',
  'inSubst',
  'inProd',
  'inOutsrc',
  'inPurchase',
  'inImport',
] as const;

const OUT_DETAIL_KEYS: readonly WhStockSumGridKey[] = [
  'outTrx',
  'outExportInv',
  'outEtc',
  'outMove',
  'outSubst',
  'outWork',
] as const;

function classifyInOut(title: string | null, titleSeq2: number | null): 'in' | 'out' | null {
  const t = (title ?? '').trim();
  if (/입고/i.test(t)) return 'in';
  if (/출고/i.test(t)) return 'out';
  if (/^in$/i.test(t)) return 'in';
  if (/^out$/i.test(t)) return 'out';
  if (titleSeq2 != null) {
    const ts = Math.trunc(titleSeq2);
    if (ts >= 1 && ts <= 6) return 'in';
    if (ts >= 7 && ts <= 12) return 'out';
  }
  return null;
}

function matchInboundTitle2(t2: string): WhStockSumGridKey | null {
  const n = normTitle(t2);
  if (!n) return null;
  if (/품목대체|대체/.test(n)) return 'inSubst';
  if (/수입입고|수입/.test(n)) return 'inImport';
  if (/구매입고|구매/.test(n)) return 'inPurchase';
  if (/외주입고|외주/.test(n)) return 'inOutsrc';
  if (/생산입고|생산/.test(n)) return 'inProd';
  if (/이동/.test(n)) return 'inMove';
  return null;
}

function matchOutboundTitle2(t2: string): WhStockSumGridKey | null {
  const n = normTitle(t2);
  if (!n) return null;
  if (/거래명세|명세표/.test(n)) return 'outTrx';
  if (/수출.*invoice|invoice|인보이스/i.test(n)) return 'outExportInv';
  if (/기타/.test(n)) return 'outEtc';
  if (/품목대체|대체/.test(n)) return 'outSubst';
  if (/작업실적/.test(n)) return 'outWork';
  if (/이동/.test(n)) return 'outMove';
  return null;
}

function resolveDetailGridKey(
  title: string | null,
  title2: string | null,
  titleSeq2: number | null,
): WhStockSumGridKey | null {
  const t2 = (title2 ?? '').trim();
  const io = classifyInOut(title, titleSeq2);
  if (io === 'in') {
    const k = matchInboundTitle2(t2);
    if (k) return k;
  } else if (io === 'out') {
    const k = matchOutboundTitle2(t2);
    if (k) return k;
  } else {
    const ib = matchInboundTitle2(t2);
    const ob = matchOutboundTitle2(t2);
    if (ib && !ob) return ib;
    if (ob && !ib) return ob;
  }
  return null;
}

/** A 레코드에서 `ColIDX` → 그리드 상세 키 */
function buildColIdxToDetailKeyMap(aRows: Record<string, unknown>[]): Map<number, WhStockSumGridKey> {
  const colMap = new Map<number, WhStockSumGridKey>();
  const unmapped: { colIdx: number; sortKey: number }[] = [];

  for (const r of aRows) {
    const colIdxRaw = toNum(rowVal(r, 'ColIDX', 'ColIdx'));
    if (colIdxRaw == null) continue;
    const colIdx = Math.trunc(colIdxRaw);
    const title =
      trimOrNull(rowVal(r, 'Title', 'Title1')) ??
      trimOrNull(rowVal(r, 'InOutTypeName', 'IOTypeName', 'GubunName'));
    const title2 = trimOrNull(rowVal(r, 'Title2', 'TITLE2', 'SubTitle', 'ColTitle'));
    const titleSeq2 = toNum(rowVal(r, 'TitleSeq2', 'TitleSEQ2', 'TITLE_SEQ2'));
    const gk = resolveDetailGridKey(title, title2, titleSeq2);
    if (gk) {
      colMap.set(colIdx, gk);
    } else {
      const ts = titleSeq2 ?? colIdx;
      unmapped.push({ colIdx, sortKey: ts });
    }
  }

  const used = new Set(colMap.values());
  const canonical: WhStockSumGridKey[] = [...IN_DETAIL_KEYS, ...OUT_DETAIL_KEYS];
  unmapped.sort((a, b) => a.sortKey - b.sortKey || a.colIdx - b.colIdx);
  for (const { colIdx } of unmapped) {
    if (colMap.has(colIdx)) continue;
    const next = canonical.find((k) => !used.has(k));
    if (next) {
      colMap.set(colIdx, next);
      used.add(next);
    }
  }

  return colMap;
}

function pivotQtyFromRow(r: Record<string, unknown>): number | null {
  return (
    toNum(rowVal(r, 'Qty', 'QTY')) ??
    toNum(rowVal(r, 'StockQty', 'STOCKQTY')) ??
    toNum(rowVal(r, 'InQty')) ??
    toNum(rowVal(r, 'OutQty')) ??
    toNum(rowVal(r, 'Value')) ??
    toNum(rowVal(r, 'Amt', 'AMT')) ??
    null
  );
}

function buildBRowIndexByPivotRowIdx(bRows: Record<string, unknown>[]): Map<number, number> | null {
  const m = new Map<number, number>();
  for (let i = 0; i < bRows.length; i++) {
    const v = toNum(rowVal(bRows[i]!, 'RowIDX', 'RowIdx'));
    if (v == null) continue;
    const k = Math.trunc(v);
    if (!m.has(k)) m.set(k, i);
  }
  return m.size > 0 ? m : null;
}

function resolveBItemIndex(cRowIdx: number, nItem: number, bMap: Map<number, number> | null): number | null {
  const k0 = Math.trunc(cRowIdx);
  if (bMap) {
    if (bMap.has(k0)) return bMap.get(k0)!;
    if (bMap.has(k0 - 1)) return bMap.get(k0 - 1)!;
    if (bMap.has(k0 + 1)) return bMap.get(k0 + 1)!;
    return null;
  }
  if (k0 >= 0 && k0 < nItem) return k0;
  if (k0 >= 1 && k0 <= nItem) return k0 - 1;
  return null;
}

function pickTripleSets(sets: Record<string, unknown>[][]): {
  setA: Record<string, unknown>[];
  setB: Record<string, unknown>[];
  setC: Record<string, unknown>[];
} | null {
  const nonEmpty = sets.filter((s) => Array.isArray(s) && s.length > 0);
  if (nonEmpty.length < 3) return null;

  let setC: Record<string, unknown>[] | null = null;
  for (const s of nonEmpty) {
    const s0 = s[0] as Record<string, unknown> | undefined;
    if (!s0 || !recordsetLooksLikeStockSumPivotC(s0)) continue;
    if (!setC || s.length > setC.length) setC = s;
  }
  if (!setC) return null;

  let setA: Record<string, unknown>[] | null = null;
  for (const s of nonEmpty) {
    if (s === setC) continue;
    const s0 = s[0] as Record<string, unknown> | undefined;
    if (!s0 || !recordsetLooksLikeStockSumMetaA(s0)) continue;
    if (s.length > 256) continue;
    if (!setA || s.length > setA.length) setA = s;
  }
  if (!setA) return null;

  let setB: Record<string, unknown>[] | null = null;
  for (const s of nonEmpty) {
    if (s === setC || s === setA) continue;
    const s0 = s[0] as Record<string, unknown> | undefined;
    if (!s0 || !recordsetLooksLikeStockSumMasterB(s0)) continue;
    if (!setB || s.length > setB.length) setB = s;
  }
  if (!setB) return null;

  return { setA, setB, setC };
}

const DETAIL_KEYS: readonly WhStockSumGridKey[] = [...IN_DETAIL_KEYS, ...OUT_DETAIL_KEYS] as const;

/**
 * 메타·마스터·피벗 3분할이면 입·출고 상세 12열을 `ColIDX`로 채운 그리드 행 배열을 반환.
 * 패턴이 아니면 `null` (호출측에서 단일 레코드셋 매핑으로 폴백).
 */
export function tryBuildWhStockSumFromNqlPivotSets(sets: Record<string, unknown>[][]): WhStockSumGridRow[] | null {
  const picked = pickTripleSets(sets);
  if (!picked) return null;

  const { setA, setB, setC } = picked;
  const colMap = buildColIdxToDetailKeyMap(setA);
  if (colMap.size === 0) return null;

  let anyPivotQty = false;
  for (const r of setC) {
    if (toNum(rowVal(r as Record<string, unknown>, 'RowIDX', 'RowIdx')) == null) continue;
    if (toNum(rowVal(r as Record<string, unknown>, 'ColIDX', 'ColIdx')) == null) continue;
    if (pivotQtyFromRow(r as Record<string, unknown>) != null) {
      anyPivotQty = true;
      break;
    }
  }
  if (!anyPivotQty) return null;

  const bRows = setB;
  const nItem = bRows.length;
  if (nItem === 0) return null;

  const bRowMap = buildBRowIndexByPivotRowIdx(bRows);

  const detailSums: Partial<Record<WhStockSumGridKey, number>>[] = bRows.map(() => ({}));

  for (const r of setC) {
    const ri = toNum(rowVal(r, 'RowIDX', 'RowIdx'));
    const ci = toNum(rowVal(r, 'ColIDX', 'ColIdx'));
    if (ri == null || ci == null) continue;
    const colIdx = Math.trunc(ci);
    const gk = colMap.get(colIdx);
    if (!gk) continue;
    const bi = resolveBItemIndex(Math.trunc(ri), nItem, bRowMap);
    if (bi == null || bi < 0 || bi >= nItem) continue;
    const q = pivotQtyFromRow(r);
    if (q == null) continue;
    const cell = detailSums[bi]!;
    cell[gk] = (cell[gk] ?? 0) + q;
  }

  const out: WhStockSumGridRow[] = [];
  for (let i = 0; i < nItem; i++) {
    const br = bRows[i]!;
    const base = mapStockSumNqlRowToGrid(br as Record<string, unknown>, i + 1);
    const sums = detailSums[i]!;
    for (const dk of DETAIL_KEYS) {
      const v = sums[dk];
      if (v !== undefined) {
        (base as Record<string, unknown>)[dk] = v;
      }
    }
    out.push(base);
  }

  return out;
}
