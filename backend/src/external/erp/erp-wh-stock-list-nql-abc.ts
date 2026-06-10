/**
 * `Sp_Inventory_NQL` 3-recordset 응답 조립:
 * - **B (기준행)**: `SMAssetGrpName`·`AssetName`·`ItemName`·`StockQtyTot` 등 — 세로 품목·집계수량
 * - **A (창고 가로 메타)**: `Title`·`TitleSeq`·`Title2`·`ColIDX` — 창고명칭 수평 헤더, **ColIDX = 창고 열 ID**
 * - **C (셀 값)**: `RowIDX`·`ColIDX` — 해당 창고 셀에 **`StockQty`→재고수량**, **`StockAmt`→재고금액** (한 행에 둘 다 있으면 둘 다 반영)
 */

import type {
  WhStockListExcelDataRow,
  WhStockListExcelWarehouseCell,
  WhStockWarehouseColumnInfo,
} from './wh-stock-list-grid.columns';
import { aggregateWhStockListSummary, mapBlock3RowToFixedFields } from './erp-wh-stock-list-excel';

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

function emptyWhCells(n: number): WhStockListExcelWarehouseCell[] {
  return Array.from({ length: n }, () => ({ qty: null, amt: null }));
}

function normTitle2(title2: string): string {
  return title2.replace(/\s+/g, '');
}

function classifyKindFromTitle2(title2Raw: string): 'qty' | 'amt' | 'unknown' {
  const t = normTitle2(title2Raw);
  const isAmt =
    t.includes('추정재고금액') ||
    t.includes('재고금액') ||
    /금액|amt/i.test(t);
  if (isAmt) return 'amt';
  const isQty =
    t.includes('재고수량') ||
    (t.includes('수량') && !isAmt) ||
    (!t && !isAmt);
  if (isQty) return 'qty';
  return 'unknown';
}

function recordsetLooksLikeNqlMetaA(sample: Record<string, unknown> | undefined): boolean {
  const k = keysOf(sample);
  return k.has('title') && k.has('colidx') && !k.has('stockqtytot');
}

/** C(피벗)과 구분: `ColIDX`가 없는 품목 마스터 행. B에 `RowIDX`가 있어도 기준행으로 인정 */
function recordsetLooksLikeNqlMasterB(sample: Record<string, unknown> | undefined): boolean {
  const k = keysOf(sample);
  if (recordsetLooksLikeNqlPivotC(sample)) return false;
  return k.has('stockqtytot') && (k.has('itemno') || k.has('itemname')) && !k.has('colidx');
}

function recordsetLooksLikeNqlPivotC(sample: Record<string, unknown> | undefined): boolean {
  const k = keysOf(sample);
  return k.has('rowidx') && k.has('colidx') && (k.has('stockqty') || k.has('stockamt') || k.has('qty'));
}

/** non-empty recordset 배열에서 A·B·C 후보 탐지(순서 무관) */
function pickNqlAbcSets(sets: Record<string, unknown>[][]): {
  setA: Record<string, unknown>[];
  setB: Record<string, unknown>[];
  setC: Record<string, unknown>[];
} | null {
  let setA: Record<string, unknown>[] | null = null;
  let setB: Record<string, unknown>[] | null = null;
  let setC: Record<string, unknown>[] | null = null;
  for (const s of sets) {
    if (!Array.isArray(s) || s.length === 0) continue;
    const a0 = s[0]!;
    if (recordsetLooksLikeNqlPivotC(a0)) {
      if (!setC || s.length > setC.length) setC = s;
      continue;
    }
    if (recordsetLooksLikeNqlMasterB(a0)) {
      if (!setB || s.length > setB.length) setB = s;
      continue;
    }
    if (recordsetLooksLikeNqlMetaA(a0)) {
      if (!setA || s.length > setA.length) setA = s;
      continue;
    }
  }
  if (!setA || !setB || !setC) return null;
  return { setA, setB, setC };
}

type ColKind = 'qty' | 'amt';

/**
 * A: 재고수량(`Title2`) 열만 모아 창고별 **최소 `ColIDX`**를 구하고, 그 값 **오름차순**으로 창고 가로 순서 확정.
 * 각 `ColIDX`를 창고 열 ID로 `colMap`에 넣음(금액 열은 동일 창고 wi).
 */
