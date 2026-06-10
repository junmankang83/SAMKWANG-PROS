/**
 * 창고별 재고조회 — 엑셀(42열)과 동일한 의미의 행 조립.
 * ERP `_SWLGWHStockListQuery` 실행 후 배치 끝에서 `#BIZ_OUT_DataBlock2`·`3`·`4` 스냅샷을 받아 조립합니다.
 */

import {
  WH_STOCK_LIST_DEFAULT_WAREHOUSE_HEADERS,
  type WhStockListExcelDataRow,
  type WhStockListExcelWarehouseCell,
} from './wh-stock-list-grid.columns';

export { WH_STOCK_LIST_DEFAULT_WAREHOUSE_HEADERS };

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

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normWh(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/** 창고명을 헤더 배열 인덱스에 매핑(정확 일치 → 부분 일치) */
export function resolveWarehouseColumnIndex(whName: string | null, headers: readonly string[]): number {
  if (!whName) return -1;
  const n = normWh(whName.trim());
  if (!n) return -1;
  for (let i = 0; i < headers.length; i++) {
    const h = normWh(headers[i] ?? '');
    if (h && h === n) return i;
  }
  for (let i = 0; i < headers.length; i++) {
    const h = normWh(headers[i] ?? '');
    if (h && (n.includes(h) || h.includes(n))) return i;
  }
  return -1;
}

function emptyWhCells(n: number): WhStockListExcelWarehouseCell[] {
  return Array.from({ length: n }, () => ({ qty: null, amt: null }));
}

function groupKeyFromRow(r: Record<string, unknown>): string {
  const biz = toNum(rowVal(r, 'BizUnit'));
  const itemNo = trimOrNull(rowVal(r, 'ItemNo')) ?? '';
  const itemSeq = toNum(rowVal(r, 'ItemSeq'));
  const itemName = trimOrNull(rowVal(r, 'ItemName')) ?? '';
  const spec = trimOrNull(rowVal(r, 'Spec')) ?? '';
  const unitSeq = toNum(rowVal(r, 'UnitSeq'));
  const lot = trimOrNull(rowVal(r, 'LotNo')) ?? '';
  return [biz ?? '', itemNo, itemSeq ?? '', itemName, spec, unitSeq ?? '', lot].join('\u001f');
}

/** 창고 식별: WHName 우선, 비면 CostWHName·SMWHKindName 등 */
function effectiveWarehouseName(r: Record<string, unknown>): string | null {
  return (
    trimOrNull(rowVal(r, 'WHName')) ??
    trimOrNull(rowVal(r, 'CostWHName')) ??
    trimOrNull(rowVal(r, 'SMWHKindName'))
  );
}

export function mapBlock3RowToFixedFields(r: Record<string, unknown>): Omit<WhStockListExcelDataRow, 'rowKind' | 'totalQty' | 'totalAmt' | 'warehouses'> {
  return {
    assetClass: trimOrNull(rowVal(r, 'SMAssetGrpName', 'AssetName')),
    classL: trimOrNull(rowVal(r, 'ItemClassLName')),
    classM: trimOrNull(rowVal(r, 'ItemClassMName')),
    classS: trimOrNull(rowVal(r, 'ItemClassSName')),
    importance: trimOrNull(rowVal(r, 'SMABCName')),
    itemName: trimOrNull(rowVal(r, 'ItemName')),
    itemNo: trimOrNull(rowVal(r, 'ItemNo')),
    spec: trimOrNull(rowVal(r, 'Spec')),
    unit: trimOrNull(rowVal(r, 'UnitName')),
    itemStatus: trimOrNull(rowVal(r, 'SMStatusName')),
  };
}

/** OUT3 정렬용 — 비즈니스 `RowIDX`는 OUT4와 혼동되므로 제외하고 메타·순번만 사용 */
function rowIdxNum(r: Record<string, unknown>): number {
  const v = rowVal(r, 'ROW_IDX', 'IDX_NO', 'DataSeq');
  const n = toNum(v);
  return n ?? 0;
}

/** 그룹과 Block4 피벼 연결: OUT3 메타 `ROW_IDX` 등 */
function groupPivotLineId(gRows: Record<string, unknown>[]): number | null {
  let best: number | null = null;
  for (const r of gRows) {
    const v = toNum(rowVal(r, 'ROW_IDX', 'IDX_NO'));
    if (v == null) continue;
    best = best == null ? v : Math.min(best, v);
  }
  return best;
}

type Block4LineMap = Map<number, Map<number, { qty: number | null; amt: number | null }>>;

function buildBlock4LineMap(block4Rows: Record<string, unknown>[]): Block4LineMap {
  const m: Block4LineMap = new Map();
  for (const r of block4Rows) {
    const row = toNum(rowVal(r, 'RowIDX'));
    const col = toNum(rowVal(r, 'ColIDX'));
    if (row == null || col == null) continue;
    let inner = m.get(row);
    if (!inner) {
      inner = new Map();
      m.set(row, inner);
    }
    const q = toNum(rowVal(r, 'StockQty', 'Qty'));
    const a = toNum(rowVal(r, 'StockAmt'));
    const prev = inner.get(col);
    if (!prev) inner.set(col, { qty: q, amt: a });
    else {
      inner.set(col, {
        qty: (prev.qty ?? 0) + (q ?? 0),
        amt: (prev.amt ?? 0) + (a ?? 0),
      });
    }
  }
  return m;
}

/** ColIDX → 창고 열 인덱스(ERP가 0/1 기반 또는 합계열 스킵 등 혼재) */
function colIdxToWarehouseIndex(colIdx: number, nWh: number): number {
  if (!Number.isFinite(colIdx)) return -1;
  const candidates = [colIdx - 1, colIdx, colIdx - 2];
  for (const i of candidates) {
    if (i >= 0 && i < nWh) return i;
  }
  return -1;
}

function applyBlock4ToWhCells(
  gRows: Record<string, unknown>[],
  whCells: WhStockListExcelWarehouseCell[],
  block4: Block4LineMap,
): void {
  const lineId = groupPivotLineId(gRows);
  if (lineId == null) return;
  const cols = block4.get(lineId);
  if (!cols?.size) return;

  const nWh = whCells.length;
  for (const [colIdx, cell] of cols) {
    const wi = colIdxToWarehouseIndex(colIdx, nWh);
    if (wi < 0) continue;
    const t = whCells[wi]!;
    if (t.qty == null && t.amt == null) {
      t.qty = cell.qty;
      t.amt = cell.amt;
    }
  }
}

/**
 * `#BIZ_OUT_DataBlock3` 행 배열 → 품목 단위로 창고 피벗 + TOTAL 요약.
 * `block4Rows`가 있으면 `ROW_IDX`=`RowIDX`에 대응하는 행에서 창고열이 비었을 때만 Block4로 채웁니다.
 */
export function buildExcelLayoutFromOutDataBlock3(
  rows: Record<string, unknown>[],
  warehouseHeaders: readonly string[],
  block4Rows?: Record<string, unknown>[],
): { summary: WhStockListExcelDataRow; items: WhStockListExcelDataRow[] } {
  const nWh = warehouseHeaders.length;
  const sorted = [...rows].sort((a, b) => rowIdxNum(a) - rowIdxNum(b));
  const block4Map = block4Rows?.length ? buildBlock4LineMap(block4Rows) : new Map();

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of sorted) {
    const k = groupKeyFromRow(r);
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }

  const items: WhStockListExcelDataRow[] = [];

  for (const [, gRows] of groups) {
    const first = gRows[0]!;
    const fixed = mapBlock3RowToFixedFields(first);
    const whCells = emptyWhCells(nWh);

    let totalQty: number | null = toNum(rowVal(first, 'StockQtyTot'));
    let totalAmt: number | null = toNum(rowVal(first, 'StockAmtTot'));

    for (const r of gRows) {
      const whName = effectiveWarehouseName(r);
      const idx = resolveWarehouseColumnIndex(whName, warehouseHeaders);
      const q = toNum(rowVal(r, 'StockQty', 'Qty'));
      const a = toNum(rowVal(r, 'StockAmt'));
      if (idx >= 0) {
        const cell = whCells[idx]!;
        cell.qty = cell.qty == null ? q : (cell.qty ?? 0) + (q ?? 0);
        cell.amt = cell.amt == null ? a : (cell.amt ?? 0) + (a ?? 0);
      }
    }

    applyBlock4ToWhCells(gRows, whCells, block4Map);

    if (totalQty == null) {
      let s = 0;
      let any = false;
      for (const c of whCells) {
        if (c.qty != null) {
          s += c.qty;
          any = true;
        }
      }
      totalQty = any ? s : null;
    }
    if (totalAmt == null) {
      let s = 0;
      let any = false;
      for (const c of whCells) {
        if (c.amt != null) {
          s += c.amt;
          any = true;
        }
      }
      totalAmt = any ? s : null;
    }

    items.push({
      rowKind: 'ITEM',
      ...fixed,
      totalQty,
      totalAmt,
      warehouses: whCells,
    });
  }

  return { summary: aggregateWhStockListSummary(items, warehouseHeaders), items };
}

