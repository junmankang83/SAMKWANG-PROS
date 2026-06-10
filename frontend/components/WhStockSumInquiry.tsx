'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Input,
} from '@samkwang/ui-kit';
import { EIS_TD, EIS_TD_LEFT, EIS_TD_NUM, EIS_TH } from '@/lib/eis-report-table-classes';
import { WH_STOCK_SUM_DETAIL_GROUP_START, WH_STOCK_SUM_GRID_COLUMNS, type WhStockSumGridRow } from '@/lib/erp/wh-stock-sum-grid.columns';
import { defaultMailSendingMenuInquiryDateRange, defaultMonthStartToTodayRange } from '@/lib/erp/inquiry-default-date-range';
import { useCallback, useMemo, useState } from 'react';

export type WhStockSumRow = WhStockSumGridRow;

const COL_COUNT = 1 + WH_STOCK_SUM_GRID_COLUMNS.length;
const HEAD_MAIN = WH_STOCK_SUM_GRID_COLUMNS.slice(0, WH_STOCK_SUM_DETAIL_GROUP_START);
const HEAD_IN_DETAIL = WH_STOCK_SUM_GRID_COLUMNS.slice(WH_STOCK_SUM_DETAIL_GROUP_START, WH_STOCK_SUM_DETAIL_GROUP_START + 6);
const HEAD_OUT_DETAIL = WH_STOCK_SUM_GRID_COLUMNS.slice(WH_STOCK_SUM_DETAIL_GROUP_START + 6);

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const m = body?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return `요청 실패 (${res.status})`;
}

function formatNumberGrid(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3, minimumFractionDigits: 0 }).format(n);
}

function cellDisplayGrid(
  key: string,
  v: string | number | Date | null | undefined,
  numeric: boolean,
): string {
  if (v == null || v === '') return '';
  if (numeric && typeof v === 'number') return formatNumberGrid(v);
  if (typeof v === 'number') return formatNumberGrid(v);
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v);
}

export type WhStockSumInquiryProps = {
  embedded?: boolean;
};

function buildTotalRow(items: WhStockSumGridRow[]): WhStockSumGridRow {
  const total: WhStockSumGridRow = { rowNo: 0, isTotal: true, assetGrpName: 'TOTAL' };
  for (const col of WH_STOCK_SUM_GRID_COLUMNS) {
    if (!col.numeric) continue;
    const k = col.key;
    let sum = 0;
    for (const r of items) {
      const v = r[k];
      if (typeof v === 'number' && !Number.isNaN(v)) sum += v;
    }
    (total as Record<string, unknown>)[k] = sum;
  }
  return total;
}