function parseColMetaFromA(aRows: Record<string, unknown>[]): {
  warehouseHeaders: string[];
  warehouseColumns: WhStockWarehouseColumnInfo[];
  colMap: Map<number, { wi: number; kind: ColKind }>;
} {
  type QtyRow = { colIdx: number; title: string; r: Record<string, unknown> };

  const qtyRows: QtyRow[] = [];
  for (const r of aRows) {
    const colIdxRaw = toNum(rowVal(r, 'ColIDX', 'ColIdx'));
    if (colIdxRaw == null) continue;
    const colIdx = Math.trunc(colIdxRaw);
    const title = trimOrNull(rowVal(r, 'Title')) ?? '';
    const title2 = trimOrNull(rowVal(r, 'Title2')) ?? '';
    if (classifyKindFromTitle2(title2) !== 'qty') continue;
    if (!title) continue;
    qtyRows.push({ colIdx, title, r });
  }

  /** 창고(Title)당 재고수량 열 ColIDX 최소값 — 창고 가로 순서 기준 */
  const whMinQtyColIdx = new Map<string, { minColIdx: number; sampleRow: Record<string, unknown> }>();
  for (const q of qtyRows) {
    const prev = whMinQtyColIdx.get(q.title);
    if (!prev || q.colIdx < prev.minColIdx) {
      whMinQtyColIdx.set(q.title, { minColIdx: q.colIdx, sampleRow: q.r });
    }
  }

  const orderedTitles = [...whMinQtyColIdx.entries()].sort((a, b) => {
    if (a[1].minColIdx !== b[1].minColIdx) return a[1].minColIdx - b[1].minColIdx;
    return a[0].localeCompare(b[0], 'ko');
  });

  const warehouseHeaders: string[] = [];
  const titleToWi = new Map<string, number>();
  const warehouseColumns: WhStockWarehouseColumnInfo[] = [];

  for (const [title, { sampleRow }] of orderedTitles) {
    const wi = warehouseHeaders.length;
    titleToWi.set(title, wi);
    warehouseHeaders.push(title);
    warehouseColumns.push({
      displayName: title,
      titleSeq: toNum(rowVal(sampleRow, 'TitleSeq', 'TITLE_SEQ')),
      titleSeq2: toNum(rowVal(sampleRow, 'TitleSeq2', 'TitleSEQ2', 'TITLE_SEQ2')),
      colIndexes: [],
    });
  }

  const colMap = new Map<number, { wi: number; kind: ColKind }>();

  const pushColIdx = (wi: number, colIdx: number) => {
    const list = warehouseColumns[wi]!.colIndexes;
    if (!list.includes(colIdx)) list.push(colIdx);
  };

  const sortedByCol = [...aRows].sort(
    (x, y) => (toNum(rowVal(x, 'ColIDX', 'ColIdx')) ?? 0) - (toNum(rowVal(y, 'ColIDX', 'ColIdx')) ?? 0),
  );

  let lastQtyTitle: string | null = null;

  for (const r of sortedByCol) {
    const colIdxRaw = toNum(rowVal(r, 'ColIDX', 'ColIdx'));
    if (colIdxRaw == null) continue;
    const colIdx = Math.trunc(colIdxRaw);
    const title = trimOrNull(rowVal(r, 'Title')) ?? '';
    const title2 = trimOrNull(rowVal(r, 'Title2')) ?? '';
    let kind = classifyKindFromTitle2(title2);

    if (kind === 'unknown' && title && titleToWi.has(title)) {
      kind = 'qty';
    }

    let wi = -1;
    if (kind === 'qty' && title) {
      lastQtyTitle = title;
      wi = titleToWi.get(title) ?? -1;
      if (wi >= 0) {
        colMap.set(colIdx, { wi, kind: 'qty' });
        pushColIdx(wi, colIdx);
      }
    } else if (kind === 'amt') {
      const whName = title || lastQtyTitle;
      if (whName) {
        wi = titleToWi.get(whName) ?? -1;
        if (wi < 0 && lastQtyTitle) {
          wi = titleToWi.get(lastQtyTitle) ?? -1;
        }
        if (wi >= 0) {
          colMap.set(colIdx, { wi, kind: 'amt' });
          pushColIdx(wi, colIdx);
        }
      }
    }
  }

  for (const wc of warehouseColumns) {
    wc.colIndexes.sort((a, b) => a - b);
  }

  return { warehouseHeaders, warehouseColumns, colMap };
}