/** 품목 행만 있을 때 TOTAL 요약 행 생성 (`buildExcelLayoutFromOutDataBlock3`와 동일 합산) */
export function aggregateWhStockListSummary(
  items: WhStockListExcelDataRow[],
  warehouseHeaders: readonly string[],
): WhStockListExcelDataRow {
  const nWh = warehouseHeaders.length;
  const summaryWh = emptyWhCells(nWh);
  let sumQty = 0;
  let sumAmt = 0;
  let anyQty = false;
  let anyAmt = false;
  for (const it of items) {
    if (it.totalQty != null) {
      sumQty += it.totalQty;
      anyQty = true;
    }
    if (it.totalAmt != null) {
      sumAmt += it.totalAmt;
      anyAmt = true;
    }
    for (let i = 0; i < nWh; i++) {
      const c = it.warehouses[i]!;
      const t = summaryWh[i]!;
      if (c.qty != null) {
        t.qty = (t.qty ?? 0) + c.qty;
      }
      if (c.amt != null) {
        t.amt = (t.amt ?? 0) + c.amt;
      }
    }
  }

  return {
    rowKind: 'TOTAL',
    assetClass: 'TOTAL',
    classL: null,
    classM: null,
    classS: null,
    importance: null,
    itemName: null,
    itemNo: null,
    spec: null,
    unit: null,
    itemStatus: null,
    totalQty: anyQty ? sumQty : null,
    totalAmt: anyAmt ? sumAmt : null,
    warehouses: summaryWh.map((c) => ({
      qty: c.qty,
      amt: c.amt,
    })),
  };
}

