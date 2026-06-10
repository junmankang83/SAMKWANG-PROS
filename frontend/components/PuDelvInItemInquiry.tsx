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

/** 엑셀(구매입고/반품품목조회) 29열 순서 */
export type PuDelvInItemRow = {
  rowNo: number;
  bizUnit: number | null;
  receiptDate: string;
  receiptNo: string | null;
  lineSerl: number | null;
  customerCode: string | null;
  customerName: string | null;
  receiptKind: string | null;
  whCode: number | null;
  whName: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  managementUnit: string | null;
  qty: number | null;
  unitPrice: number | null;
  foreignUnitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  foreignAmount: number | null;
  projectCode: string | null;
  projectName: string | null;
  purOrderNo: string | null;
  purOrderSerl: number | null;
  inspectionNo: string | null;
  inspectionSerl: number | null;
  remark: string | null;
  assetKind: string | null;
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

const COL_COUNT = 29;

export type PuDelvInItemInquiryProps = {
  embedded?: boolean;
};

export function PuDelvInItemInquiry({ embedded = false }: PuDelvInItemInquiryProps) {
  const defaults = useMemo(() => defaultMailSendingMenuInquiryDateRange(), []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PuDelvInItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/pu-delv-in-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: PuDelvInItemRow[]; truncated: boolean };
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
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => void fetchData()}
              disabled={loading}
            >
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
                  <th className={EIS_TH}>사업장</th>
                  <th className={EIS_TH}>입고일</th>
                  <th className={EIS_TH}>입고번호</th>
                  <th className={EIS_TH}>거래처</th>
                  <th className={EIS_TH}>거래처명</th>
                  <th className={EIS_TH}>입고구분</th>
                  <th className={EIS_TH}>창고</th>
                  <th className={EIS_TH}>창고명</th>
                  <th className={EIS_TH}>품목코드</th>
                  <th className={EIS_TH}>품목명</th>
                  <th className={EIS_TH}>규격</th>
                  <th className={EIS_TH}>단위</th>
                  <th className={EIS_TH}>관리단위</th>
                  <th className={EIS_TH}>수량</th>
                  <th className={EIS_TH}>단가</th>
                  <th className={EIS_TH}>외화단가</th>
                  <th className={EIS_TH}>공급가액</th>
                  <th className={EIS_TH}>부가세</th>
                  <th className={EIS_TH}>합계금액</th>
                  <th className={EIS_TH}>외화금액</th>
                  <th className={EIS_TH}>프로젝트</th>
                  <th className={EIS_TH}>프로젝트명</th>
                  <th className={EIS_TH}>발주번호</th>
                  <th className={EIS_TH}>발주순번</th>
                  <th className={EIS_TH}>검사번호</th>
                  <th className={EIS_TH}>검사순번</th>
                  <th className={EIS_TH}>비고</th>
                  <th className={EIS_TH}>자산구분</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td className={EIS_TD} colSpan={COL_COUNT}>
                      {error ? '—' : hasFetched ? '당일 등록된 실적이 없습니다.' : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r, idx) => (
                  <tr key={`${r.receiptNo ?? ''}-${r.lineSerl ?? idx}-${idx}`}>
                    <td className={EIS_TD_NUM}>{formatNumber(r.rowNo)}</td>
                    <td className={EIS_TD_NUM}>{r.bizUnit ?? ''}</td>
                    <td className={EIS_TD}>{cellText(r.receiptDate)}</td>
                    <td className={EIS_TD}>{cellText(r.receiptNo)}</td>
                    <td className={EIS_TD}>{cellText(r.customerCode)}</td>
                    <td className={EIS_TD}>{cellText(r.customerName)}</td>
                    <td className={EIS_TD}>{cellText(r.receiptKind)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.whCode)}</td>
                    <td className={EIS_TD}>{cellText(r.whName)}</td>
                    <td className={EIS_TD}>{cellText(r.itemCode)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.itemName)}</td>
                    <td className={EIS_TD}>{cellText(r.spec)}</td>
                    <td className={EIS_TD}>{cellText(r.unit)}</td>
                    <td className={EIS_TD}>{cellText(r.managementUnit)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.qty)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.unitPrice)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.foreignUnitPrice)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.supplyAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.vatAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.totalAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.foreignAmount)}</td>
                    <td className={EIS_TD}>{cellText(r.projectCode)}</td>
                    <td className={EIS_TD}>{cellText(r.projectName)}</td>
                    <td className={EIS_TD}>{cellText(r.purOrderNo)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.purOrderSerl)}</td>
                    <td className={EIS_TD}>{cellText(r.inspectionNo)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.inspectionSerl)}</td>
                    <td className={EIS_TD}>{cellText(r.remark)}</td>
                    <td className={EIS_TD}>{cellText(r.assetKind)}</td>
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