function isLikelyTotalRowB(bRow: Record<string, unknown>): boolean {
  const itemNo = String(rowVal(bRow, 'ItemNo') ?? '').trim();
  if (itemNo) return false;
  const name = String(rowVal(bRow, 'ItemName') ?? '').trim();
  if (/합계|^total$/i.test(name)) return true;
  const sm = String(rowVal(bRow, 'SMStatusName') ?? '').trim();
  if (/합계|total/i.test(sm)) return true;
  return false;
}

/** B에 `RowIDX`가 있으 C의 RowIDX와 동일 키로 기준행 인덱스 조회 */
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

/** A·B·C 3분할 조립 결과. `items`는 전체 행(절단은 `finalizeWhStockListResponse`에서). */
export type NqlAbcBuildResult = {
  warehouseHeaders: string[];
  warehouseColumns: WhStockWarehouseColumnInfo[];
  summary: WhStockListExcelDataRow | null;
  items: WhStockListExcelDataRow[];
};

/**
 * Sp_Inventory_NQL (A·B·C) 조립. 패턴이 아니면 `null`.
 */
export function tryBuildWhStockListFromNqlAbcSets(nonEmptySets: Record<string, unknown>[][]): NqlAbcBuildResult | null {
  const picked = pickNqlAbcSets(nonEmptySets);
  if (!picked) return null;

  const { setA, setB, setC } = picked;
  const { warehouseHeaders, warehouseColumns, colMap } = parseColMetaFromA(setA);
  if (warehouseHeaders.length === 0 || colMap.size === 0) {
    return null;
  }

  const bRows = setB.filter((r) => !isLikelyTotalRowB(r));
  const nItem = bRows.length;
  if (nItem === 0) {
    return {
      warehouseHeaders,
      warehouseColumns,
      summary: null,
      items: [],
    };
  }

  const bRowMap = buildBRowIndexByPivotRowIdx(bRows);
  const nWh = warehouseHeaders.length;

  const cellMatrix: WhStockListExcelWarehouseCell[][] = bRows.map(() => emptyWhCells(nWh));

  for (const r of setC) {
    const ri = toNum(rowVal(r, 'RowIDX', 'RowIdx'));
    const ci = toNum(rowVal(r, 'ColIDX', 'ColIdx'));
    if (ri == null || ci == null) continue;
    const colIdx = Math.trunc(ci);
    const bi = resolveBItemIndex(Math.trunc(ri), nItem, bRowMap);
    if (bi == null || bi < 0 || bi >= nItem) continue;

    const meta = colMap.get(colIdx);
    if (!meta) continue;
    const { wi } = meta;
    if (wi < 0 || wi >= nWh) continue;
    const cell = cellMatrix[bi]![wi]!;
    /** 재고수량 / 재고금액 — A의 열 구분(qty/amt)과 무관하게 C 한 행에 오면 같은 창고 셀에 모두 반영 */
    const q = toNum(rowVal(r, 'StockQty', 'STOCKQTY')) ?? toNum(rowVal(r, 'Qty'));
    const a = toNum(rowVal(r, 'StockAmt', 'STOCKAMT')) ?? toNum(rowVal(r, 'Amt'));
    if (q != null) cell.qty = cell.qty == null ? q : (cell.qty ?? 0) + q;
    if (a != null) cell.amt = cell.amt == null ? a : (cell.amt ?? 0) + a;
  }

  const items: WhStockListExcelDataRow[] = [];
  for (let i = 0; i < nItem; i++) {
    const br = bRows[i]!;
    const fixed = mapBlock3RowToFixedFields(br);
    const totalQty = toNum(rowVal(br, 'StockQtyTot', 'StockQtyTotal'));
    const totalAmt = toNum(rowVal(br, 'StockAmtTot', 'StockAmtTotal'));
    items.push({
      rowKind: 'ITEM',
      ...fixed,
      totalQty,
      totalAmt,
      warehouses: cellMatrix[i]!,
    });
  }

  const summary = aggregateWhStockListSummary(items, warehouseHeaders);

  return {
    warehouseHeaders,
    warehouseColumns,
    summary,
    items,
  };
}