/**
 * `#BIZ_OUT_DataBlock3` 전용 — `#BIZ_OUT_DataBlock1`(입출력·수불)과 구분.
 * OUT1에는 `StockQtyTot`/`StockAmtTot`가 없는 경우가 많고 `InOutSeq` 등이 붙습니다.
 */
export function recordsetLooksLikeOutDataBlock3(sample: Record<string, unknown> | undefined): boolean {
  if (!sample || typeof sample !== 'object') return false;
  const k = new Set(Object.keys(sample).map((x) => x.toLowerCase()));
  const hasItem = k.has('itemno');
  const hasWhNameCol = k.has('whname');
  const hasQty = k.has('stockqty') || k.has('stockqtytot');
  const hasOut3Wide = k.has('stockqtytot') || k.has('stockamttot') || k.has('smassetgrpname');
  const looksLikeOut1 = k.has('inoutseq') || k.has('inoutno') || k.has('inoutkind');
  const pivotOnly = k.has('colidx') && !k.has('itemname') && !k.has('itemno');
  return hasItem && hasWhNameCol && hasQty && hasOut3Wide && !looksLikeOut1 && !pivotOnly;
}

/**
 * `Sp_Inventory_NQL` 등 단순 SP 결과 — OUT3 전체 스키마 없이 품목·창고·수량만 있어도 피벗 가능.
 */
export function recordsetLooksLikeWhStockListPivotRow(sample: Record<string, unknown> | undefined): boolean {
  if (!sample || typeof sample !== 'object') return false;
  const k = new Set(Object.keys(sample).map((x) => x.toLowerCase()));
  const hasItem = k.has('itemno') || k.has('gooditemno') || k.has('itemseq');
  const hasWh =
    k.has('whname') || k.has('subwhname') || k.has('costwhname') || k.has('smwhkindname');
  const hasQty = k.has('stockqty') || k.has('qty') || k.has('stdstockqty') || k.has('stockqtytot');
  const looksLikeOut1 = k.has('inoutseq') || k.has('inoutno') || k.has('inoutkind');
  const pivotOnly =
    k.has('colidx') && !k.has('itemname') && !k.has('itemno') && !k.has('gooditemno');
  return Boolean(hasItem && hasWh && hasQty && !looksLikeOut1 && !pivotOnly);
}