export function WhStockSumInquiry({ embedded = false }: WhStockSumInquiryProps) {
  const defaults = useMemo(
    () => (embedded ? defaultMailSendingMenuInquiryDateRange() : defaultMonthStartToTodayRange()),
    [embedded],
  );

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WhStockSumGridRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const displayRows = useMemo(() => {
    if (items.length === 0) return [];
    const dataRows = items.filter((r) => !r.isTotal);
    const serverTotal = items.find((r) => r.isTotal);
    if (serverTotal) return [serverTotal, ...dataRows];
    return [buildTotalRow(dataRows), ...dataRows];
  }, [items]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('dateFr', from);
      params.set('dateTo', to);
      const res = await fetch(`/api/erp/wh-stock-sum?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: WhStockSumGridRow[]; truncated: boolean };
      setItems(Array.isArray(body.items) ? body.items : []);
      setTruncated(Boolean(body.truncated));
    } catch {
      setItems([]);
      setTruncated(false);
      setError('네트워크 오류로 조회에 실패했습니다.');
    } finally {
      setHasFetched(true);
      setLoading(false);
    }
  }, [from, to]);

  const emptyHint = hasFetched && items.length === 0 && !loading && !error;

  /** `WhStockListInquiry`와 동일: 부모가 높이를 줄 때 그리드만 남은 영역에서 스크롤 */
  const tableScrollClass = embedded
    ? 'min-h-0 w-full max-h-[min(72dvh,640px)] overflow-auto border border-black bg-white'
    : 'min-h-0 w-full flex-1 overflow-auto border border-black bg-white';

  const dataRowCount = items.filter((r) => !r.isTotal).length;

  return (
    <div
      className={
        embedded
          ? 'flex min-h-0 flex-col gap-3'
          : 'mx-auto flex h-full min-h-0 max-w-[1600px] flex-1 flex-col gap-4 p-4'
      }
    >
      <Card className="shrink-0">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex w-full flex-wrap items-end justify-end gap-2 sm:gap-3">
            <label className="flex shrink-0 flex-col gap-0.5">
              <span className="text-[11px] font-medium text-app-muted">조회시작일</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={loading}
                className="h-8 w-[9.5rem] text-xs"
              />
            </label>
            <label className="flex shrink-0 flex-col gap-0.5">
              <span className="text-[11px] font-medium text-app-muted">조회종료일</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={loading}
                className="h-8 w-[9.5rem] text-xs"
              />
            </label>
            <Button type="button" size="sm" className="shrink-0" onClick={() => void fetchData()} disabled={loading}>
              {loading ? '조회 중…' : '조회'}
            </Button>
          </div>

          {error ? (
            <Alert variant="error">
              <AlertTitle>조회 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {truncated ? (
            <Alert>
              <AlertTitle>일부만 표시</AlertTitle>
              <AlertDescription>
                반환 행 상한(기본 8,000건)을 초과하여 앞부분만 표시했습니다. 기간을 나누어 조회하세요.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {hasFetched && items.length > 0 ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          조회기간: <strong>{from}</strong> ~ <strong>{to}</strong> · 품목·창고 단위 {dataRowCount}행
          {truncated ? <> · 일부만 표시</> : null}
        </p>
      ) : null}

      {emptyHint ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          해당 기간에 행이 없습니다. 날짜 범위를 확인하세요. 기본 조회는{' '}
          <code className="rounded bg-muted px-1">Sp_StockSumListQuery_NQL</code> (
          <code className="rounded bg-muted px-1">@BegDate</code>, <code className="rounded bg-muted px-1">@EndDate</code>에 YYYYMMDD
          8자)입니다. SP 매개 변수명이 다르면{' '}
          <code className="rounded bg-muted px-1">ERP_WH_STOCK_SUM_SP_NQL_DATE_FR_PARAM</code>·
          <code className="rounded bg-muted px-1">ERP_WH_STOCK_SUM_SP_NQL_DATE_TO_PARAM</code>을 설정하세요. 레거시·직접 SQL은{' '}
          <code className="rounded bg-muted px-1">ERP_WH_STOCK_SUM_USE_SP_STOCK_SUM_LIST_QUERY_NQL=false</code> 후 환경을 맞추세요.
        </p>
      ) : null}

      <div className={tableScrollClass}>
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#E7E6E6]">
            <tr>
              <th rowSpan={2} className={EIS_TH}>
                순번
              </th>
              {HEAD_MAIN.map((c) => (
                <th key={c.key} rowSpan={2} className={EIS_TH}>
                  {c.header}
                </th>
              ))}
              <th colSpan={6} className={EIS_TH}>
                입고
              </th>
              <th colSpan={6} className={EIS_TH}>
                출고
              </th>
            </tr>
            <tr>
              {HEAD_IN_DETAIL.map((c) => (
                <th key={c.key} className={EIS_TH}>
                  {c.header}
                </th>
              ))}
              {HEAD_OUT_DETAIL.map((c) => (
                <th key={c.key} className={EIS_TH}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hasFetched || displayRows.length === 0 ? (
              <tr>
                <td className={EIS_TD} colSpan={COL_COUNT}>
                  {loading
                    ? '조회 중…'
                    : hasFetched
                      ? '조회 결과가 없습니다.'
                      : '조회 버튼을 눌러 데이터를 불러오세요.'}
                </td>
              </tr>
            ) : (
              displayRows.map((r) => (
                <tr
                  key={
                    r.isTotal
                      ? 'row-total'
                      : `${r.rowNo}-${String(r.itemNo ?? '')}-${String(r.whCode ?? '')}-${String(r.itemName ?? '')}`
                  }
                  className={r.isTotal ? 'bg-[#f0f9f0] font-semibold' : undefined}
                >
                  <td className={EIS_TD}>{r.isTotal ? '' : r.rowNo}</td>
                  {WH_STOCK_SUM_GRID_COLUMNS.map((c) => {
                    const v = r[c.key];
                    const cls = c.numeric ? EIS_TD_NUM : EIS_TD_LEFT;
                    return (
                      <td key={c.key} className={cls}>
                        {cellDisplayGrid(c.key, v, c.numeric)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
