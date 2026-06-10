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

/** 백엔드 `PuDelvItemRow` — 엑셀「구매납품품목조회」데이터 열 순서(선택 제외) */
export type PuDelvItemRow = {
  rowNo: number;
  bizUnit: number | null;
  delvDate: string;
  delvNo: string | null;
  purOrderDate: string | null;
  purOrderNo: string | null;
  customerName: string | null;
  customerCode: string | null;
  delvKind: string | null;
  recvProgressStatus: string | null;
  delvDept: string | null;
  delvChargePerson: string | null;
  inspectionKind: string | null;
  itemName: string | null;
  itemCode: string | null;
  spec: string | null;
  unit: string | null;
  unitPrice: number | null;
  qty: number | null;
  vatIncluded: string | null;
  vatRate: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  exchangeRate: number | null;
  domSupplyAmount: number | null;
  domVatAmount: number | null;
  domTotalAmount: number | null;
  inQty: number | null;
  inAmount: number | null;
  inDomAmount: number | null;
  localForeignKind: string | null;
  whName: string | null;
  manufacturer: string | null;
  itemAssetClass: string | null;
  validUntilDate: string | null;
  okQty: number | null;
  ngQty: number | null;
  ngReturnQty: number | null;
  specialNote: string | null;
  remark: string | null;
  sourceInquiry: string | null;
  progressInquiry: string | null;
  sourceMgmtNo: string | null;
  sourceNo: string | null;
  custLotNo: string | null;
  lastWorkDatetime: string | null;
  itemClassL: string | null;
  itemClassM: string | null;
  itemClassS: string | null;
};

const PDV_COLS: { key: keyof PuDelvItemRow; label: string; numeric?: boolean; left?: boolean }[] = [
  { key: 'rowNo', label: '순번', numeric: true },
  { key: 'bizUnit', label: '사업단위', numeric: true },
  { key: 'delvDate', label: '납품일' },
  { key: 'delvNo', label: '납품번호' },
  { key: 'purOrderDate', label: '발주일' },
  { key: 'purOrderNo', label: '발주번호', left: true },
  { key: 'customerName', label: '구매거래처', left: true },
  { key: 'customerCode', label: '구매처번호' },
  { key: 'delvKind', label: '납품구분' },
  { key: 'recvProgressStatus', label: '입고진행상태' },
  { key: 'delvDept', label: '납품부서' },
  { key: 'delvChargePerson', label: '납품담당자' },
  { key: 'inspectionKind', label: '검사구분' },
  { key: 'itemName', label: '품명', left: true },
  { key: 'itemCode', label: '품번' },
  { key: 'spec', label: '규격' },
  { key: 'unit', label: '단위' },
  { key: 'unitPrice', label: '납품단가', numeric: true },
  { key: 'qty', label: '납품수량', numeric: true },
  { key: 'vatIncluded', label: '부가세포함여부' },
  { key: 'vatRate', label: '부가세율', numeric: true },
  { key: 'supplyAmount', label: '금액', numeric: true },
  { key: 'vatAmount', label: '부가세', numeric: true },
  { key: 'totalAmount', label: '금액계', numeric: true },
  { key: 'currency', label: '통화' },
  { key: 'exchangeRate', label: '환율', numeric: true },
  { key: 'domSupplyAmount', label: '원화금액', numeric: true },
  { key: 'domVatAmount', label: '원화부가세', numeric: true },
  { key: 'domTotalAmount', label: '원화금액계', numeric: true },
  { key: 'inQty', label: '입고수량', numeric: true },
  { key: 'inAmount', label: '입고금액', numeric: true },
  { key: 'inDomAmount', label: '입고원화금액', numeric: true },
  { key: 'localForeignKind', label: '내외자구분' },
  { key: 'whName', label: '창고' },
  { key: 'manufacturer', label: '제조사', left: true },
  { key: 'itemAssetClass', label: '품목자산분류' },
  { key: 'validUntilDate', label: '유효일자' },
  { key: 'okQty', label: '합격수량', numeric: true },
  { key: 'ngQty', label: '불합격수량', numeric: true },
  { key: 'ngReturnQty', label: '불합격반품수량', numeric: true },
  { key: 'specialNote', label: '특이사항', left: true },
  { key: 'remark', label: '비고', left: true },
  { key: 'sourceInquiry', label: '원천조회' },
  { key: 'progressInquiry', label: '진행조회' },
  { key: 'sourceMgmtNo', label: '원천관리번호', left: true },
  { key: 'sourceNo', label: '원천번호', left: true },
  { key: 'custLotNo', label: '고객LotNo' },
  { key: 'lastWorkDatetime', label: '최종작업일시' },
  { key: 'itemClassL', label: '품목대분류' },
  { key: 'itemClassM', label: '품목중분류' },
  { key: 'itemClassS', label: '품목소분류' },
];

const COL_COUNT = PDV_COLS.length;

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

export type PuDelvItemInquiryProps = {
  embedded?: boolean;
};

export function PuDelvItemInquiry({ embedded = false }: PuDelvItemInquiryProps) {
  const defaults = useMemo(() => defaultMailSendingMenuInquiryDateRange(), []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PuDelvItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/pu-delv-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: PuDelvItemRow[]; truncated: boolean };
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
                  {PDV_COLS.map((c) => (
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
                          ? '당일 등록된 실적이 없습니다.'
                          : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r, idx) => (
                  <tr key={`${r.delvNo ?? ''}-${r.itemCode ?? ''}-${idx}`}>
                    {PDV_COLS.map((c) => {
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
