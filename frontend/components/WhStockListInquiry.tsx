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
import {
  EIS_TD,
  EIS_TD_LEFT,
  EIS_TD_NUM,
  EIS_TH,
} from '@/lib/eis-report-table-classes';
import {
  WH_STOCK_LIST_EXCEL_FIXED_COL_HEADERS,
  WH_STOCK_LIST_EXCEL_TITLE,
  type WhStockListExcelDataRow,
  type WhStockListExcelListResponse,
} from '@/lib/erp/wh-stock-list-grid.columns';
import { useCallback, useMemo, useState } from 'react';

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const m = body?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return `요청 실패 (${res.status})`;
}

function formatQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 5, minimumFractionDigits: 0 }).format(n);
}

function formatAmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fixedCells(row: WhStockListExcelDataRow): string[] {
  return [
    row.assetClass ?? '',
    row.classL ?? '',
    row.classM ?? '',
    row.classS ?? '',
    row.importance ?? '',
    row.itemName ?? '',
    row.itemNo ?? '',
    row.spec ?? '',
    row.unit ?? '',
    row.itemStatus ?? '',
  ];
}

function whCellsAligned(row: WhStockListExcelDataRow, nWh: number): { qty: number | null; amt: number | null }[] {
  const out: { qty: number | null; amt: number | null }[] = [];
  for (let i = 0; i < nWh; i++) {
    const c = row.warehouses[i];
    out.push(c ?? { qty: null, amt: null });
  }
  return out;
}

export type WhStockListInquiryProps = {
  embedded?: boolean;
};

export function WhStockListInquiry({ embedded = false }: WhStockListInquiryProps) {
  const defaultAsOf = useMemo(() => localYmd(new Date()), []);
  const [asOf, setAsOf] = useState(defaultAsOf);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<WhStockListExcelListResponse | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('asOf', asOf);
      params.set('bizUnit', '1');
      const res = await fetch(`/api/erp/wh-stock-list?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setPayload(null);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as WhStockListExcelListResponse;
      if (typeof body.asOf !== 'string' || !Array.isArray(body.items) || !Array.isArray(body.warehouseHeaders)) {
        setPayload(null);
        setError('응답 형식이 올바르지 않습니다.');
        return;
      }
      setPayload(body);
    } catch {
      setPayload(null);
      setError('네트워크 오류로 조회에 실패했습니다.');
    } finally {
      setHasFetched(true);
      setLoading(false);
    }
  }, [asOf]);

  const warehouseHeaders = payload?.warehouseHeaders ?? [];
  const nWh = warehouseHeaders.length;
  const colSpanTitle = 1 + WH_STOCK_LIST_EXCEL_FIXED_COL_HEADERS.length + 1 + 1 + nWh * 2;

  const emptyHint =
    hasFetched && !error && !loading && payload && payload.items.length === 0 && payload.summary == null;

  /** embedded: 부모 높이 불명 시 뷰포트 기준으로 박스 높이 제한. 일반 페이지: 부모가 h-full 줄 때 flex-1로 채움 */
  const tableScrollClass = embedded
    ? 'min-h-0 w-full max-h-[min(72dvh,640px)] overflow-auto border border-black bg-white'
    : 'min-h-0 w-full flex-1 overflow-auto border border-black bg-white';

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
          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="wh-stock-list-asof">
                조회일 (해당 일자까지 누적 재고)
              </label>
              <Input
                id="wh-stock-list-asof"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <Button type="button" onClick={() => void fetchData()} disabled={loading}>
              {loading ? '조회 중…' : '조회'}
            </Button>
          </div>
          {error ? (
            <Alert variant="error">
              <AlertTitle>조회 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {payload?.truncated ? (
            <Alert>
              <AlertTitle>일부만 표시</AlertTitle>
              <AlertDescription>행 수가 상한을 초과하여 앞부분만 반환했습니다. TOTAL 행은 표시된 품목만 합산합니다.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {payload ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          조회일 기준: <strong>{payload.asOf}</strong> · 품목 {payload.items.length}행
          {payload.summary ? <> · TOTAL 행 포함(상단)</> : null}
        </p>
      ) : null}

      <div className={tableScrollClass}>
        <table className="min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className={EIS_TH} colSpan={colSpanTitle}>
                {WH_STOCK_LIST_EXCEL_TITLE}
              </th>
            </tr>
            <tr>
              <th className={EIS_TH} rowSpan={2}>
                순번
              </th>
              {WH_STOCK_LIST_EXCEL_FIXED_COL_HEADERS.map((h) => (
                <th key={h} className={EIS_TH} rowSpan={2}>
                  {h}
                </th>
              ))}
              <th className={EIS_TH} rowSpan={2}>
                재고수량
              </th>
              <th className={EIS_TH}>합계</th>
              {warehouseHeaders.map((name) => (
                <th key={`${name}-h2`} className={EIS_TH} colSpan={2}>
                  {name}
                </th>
              ))}
            </tr>
            <tr>
              <th className={EIS_TH}>추정재고금액</th>
              {warehouseHeaders.flatMap((name) => [
                <th key={`${name}-q`} className={EIS_TH}>
                  재고수량
                </th>,
                <th key={`${name}-a`} className={EIS_TH}>
                  추정재고금액
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {payload?.summary ? (
              <tr className="bg-muted/50 font-semibold">
                <td className={EIS_TD_NUM}>—</td>
                {fixedCells(payload.summary).map((cell, i) => (
                  <td key={`s-f-${i}`} className={EIS_TD_LEFT}>
                    {cell}
                  </td>
                ))}
                <td className={EIS_TD_NUM}>{formatQty(payload.summary.totalQty)}</td>
                <td className={EIS_TD_NUM}>{formatAmt(payload.summary.totalAmt)}</td>
                {whCellsAligned(payload.summary, nWh).flatMap((c, i) => [
                  <td key={`s-q-${i}`} className={EIS_TD_NUM}>
                    {formatQty(c.qty)}
                  </td>,
                  <td key={`s-a-${i}`} className={EIS_TD_NUM}>
                    {formatAmt(c.amt)}
                  </td>,
                ])}
              </tr>
            ) : null}
            {payload?.items.map((row, idx) => {
              const cells = fixedCells(row);
              const wh = whCellsAligned(row, nWh);
              return (
                <tr key={`${row.itemNo ?? ''}-${idx}`}>
                  <td className={EIS_TD_NUM}>{idx + 1}</td>
                  {cells.map((cell, i) => (
                    <td key={`${idx}-f-${i}`} className={EIS_TD_LEFT}>
                      {cell}
                    </td>
                  ))}
                  <td className={EIS_TD_NUM}>{formatQty(row.totalQty)}</td>
                  <td className={EIS_TD_NUM}>{formatAmt(row.totalAmt)}</td>
                  {wh.flatMap((c, i) => [
                    <td key={`${idx}-q-${i}`} className={EIS_TD_NUM}>
                      {formatQty(c.qty)}
                    </td>,
                    <td key={`${idx}-a-${i}`} className={EIS_TD_NUM}>
                      {formatAmt(c.amt)}
                    </td>,
                  ])}
                </tr>
              );
            })}
            {emptyHint ? (
              <tr>
                <td className={EIS_TD} colSpan={Math.max(colSpanTitle, 1)}>
                  조회 결과가 없습니다. 조회일·사업장·수불 데이터를 확인하세요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
