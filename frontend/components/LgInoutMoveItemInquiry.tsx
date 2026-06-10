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
import { defaultMailSendingMenuInquiryDateRange, defaultMonthStartToTodayRange } from '@/lib/erp/inquiry-default-date-range';
import { useCallback, useMemo, useState } from 'react';

export type LgInoutMoveItemRow = {
  rowNo: number;
  outConfirmNo: string | null;
  moveDate: string;
  reviewDate: string | null;
  lastModAt: string | null;
  moveNo: string | null;
  moveReasonKind: string | null;
  refConfirm: string | null;
  writeStatus: string | null;
  receiptDelvReturnKind: string | null;
  itemName: string | null;
  itemCode: string | null;
  spec: string | null;
  unit: string | null;
  moveQty: number | null;
  lotNo: string | null;
  stdUnitQty: number | null;
  outWhName: string | null;
  inWhName: string | null;
  funcKind: string | null;
  processDeptName: string | null;
  chargeEmpName: string | null;
  specialNote: string | null;
  salesCustName: string | null;
  outDeptName: string | null;
  refCustName: string | null;
  moveReqNo: string | null;
  returnNo: string | null;
  cancelYn: string | null;
};

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

function cellText(v: string | null | undefined): string {
  if (v == null || v === '') return '';
  return v;
}

/** 순번 + 데이터 열 28개 */
const COL_COUNT = 29;

export type LgInoutMoveItemInquiryProps = {
  embedded?: boolean;
};

export function LgInoutMoveItemInquiry({ embedded = false }: LgInoutMoveItemInquiryProps) {
  const defaults = useMemo(
    () => (embedded ? defaultMailSendingMenuInquiryDateRange() : defaultMonthStartToTodayRange()),
    [embedded],
  );

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LgInoutMoveItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/lg-inout-move-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: LgInoutMoveItemRow[]; truncated: boolean };
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
                  <th className={EIS_TH}>출고확정번호</th>
                  <th className={EIS_TH}>이동일</th>
                  <th className={EIS_TH}>검토일</th>
                  <th className={EIS_TH}>최종수정일시</th>
                  <th className={EIS_TH}>이동번호</th>
                  <th className={EIS_TH}>이동사유구분</th>
                  <th className={EIS_TH}>참조확인</th>
                  <th className={EIS_TH}>작성상태</th>
                  <th className={EIS_TH}>입고납품반품구분</th>
                  <th className={EIS_TH}>품명</th>
                  <th className={EIS_TH}>품번</th>
                  <th className={EIS_TH}>규격</th>
                  <th className={EIS_TH}>단위</th>
                  <th className={EIS_TH}>이동수량</th>
                  <th className={EIS_TH}>Lot No.</th>
                  <th className={EIS_TH}>기준단위수량</th>
                  <th className={EIS_TH}>출고창고</th>
                  <th className={EIS_TH}>입고창고</th>
                  <th className={EIS_TH}>기능구분</th>
                  <th className={EIS_TH}>처리부서</th>
                  <th className={EIS_TH}>담당자</th>
                  <th className={EIS_TH}>특기사항</th>
                  <th className={EIS_TH}>판매처거래처명</th>
                  <th className={EIS_TH}>출고부서명</th>
                  <th className={EIS_TH}>참조거래처</th>
                  <th className={EIS_TH}>이동요청번호</th>
                  <th className={EIS_TH}>반품번호</th>
                  <th className={EIS_TH}>취소</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td className={EIS_TD} colSpan={COL_COUNT}>
                      {error
                        ? '—'
                        : hasFetched
                          ? '해당 기간에 조회된 데이터가 없습니다. 헤더·라인 InOutType=80, _TLGInoutDaily.InOutDate 범위, ERP_LG_INOUT_COMPANY_SEQ를 확인하세요.'
                          : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r, idx) => (
                  <tr key={`${r.moveNo ?? ''}-${idx}`}>
                    <td className={EIS_TD_NUM}>{formatNumber(r.rowNo)}</td>
                    <td className={EIS_TD}>{cellText(r.outConfirmNo)}</td>
                    <td className={EIS_TD}>{cellText(r.moveDate)}</td>
                    <td className={EIS_TD}>{cellText(r.reviewDate)}</td>
                    <td className={EIS_TD}>{cellText(r.lastModAt)}</td>
                    <td className={EIS_TD}>{cellText(r.moveNo)}</td>
                    <td className={EIS_TD}>{cellText(r.moveReasonKind)}</td>
                    <td className={EIS_TD}>{cellText(r.refConfirm)}</td>
                    <td className={EIS_TD}>{cellText(r.writeStatus)}</td>
                    <td className={EIS_TD}>{cellText(r.receiptDelvReturnKind)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.itemName)}</td>
                    <td className={EIS_TD}>{cellText(r.itemCode)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.spec)}</td>
                    <td className={EIS_TD}>{cellText(r.unit)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.moveQty)}</td>
                    <td className={EIS_TD}>{cellText(r.lotNo)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.stdUnitQty)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.outWhName)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.inWhName)}</td>
                    <td className={EIS_TD}>{cellText(r.funcKind)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.processDeptName)}</td>
                    <td className={EIS_TD}>{cellText(r.chargeEmpName)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.specialNote)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.salesCustName)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.outDeptName)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.refCustName)}</td>
                    <td className={EIS_TD}>{cellText(r.moveReqNo)}</td>
                    <td className={EIS_TD}>{cellText(r.returnNo)}</td>
                    <td className={EIS_TD}>{cellText(r.cancelYn)}</td>
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
