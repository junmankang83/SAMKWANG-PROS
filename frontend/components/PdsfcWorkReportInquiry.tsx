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
  EIS_TABLE_SCROLL_WRAP,
  EIS_TD,
  EIS_TD_LEFT,
  EIS_TD_NUM,
  EIS_TH,
} from '@/lib/eis-report-table-classes';
import { defaultMailSendingMenuInquiryDateRange, defaultMonthStartToTodayRange } from '@/lib/erp/inquiry-default-date-range';
import { useCallback, useMemo, useState } from 'react';

import { PDSFC_SKKR_EXCEL_COLUMNS, type PdsfcWorkReportRow } from '@/lib/erp/pdsfc-skkr-excel-columns';

export type { PdsfcWorkReportRow } from '@/lib/erp/pdsfc-skkr-excel-columns';

const COL_COUNT = 1 + PDSFC_SKKR_EXCEL_COLUMNS.length;

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const m = body?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return `요청 실패 (${res.status})`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(n);
}

function skkrCellDisplay(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return formatNumber(v);
  return String(v);
}

export type PdsfcWorkReportInquiryProps = {
  embedded?: boolean;
};

export function PdsfcWorkReportInquiry({ embedded = false }: PdsfcWorkReportInquiryProps) {
  const defaults = useMemo(
    () => (embedded ? defaultMailSendingMenuInquiryDateRange() : defaultMonthStartToTodayRange()),
    [embedded],
  );

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PdsfcWorkReportRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/pdsfc-work-report?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: PdsfcWorkReportRow[]; truncated: boolean };
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

  return (
    <div className={embedded ? 'flex flex-col gap-3' : 'flex flex-col gap-4 p-4'}>
      <Card className={embedded ? 'border-app-border shadow-card' : 'border-app-border shadow-none'}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex w-full flex-wrap items-end justify-end gap-2 sm:gap-3">
            <label className="flex shrink-0 flex-col gap-0.5">
              <span className="text-[11px] font-medium text-app-muted">시작일</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={loading}
                className="h-8 w-[9.5rem] text-xs"
              />
            </label>
            <label className="flex shrink-0 flex-col gap-0.5">
              <span className="text-[11px] font-medium text-app-muted">종료일</span>
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

          {emptyHint ? (
            <p className="text-xs text-app-muted">
              해당 기간에 행이 없습니다. 날짜 범위를 넓히거나, 서버 환경 변수{' '}
              <code className="rounded bg-app-muted/20 px-1">ERP_PDSFC_WORK_REPORT_COMPANY_SEQ</code>가 실제 법인과
              맞는지(비우면 전체) 확인해 보세요.
            </p>
          ) : null}

          <div className={EIS_TABLE_SCROLL_WRAP}>
            <table className="min-w-max border-collapse">
              <thead className="sticky top-0 z-10 bg-[#E7E6E6]">
                <tr>
                  <th className={EIS_TH}>순번</th>
                  {PDSFC_SKKR_EXCEL_COLUMNS.map((c) => (
                    <th key={c.key} className={EIS_TH}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!hasFetched || items.length === 0 ? (
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
                  items.map((r) => (
                    <tr
                      key={`${r.rowNo}-${String(r.workDate ?? '')}-${String(r.workOrderNo ?? '')}-${String(r.productNo ?? '')}`}
                    >
                      <td className={EIS_TD}>{r.rowNo}</td>
                      {PDSFC_SKKR_EXCEL_COLUMNS.map((c) => {
                        const v = r[c.key];
                        const isNum = typeof v === 'number' && !Number.isNaN(v);
                        const cls = isNum ? EIS_TD_NUM : EIS_TD_LEFT;
                        return (
                          <td key={c.key} className={cls}>
                            {skkrCellDisplay(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
