/** 설비 점검 계획/실적 JSON(planJson·actualJson) 파싱 및 월별 주차 그리드 */

export type MonthWeekGrid = Record<string, (number | null)[]>;

export type GridItemRef = { id: string; itemCode: string };

export function emptyGridForItems(itemIds: string[]): MonthWeekGrid {
  const g: MonthWeekGrid = {};
  for (const id of itemIds) {
    g[id] = Array.from({ length: 12 }, () => null);
  }
  return g;
}

/** API/DB에 따라 JSON이 문자열로 한 번 더 감싸져 오는 경우 처리 */
export function coercePlanJsonRoot(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4) {
    return null;
  }
  if (value == null || value === '') {
    return null;
  }
  let cur: unknown = value;
  if (typeof cur === 'string') {
    try {
      cur = JSON.parse(cur) as unknown;
    } catch {
      return null;
    }
    return coercePlanJsonRoot(cur, depth + 1);
  }
  if (typeof cur !== 'object' || Array.isArray(cur)) {
    return null;
  }
  return cur as Record<string, unknown>;
}

export function readMonthWeekValue(row: Record<string, unknown>, month1: number): unknown {
  const padded = month1 < 10 ? `0${month1}` : String(month1);
  const direct =
    row[String(month1)] ??
    row[padded] ??
    (row as Record<number, unknown>)[month1];
  if (direct != null && direct !== '') {
    return direct;
  }
  for (const [k, val] of Object.entries(row)) {
    const mk = parseInt(String(k).trim(), 10);
    if (mk === month1) {
      return val;
    }
  }
  return undefined;
}

export function gridFromJson(json: unknown, items: GridItemRef[]): MonthWeekGrid {
  const itemIds = items.map((x) => x.id);
  const base = emptyGridForItems(itemIds);
  const root = coercePlanJsonRoot(json);
  if (!root) {
    return base;
  }
  for (const it of items) {
    const rowRaw = root[it.id] ?? root[it.itemCode.trim()];
    let row: Record<string, unknown> | null = null;
    if (typeof rowRaw === 'string') {
      row = coercePlanJsonRoot(rowRaw);
    } else if (rowRaw && typeof rowRaw === 'object' && !Array.isArray(rowRaw)) {
      row = rowRaw as Record<string, unknown>;
    }
    if (!row) {
      continue;
    }
    for (let m = 1; m <= 12; m++) {
      const v = readMonthWeekValue(row, m);
      if (v == null || v === '') {
        continue;
      }
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 5) {
        base[it.id][m - 1] = n;
      }
    }
  }
  return base;
}

export function gridToJson(grid: MonthWeekGrid): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [itemId, months] of Object.entries(grid)) {
    const m: Record<string, number> = {};
    months.forEach((w, idx) => {
      if (w != null && w >= 1 && w <= 5) {
        m[String(idx + 1)] = w;
      }
    });
    if (Object.keys(m).length > 0) {
      out[itemId] = m;
    }
  }
  return out;
}

export function weekCellLabel(w: number | null): string {
  if (w == null || !Number.isFinite(w)) {
    return '—';
  }
  if (w >= 1 && w <= 5) {
    return `${w}주차`;
  }
  return '—';
}

export const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'] as const;

export const QUARTERS: { label: string; months: readonly number[] }[] = [
  { label: '1/4분기', months: [0, 1, 2] },
  { label: '2/4분기', months: [3, 4, 5] },
  { label: '3/4분기', months: [6, 7, 8] },
  { label: '4/4분기', months: [9, 10, 11] },
];
