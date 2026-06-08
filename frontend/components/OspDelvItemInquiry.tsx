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

/** 백엔드 `OspDelvItemRow` — ERP「외주납품품목조회」그리드 열 */
export type OspDelvItemRow = {
  rowNo: number;
  status: string | null;
  bizUnit: number | null;
  delvNo: string | null;
  lineSerl: number | null;
  delvDate: string;
  outsourceVendorName: string | null;
  recvVendorName: string | null;
  chargePerson: string | null;
  delvKind: string | null;
  recvProgressStatus: string | null;
  itemCode: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  exchangeRate: number | null;
  foreignSupplyAmount: number | null;
  foreignVatAmount: number | null;
  foreignTotalAmount: number | null;
  whName: string | null;
  storageLocation: string | null;
  remark: string | null;
  purOrderNo: string | null;
  purOrderSerl: number | null;
  purOrderDate: string | null;
  regUser: string | null;
  regDateTime: string | null;
};

const OSP_COLS: { key: keyof OspDelvItemRow; label: string; numeric?: boolean; left?: boolean }[] = [
  { key: 'status', label: '상태' },
  { key: 'rowNo', label: '순번', numeric: true },
  { key: 'delvNo', label: '납품번호' },
  { key: 'lineSerl', label: '납품순번', numeric: true },
  { key: 'delvDate', label: '납품일자' },
  { key: 'outsourceVendorName', label: '외주처명', left: true },
  { key: 'recvVendorName', label: '납품처명', left: true },
  { key: 'chargePerson', label: '담당자' },
  { key: 'delvKind', label: '납품구분' },
  { key: 'recvProgressStatus', label: '입고진행상태' },
  { key: 'itemCode', label: '품목코드' },
  { key: 'itemName', label: '품목명', left: true },
  { key: 'spec', label: '규격' },
  { key: 'unit', label: '단위' },
  { key: 'qty', label: '납품수량', numeric: true },
  { key: 'unitPrice', label: '단가', numeric: true },
  { key: 'supplyAmount', label: '금액', numeric: true },
  { key: 'vatAmount', label: '부가세', numeric: true },
  { key: 'totalAmount', label: '합계', numeric: true },
  { key: 'currency', label: '통화' },
  { key: 'exchangeRate', label: '환율', numeric: true },
  { key: 'foreignSupplyAmount', label: '외화금액', numeric: true },
  { key: 'foreignVatAmount', label: '외화부가세', numeric: true },
  { key: 'foreignTotalAmount', label: '외화합계', numeric: true },
  { key: 'whName', label: '창고', left: true },
  { key: 'storageLocation', label: '보관장소', left: true },
  { key: 'remark', label: '비고', left: true },
  { key: 'purOrderNo', label: '발주번호', left: true },
  { key: 'purOrderSerl', label: '발주순번', numeric: true },
  { key: 'purOrderDate', label: '발주일자' },
  { key: 'regUser', label: '등록자' },
  { key: 'regDateTime', label: '등록일시' },
  { key: 'bizUnit', label: '사업장', numeric: true },
];

const COL_COUNT = OSP_COLS.length;

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

export type OspDelvItemInquiryProps = {
  embedded?: boolean;
};

export function OspDelvItemInquiry({ embedded = false }: OspDelvItemInquiryProps) {
  const defaults = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toYmd(start), to: toYmd(today) };
  }, []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OspDelvItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/osp-delv-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: OspDelvItemRow[]; truncated: boolean };
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
                  {OSP_COLS.map((c) => (
                    <th key={c.key} className={EIS_TH}>
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
                          ? '해당 기간에 조회된 데이터가 없습니다.'
                          : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r, idx) => (
                  <tr key={`${r.delvNo ?? ''}-${r.lineSerl ?? ''}-${r.itemCode ?? ''}-${idx}`}>
                    {OSP_COLS.map((c) => {
                      const v = r[c.key];
                      const tdClass = c.left ? EIS_TD_LEFT : c.numeric ? EIS_TD_NUM : EIS_TD;
                      const text =
                        c.numeric && (typeof v === 'number' || v == null)
                          ? formatNumber(v as number | null)
                          : cellText(v as string | null);
                      return (
                        <td key={c.key} className={tdClass}>
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
