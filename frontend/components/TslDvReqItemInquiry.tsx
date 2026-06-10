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
import { EIS_TABLE_SCROLL_WRAP, EIS_TD, EIS_TD_LEFT, EIS_TD_NUM, EIS_TH } from '@/lib/eis-report-table-classes';
import { defaultMailSendingMenuInquiryDateRange } from '@/lib/erp/inquiry-default-date-range';
import { useCallback, useMemo, useState } from 'react';

/** 백엔드 `TslDvReqItemRow` — 반품요청 품목 조회 열 순서 */
type TslDvReqItemRow = {
  rowNo: number;
  bizUnit: number | null;
  reqSeq: number | null;
  reqNo: string | null;
  reqDate: string;
  umOutKind: number | null;
  outKindName: string | null;
  customerCode: string | null;
  customerName: string | null;
  deptName: string | null;
  empName: string | null;
  lineSerl: number | null;
  itemNo: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  remark: string | null;
  whName: string | null;
  projectName: string | null;
  dueDate: string | null;
  progressStatus: string | null;
};

async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const m = body?.message;
  if (Array.isArray(m)) {
    return m.join(', ');
  }
  if (typeof m === 'string') {
    return m;
  }
  return `요청 실패 (${res.status})`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) {
    return '';
  }
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(n);
}

function cellText(v: string | null | undefined): string {
  if (v == null || v === '') {
    return '';
  }
  return v;
}

export type TslDvReqItemInquiryProps = {
  embedded?: boolean;
};

export function TslDvReqItemInquiry({ embedded = false }: TslDvReqItemInquiryProps) {
  const defaults = useMemo(() => defaultMailSendingMenuInquiryDateRange(), []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TslDvReqItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/tsl-dv-req-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: TslDvReqItemRow[]; truncated: boolean };
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

          <div className={EIS_TABLE_SCROLL_WRAP}>
            <table className="min-w-max border-collapse">
              <thead className="sticky top-0 z-10 bg-[#E7E6E6]">
                <tr>
                  <th className={EIS_TH}>순번</th>
                  <th className={EIS_TH}>요청번호</th>
                  <th className={EIS_TH}>요청일</th>
                  <th className={EIS_TH}>거래처</th>
                  <th className={EIS_TH}>거래처명</th>
                  <th className={EIS_TH}>품목코드</th>
                  <th className={EIS_TH}>품목명</th>
                  <th className={EIS_TH}>규격</th>
                  <th className={EIS_TH}>단위</th>
                  <th className={EIS_TH}>요청수량</th>
                  <th className={EIS_TH}>단가</th>
                  <th className={EIS_TH}>공급가액</th>
                  <th className={EIS_TH}>부가세</th>
                  <th className={EIS_TH}>합계금액</th>
                  <th className={EIS_TH}>비고</th>
                  <th className={EIS_TH}>창고</th>
                  <th className={EIS_TH}>출고구분</th>
                  <th className={EIS_TH}>프로젝트</th>
                  <th className={EIS_TH}>담당자</th>
                  <th className={EIS_TH}>부서</th>
                  <th className={EIS_TH}>납기일</th>
                  <th className={EIS_TH}>진행상태</th>
                  <th className={EIS_TH}>라인순번</th>
                  <th className={EIS_TH}>UM출고코드</th>
                  <th className={EIS_TH}>요청Seq</th>
                  <th className={EIS_TH}>사업장</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td className={EIS_TD} colSpan={26}>
                      {error
                        ? '—'
                        : hasFetched
                          ? '당일 등록된 실적이 없습니다.'
                          : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r) => (
                  <tr key={`${r.reqNo ?? ''}-${r.reqSeq ?? ''}-${r.lineSerl ?? ''}-${r.rowNo}`}>
                    <td className={EIS_TD_NUM}>{r.rowNo}</td>
                    <td className={EIS_TD}>{cellText(r.reqNo)}</td>
                    <td className={EIS_TD}>{cellText(r.reqDate)}</td>
                    <td className={EIS_TD}>{cellText(r.customerCode)}</td>
                    <td className={EIS_TD}>{cellText(r.customerName)}</td>
                    <td className={EIS_TD}>{cellText(r.itemNo)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.itemName)}</td>
                    <td className={EIS_TD}>{cellText(r.spec)}</td>
                    <td className={EIS_TD}>{cellText(r.unit)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.qty)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.unitPrice)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.supplyAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.vatAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.totalAmount)}</td>
                    <td className={EIS_TD}>{cellText(r.remark)}</td>
                    <td className={EIS_TD}>{cellText(r.whName)}</td>
                    <td className={EIS_TD}>{cellText(r.outKindName)}</td>
                    <td className={EIS_TD}>{cellText(r.projectName)}</td>
                    <td className={EIS_TD}>{cellText(r.empName)}</td>
                    <td className={EIS_TD}>{cellText(r.deptName)}</td>
                    <td className={EIS_TD}>{cellText(r.dueDate)}</td>
                    <td className={EIS_TD}>{cellText(r.progressStatus)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.lineSerl)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.umOutKind)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.reqSeq)}</td>
                    <td className={EIS_TD_NUM}>{r.bizUnit ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
