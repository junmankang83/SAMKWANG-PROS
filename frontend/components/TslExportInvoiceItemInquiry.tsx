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
import { useCallback, useMemo, useState } from 'react';

/** 백엔드 `TslExportInvoiceItemRow` — 수출 Invoice 품목 조회 열 순서(엑셀 그리드와 동일) */
type TslExportInvoiceItemRow = {
  rowNo: number;
  category: string | null;
  invoiceNo: string | null;
  invoiceDate: string;
  customer: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  foreignAmount: number | null;
  remark: string | null;
  exportKind: string | null;
  shipDate: string;
  portOfLoading: string | null;
  destination: string | null;
  incoterms: string | null;
  paymentTerms: string | null;
  currencyName: string | null;
  exchangeRate: number | null;
  hsCode: string | null;
  originCountry: string | null;
  netWeight: number | null;
  grossWeight: number | null;
  measurement: string | null;
  cartonNo: string | null;
  exportDeclNo: string | null;
  exportDeclDate: string;
  licenseNo: string | null;
  licenseDate: string;
  lcNo: string | null;
  blNo: string | null;
  vesselName: string | null;
  voyageNo: string | null;
  etd: string;
  eta: string;
  transportMeans: string | null;
  packMethod: string | null;
  packQty: number | null;
  packUnit: string | null;
  project: string | null;
  bizUnit: number | null;
};

type ColDef = {
  key: keyof TslExportInvoiceItemRow;
  label: string;
  numeric?: boolean;
  left?: boolean;
};

const EXP_COLS: ColDef[] = [
  { key: 'rowNo', label: '순번', numeric: true },
  { key: 'category', label: '구분', left: true },
  { key: 'invoiceNo', label: 'Invoice No.' },
  { key: 'invoiceDate', label: 'Invoice일자' },
  { key: 'customer', label: '거래처', left: true },
  { key: 'itemCode', label: '품목코드' },
  { key: 'itemName', label: '품목명', left: true },
  { key: 'spec', label: '규격' },
  { key: 'unit', label: '단위' },
  { key: 'qty', label: '수량', numeric: true },
  { key: 'unitPrice', label: '단가', numeric: true },
  { key: 'amount', label: '금액', numeric: true },
  { key: 'foreignAmount', label: '외화금액', numeric: true },
  { key: 'remark', label: '비고', left: true },
  { key: 'exportKind', label: '수출구분' },
  { key: 'shipDate', label: '선적일자' },
  { key: 'portOfLoading', label: '선적지', left: true },
  { key: 'destination', label: '도착지', left: true },
  { key: 'incoterms', label: '인코텀즈' },
  { key: 'paymentTerms', label: '결제조건', left: true },
  { key: 'currencyName', label: '통화' },
  { key: 'exchangeRate', label: '환율', numeric: true },
  { key: 'hsCode', label: 'HS Code' },
  { key: 'originCountry', label: '원산지' },
  { key: 'netWeight', label: 'Net Weight', numeric: true },
  { key: 'grossWeight', label: 'Gross Weight', numeric: true },
  { key: 'measurement', label: 'Measurement', left: true },
  { key: 'cartonNo', label: 'Carton No.' },
  { key: 'exportDeclNo', label: '수출신고번호' },
  { key: 'exportDeclDate', label: '수출신고일자' },
  { key: 'licenseNo', label: '면장번호' },
  { key: 'licenseDate', label: '면장일자' },
  { key: 'lcNo', label: 'L/C No.' },
  { key: 'blNo', label: 'B/L No.' },
  { key: 'vesselName', label: '선명', left: true },
  { key: 'voyageNo', label: '항차' },
  { key: 'etd', label: 'ETD' },
  { key: 'eta', label: 'ETA' },
  { key: 'transportMeans', label: '운송수단', left: true },
  { key: 'packMethod', label: '포장방법', left: true },
  { key: 'packQty', label: '포장수량', numeric: true },
  { key: 'packUnit', label: '포장단위' },
  { key: 'project', label: '프로젝트', left: true },
  { key: 'bizUnit', label: '사업장', numeric: true },
];

const COL_COUNT = EXP_COLS.length;

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

export type TslExportInvoiceItemInquiryProps = {
  embedded?: boolean;
};

export function TslExportInvoiceItemInquiry({ embedded = false }: TslExportInvoiceItemInquiryProps) {
  const defaults = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toYmd(start), to: toYmd(today) };
  }, []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TslExportInvoiceItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/tsl-export-invoice-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: TslExportInvoiceItemRow[]; truncated: boolean };
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
                  {EXP_COLS.map((c) => (
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
                          ? '당일 등록된 실적이 없습니다.'
                          : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r, idx) => (
                  <tr key={`${r.invoiceNo ?? ''}-${r.itemCode ?? ''}-${idx}`}>
                    {EXP_COLS.map((c) => {
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