/** SP·배치 recordset 중 피벗에 쓸 수 있는 가장 큰 집합 */
export function pickBestPivotFriendlyRecordset(sets: Record<string, unknown>[][]): Record<string, unknown>[] | null {
  let best: Record<string, unknown>[] | null = null;
  let bestLen = 0;
  for (const s of sets) {
    if (!Array.isArray(s) || s.length === 0) continue;
    const sample = s[0];
    const ok = recordsetLooksLikeWhStockListPivotRow(sample) || recordsetLooksLikeOutDataBlock3(sample);
    if (!ok) continue;
    if (s.length > bestLen) {
      bestLen = s.length;
      best = s;
    }
  }
  return best;
}

/** 결과 행에 나타난 창고명 순서(첫 등장 순) — `ERP_WH_STOCK_LIST_EXCEL_WH_HEADERS`보다 SP 동적 창고에 적합 */
export function deriveWarehouseHeadersFromRows(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const w = effectiveWarehouseName(r);
    if (!w) continue;
    const key = normWh(w);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(w.trim());
  }
  return out;
}

/** 스냅샷·프로시저 recordset 중 가장 행 수가 많은 OUT3 집합(오탐 OUT1 제외 후 최대 길이) */
export function pickBestOutDataBlock3Set(sets: Record<string, unknown>[][]): Record<string, unknown>[] | null {
  let best: Record<string, unknown>[] | null = null;
  let bestLen = 0;
  for (const s of sets) {
    if (!s.length || !recordsetLooksLikeOutDataBlock3(s[0])) continue;
    if (s.length > bestLen) {
      bestLen = s.length;
      best = s;
    }
  }
  return best;
}

export function recordsetLooksLikeOutDataBlock4(sample: Record<string, unknown> | undefined): boolean {
  if (!sample || typeof sample !== 'object') return false;
  const k = new Set(Object.keys(sample).map((x) => x.toLowerCase()));
  return k.has('rowidx') && k.has('colidx') && (k.has('stockqty') || k.has('qty'));
}

export function pickLastOutDataBlock4Set(sets: Record<string, unknown>[][]): Record<string, unknown>[] {
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (s.length && recordsetLooksLikeOutDataBlock4(s[0])) return s;
  }
  return [];
}

export function parseWarehouseHeadersJson(raw: string | undefined, logger?: { warn: (m: string) => void }): string[] | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const v = JSON.parse(t) as unknown;
    if (!Array.isArray(v) || v.length === 0) return null;
    const out = v.map((x) => String(x).trim()).filter((s) => s.length > 0);
    return out.length ? out : null;
  } catch {
    logger?.warn('ERP_WH_STOCK_LIST_EXCEL_WH_HEADERS JSON 파싱 실패 — 기본 창고 순서를 사용합니다.');
    return null;
  }
}

/** 레거시 9컬럼 행을 Block3 형태로 변환해 동일 피벗 로직을 재사용 */
export function legacyNineColRowsToBlock3Like(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    ItemNo: rowVal(r, 'SubItemNo', 'STDItemName', 'ItemNo'),
    ItemName: rowVal(r, 'GoodItemNo', 'ItemName'),
    ItemSeq: rowVal(r, 'GoodItemSeq', 'ItemSeq'),
    Spec: null,
    UnitSeq: rowVal(r, 'SubItemSeq', 'UnitSeq'),
    WHName: rowVal(r, 'SubWHName', 'WHName'),
    StockQty: rowVal(r, 'STDStockQty', 'StockQty'),
    StockAmt: null,
    StockQtyTot: rowVal(r, 'STDStockQty', 'StockQty'),
    StockAmtTot: null,
    SMAssetGrpName: rowVal(r, 'BizUnitName'),
    ItemClassLName: null,
    ItemClassMName: null,
    ItemClassSName: null,
    SMABCName: null,
    SMStatusName: null,
    UnitName: null,
  })) as Record<string, unknown>[];
}
