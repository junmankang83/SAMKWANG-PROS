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

/** 백엔드 `TslExportReturnInvoiceItemRow` — ERP「수출반품품목조회」 열 순 */
type TslExportReturnInvoiceItemRow = {
  rowNo: number;
  status: string | null;
  siteName: string | null;
  invoiceNo: string | null;
  invoiceDate: string;
  customerCode: string | null;
  customerName: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  currencyName: string | null;
  exchangeRate: number | null;
  unitPrice: number | null;
  qty: number | null;
  foreignAmount: number | null;
  amount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  warehouseName: string | null;
  chargePersonName: string | null;
  lotNo: string | null;
  exportDeclNo: string | null;
  remark: string | null;
  exportKind: string | null;
};

type ColDef = {
  key: keyof TslExportReturnInvoiceItemRow;
  label: string;
  numeric?: boolean;
  left?: boolean;
};

const RET_COLS: ColDef[] = [
  { key: 'rowNo', label: '순번', numeric: true },
  { key: 'status', label: '상태' },
  { key: 'siteName', label: '사업장', left: true },
  { key: 'invoiceNo', label: 'Invoice No.' },
  { key: 'invoiceDate', label: 'Invoice일자' },
  { key: 'customerCode', label: '거래처' },
  { key: 'customerName', label: '거래처명', left: true },
  { key: 'itemCode', label: '품목코드' },
  { key: 'itemName', label: '품목명', left: true },
  { key: 'spec', label: '규격' },
  { key: 'unit', label: '단위' },
  { key: 'currencyName', label: '화폐' },
  { key: 'exchangeRate', label: '환율', numeric: true },
  { key: 'unitPrice', label: '단가', numeric: true },
  { key: 'qty', label: '수량', numeric: true },
  { key: 'foreignAmount', label: '외화금액', numeric: true },
  { key: 'amount', label: '원화금액', numeric: true },
  { key: 'vatAmount', label: '부가세', numeric: true },
  { key: 'totalAmount', label: '합계금액', numeric: true },
  { key: 'warehouseName', label: '창고', left: true },
  { key: 'chargePersonName', label: '담당자', left: true },
  { key: 'lotNo', label: 'Lot No.' },
  { key: 'exportDeclNo', label: '수출신고번호' },
  { key: 'remark', label: '비고', left: true },
  { key: 'exportKind', label: '수출구분(SMExpKind)' },
];

const COL_COUNT = RET_COLS.length;

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

export type TslExportReturnInvoiceItemInquiryProps = {
  embedded?: boolean;
};

export function TslExportReturnInvoiceItemInquiry({ embedded = false }: TslExportReturnInvoiceItemInquiryProps) {
  const defaults = useMemo(() => defaultMailSendingMenuInquiryDateRange(), []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TslExportReturnInvoiceItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/tsl-export-return-invoice-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: TslExportReturnInvoiceItemRow[]; truncated: boolean };
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
                  {RET_COLS.map((c) => (
                    <th key={String(c.key)} className={EIS_TH}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td className={EIS_TD} colSpan={COL_COUNT}>
                      {error
                        ? '—'
                        : hasFetched
                          ? '조회 결과가 없습니다. 일자·법인(ERP_TSL_INVOICE_COMPANY_SEQ)을 확인하거나, 반품(음수) 라인이 없을 수 있습니다.'
                          : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r, idx) => (
                  <tr key={`${r.invoiceNo ?? ''}-${r.itemCode ?? ''}-${idx}`}>
                    {RET_COLS.map((c) => {
                      const v = r[c.key];
                      const tdClass = c.left ? EIS_TD_LEFT : c.numeric ? EIS_TD_NUM : EIS_TD;
                      const text =
                        c.numeric && (typeof v === 'number' || v == null)
                          ? formatNumber(v as number | null)
                          : cellText(v as string | null);
                      return (
                        <td key={String(c.key)} className={tdClass}>
                          {text}
                        </td>
                      );
                    })}
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
