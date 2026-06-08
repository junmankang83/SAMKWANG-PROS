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
import { EIS_TABLE_SCROLL_WRAP, EIS_TD, EIS_TD_LEFT, EIS_TD_NUM } from '@/lib/eis-report-table-classes';
import { useCallback, useMemo, useState } from 'react';

/** 백엔드 `TslSalesDailyAnalysisRow` — ERP 일자별판매실적분석 열 순서 */
type TslSalesDailyAnalysisRow = {
  rowNo: number;
  divisionKind: string | null;
  invoiceCompanyNo: string | null;
  invoiceCompanyDate: string;
  customerName: string | null;
  customerBizUnit: string | null;
  salesKind: string | null;
  itemAccount: string | null;
  deptName: string | null;
  empName: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmountForeignText: string | null;
  currency: string | null;
  exchangeRate: number | null;
  wonAmount: number | null;
  salesAmount: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  costUnitPriceForeign: number | null;
  costUnitPriceWon: number | null;
  costAmountWon: number | null;
  itemCode: string | null;
  itemClassName: string | null;
  itemGroupName: string | null;
  salesGroupName: string | null;
  orderNo: string | null;
  orderSerl: string | null;
  instructNo: string | null;
  instructSerl: string | null;
  shipNo: string | null;
  shipSerl: string | null;
};

const TH_GREEN =
  'whitespace-nowrap border border-black bg-emerald-700 px-1.5 py-2 text-center text-[11px] font-bold text-white';

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

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export type TslSalesDailyAnalysisInquiryProps = {
  embedded?: boolean;
};

const EMPTY_COLSPAN = 36;

export function TslSalesDailyAnalysisInquiry({ embedded = false }: TslSalesDailyAnalysisInquiryProps) {
  const defaults = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toYmd(start), to: toYmd(today) };
  }, []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TslSalesDailyAnalysisRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/tsl-sales-daily-analysis?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: TslSalesDailyAnalysisRow[]; truncated: boolean };
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
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={TH_GREEN}>순번</th>
                  <th className={TH_GREEN}>구분</th>
                  <th className={TH_GREEN}>업체번호</th>
                  <th className={TH_GREEN}>업체일자</th>
                  <th className={TH_GREEN}>거래처</th>
                  <th className={TH_GREEN}>거래처사업부</th>
                  <th className={TH_GREEN}>영업구분</th>
                  <th className={TH_GREEN}>품목계정</th>
                  <th className={TH_GREEN}>부서</th>
                  <th className={TH_GREEN}>담당자</th>
                  <th className={TH_GREEN}>품명</th>
                  <th className={TH_GREEN}>규격</th>
                  <th className={TH_GREEN}>단위</th>
                  <th className={TH_GREEN}>수량</th>
                  <th className={TH_GREEN}>단가</th>
                  <th className={TH_GREEN}>공급가액(외화)</th>
                  <th className={TH_GREEN}>통화</th>
                  <th className={TH_GREEN}>환율</th>
                  <th className={TH_GREEN}>원화가액</th>
                  <th className={TH_GREEN}>판매가액</th>
                  <th className={TH_GREEN}>공급가액</th>
                  <th className={TH_GREEN}>부가세액</th>
                  <th className={TH_GREEN}>합계금액</th>
                  <th className={TH_GREEN}>원가단가(외화)</th>
                  <th className={TH_GREEN}>원가단가(원화)</th>
                  <th className={TH_GREEN}>원가금액(원화)</th>
                  <th className={TH_GREEN}>품목코드</th>
                  <th className={TH_GREEN}>품목분류</th>
                  <th className={TH_GREEN}>품목그룹</th>
                  <th className={TH_GREEN}>영업그룹</th>
                  <th className={TH_GREEN}>수주번호</th>
                  <th className={TH_GREEN}>수주순번</th>
                  <th className={TH_GREEN}>지시번호</th>
                  <th className={TH_GREEN}>지시순번</th>
                  <th className={TH_GREEN}>출고번호</th>
                  <th className={TH_GREEN}>출고순번</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td className={EIS_TD} colSpan={EMPTY_COLSPAN}>
                      {error
                        ? '—'
                        : hasFetched
                          ? '조회 결과가 없습니다.'
                          : '일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r) => (
                  <tr key={String(r.rowNo)}>
                    <td className={EIS_TD_NUM}>{r.rowNo}</td>
                    <td className={EIS_TD}>{cellText(r.divisionKind)}</td>
                    <td className={EIS_TD}>{cellText(r.invoiceCompanyNo)}</td>
                    <td className={EIS_TD}>{cellText(r.invoiceCompanyDate)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.customerName)}</td>
                    <td className={EIS_TD}>{cellText(r.customerBizUnit)}</td>
                    <td className={EIS_TD}>{cellText(r.salesKind)}</td>
                    <td className={EIS_TD}>{cellText(r.itemAccount)}</td>
                    <td className={EIS_TD}>{cellText(r.deptName)}</td>
                    <td className={EIS_TD}>{cellText(r.empName)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.itemName)}</td>
                    <td className={EIS_TD}>{cellText(r.spec)}</td>
                    <td className={EIS_TD}>{cellText(r.unit)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.qty)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.unitPrice)}</td>
                    <td className={EIS_TD_LEFT}>{cellText(r.supplyAmountForeignText)}</td>
                    <td className={EIS_TD}>{cellText(r.currency)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.exchangeRate)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.wonAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.salesAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.supplyAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.vatAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.totalAmount)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.costUnitPriceForeign)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.costUnitPriceWon)}</td>
                    <td className={EIS_TD_NUM}>{formatNumber(r.costAmountWon)}</td>
                    <td className={EIS_TD}>{cellText(r.itemCode)}</td>
                    <td className={EIS_TD}>{cellText(r.itemClassName)}</td>
                    <td className={EIS_TD}>{cellText(r.itemGroupName)}</td>
                    <td className={EIS_TD}>{cellText(r.salesGroupName)}</td>
                    <td className={EIS_TD}>{cellText(r.orderNo)}</td>
                    <td className={EIS_TD}>{cellText(r.orderSerl)}</td>
                    <td className={EIS_TD}>{cellText(r.instructNo)}</td>
                    <td className={EIS_TD}>{cellText(r.instructSerl)}</td>
                    <td className={EIS_TD}>{cellText(r.shipNo)}</td>
                    <td className={EIS_TD}>{cellText(r.shipSerl)}</td>
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
