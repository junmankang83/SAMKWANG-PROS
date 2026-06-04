'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@samkwang/ui-kit';
import { useCallback, useMemo, useState } from 'react';

/** 엑셀(거래명세서품목조회) 컬럼 순서와 동일 */
type TslInvoiceItemRow = {
  rowNo: number;
  bizUnit: number | null;
  invoiceNo: string | null;
  invoiceDate: string;
  customerCode: string | null;
  customerName: string | null;
  outboundWhCode: number | null;
  outboundWhName: string | null;
  chargePersonName: string | null;
  chargeDeptName: string | null;
  itemNo: string | null;
  itemName: string | null;
  spec: string | null;
  unit: string | null;
  managementUnit: string | null;
  qty: number | null;
  unitPrice: number | null;
  supplyAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  foreignUnitPrice: number | null;
  foreignAmount: number | null;
  exchangeRate: number | null;
  currencyName: string | null;
  remark: string | null;
  projectCode: string | null;
  projectName: string | null;
  inspectionKind: string | null;
  inboundWhCode: number | null;
  inboundWhName: string | null;
  lotNo: string | null;
  productionDate: string | null;
  expiryDate: string | null;
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

const TH =
  'whitespace-nowrap border border-emerald-800/40 bg-emerald-600 px-1.5 py-2 text-center text-[11px] font-semibold text-white';
/** 품명 제외 전열 가운데 정렬 */
const TD = 'whitespace-nowrap border border-app-border px-1.5 py-1 text-center text-[11px] text-app-text';
const TD_ITEM_NAME =
  'whitespace-nowrap border border-app-border px-1.5 py-1 text-left text-[11px] text-app-text';

export type TslInvoiceItemInquiryProps = {
  embedded?: boolean;
};

export function TslInvoiceItemInquiry({ embedded = false }: TslInvoiceItemInquiryProps) {
  const defaults = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toYmd(start), to: toYmd(today) };
  }, []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TslInvoiceItemRow[]>([]);
  const [truncated, setTruncated] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/erp/tsl-invoice-items?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setItems([]);
        setTruncated(false);
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { items: TslInvoiceItemRow[]; truncated: boolean };
      setItems(Array.isArray(body.items) ? body.items : []);
      setTruncated(Boolean(body.truncated));
    } catch {
      setItems([]);
      setTruncated(false);
      setError('네트워크 오류로 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  return (
    <div className={embedded ? 'flex flex-col gap-3' : 'flex flex-col gap-4 p-4'}>
      <Card className={embedded ? 'border-app-border shadow-card' : 'border-app-border shadow-none'}>
        <CardHeader className="pb-2">
          {embedded ? (
            <>
              <CardTitle className="text-base">조회 데이터</CardTitle>
              <CardDescription className="text-xs">
                엑셀 양식과 동일한 열 순서입니다. ERP와 범위를 맞추려면{' '}
                <code className="rounded bg-app-muted/20 px-0.5">ERP_TSL_INVOICE_COMPANY_SEQ</code> 등을 설정하세요.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-lg">거래명세서 품목 조회</CardTitle>
              <CardDescription>
                엑셀 기준 컬럼(순번·사업장·거래명세서번호·일자·거래처·창고·품목·금액·외화·프로젝트·LOT 등). 일자 구간을
                선택한 뒤 조회하세요. 환경 변수{' '}
                <code className="rounded bg-app-muted/20 px-1">ERP_TSL_INVOICE_COMPANY_SEQ</code>
                로 법인을 한정할 수 있습니다.
              </CardDescription>
            </>
          )}
        </CardHeader>
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

          <div className="max-h-[min(70vh,720px)] overflow-auto rounded-md border border-app-border">
            <table className="min-w-max border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className={TH}>순번</th>
                  <th className={TH}>사업장</th>
                  <th className={TH}>거래명세서번호</th>
                  <th className={TH}>거래명세서일자</th>
                  <th className={TH}>거래처코드</th>
                  <th className={TH}>거래처명</th>
                  <th className={TH}>출고창고</th>
                  <th className={TH}>출고창고명</th>
                  <th className={TH}>담당자</th>
                  <th className={TH}>담당부서</th>
                  <th className={TH}>품번</th>
                  <th className={TH}>품명</th>
                  <th className={TH}>규격</th>
                  <th className={TH}>단위</th>
                  <th className={TH}>관리단위</th>
                  <th className={TH}>수량</th>
                  <th className={TH}>단가</th>
                  <th className={TH}>공급가액</th>
                  <th className={TH}>부가세</th>
                  <th className={TH}>합계금액</th>
                  <th className={TH}>외화단가</th>
                  <th className={TH}>외화금액</th>
                  <th className={TH}>환율</th>
                  <th className={TH}>통화</th>
                  <th className={TH}>비고</th>
                  <th className={TH}>프로젝트</th>
                  <th className={TH}>프로젝트명</th>
                  <th className={TH}>검사구분</th>
                  <th className={TH}>입고창고</th>
                  <th className={TH}>입고창고명</th>
                  <th className={TH}>Lot No.</th>
                  <th className={TH}>생산일자</th>
                  <th className={TH}>유효일자</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td className={TD} colSpan={33}>
                      {error ? '—' : '조회 결과가 없습니다. 일자를 선택한 뒤 조회를 누르세요.'}
                    </td>
                  </tr>
                ) : null}
                {items.map((r) => (
                  <tr key={String(r.rowNo)} className="odd:bg-app-surface-02/60">
                    <td className={TD}>{r.rowNo}</td>
                    <td className={`${TD} tabular-nums`}>{r.bizUnit ?? ''}</td>
                    <td className={TD}>{cellText(r.invoiceNo)}</td>
                    <td className={TD}>{cellText(r.invoiceDate)}</td>
                    <td className={TD}>{cellText(r.customerCode)}</td>
                    <td className={TD}>{cellText(r.customerName)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.outboundWhCode)}</td>
                    <td className={TD}>{cellText(r.outboundWhName)}</td>
                    <td className={TD}>{cellText(r.chargePersonName)}</td>
                    <td className={TD}>{cellText(r.chargeDeptName)}</td>
                    <td className={TD}>{cellText(r.itemNo)}</td>
                    <td className={TD_ITEM_NAME}>{cellText(r.itemName)}</td>
                    <td className={TD}>{cellText(r.spec)}</td>
                    <td className={TD}>{cellText(r.unit)}</td>
                    <td className={TD}>{cellText(r.managementUnit)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.qty)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.unitPrice)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.supplyAmount)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.vatAmount)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.totalAmount)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.foreignUnitPrice)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.foreignAmount)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.exchangeRate)}</td>
                    <td className={TD}>{cellText(r.currencyName)}</td>
                    <td className={TD}>{cellText(r.remark)}</td>
                    <td className={TD}>{cellText(r.projectCode)}</td>
                    <td className={TD}>{cellText(r.projectName)}</td>
                    <td className={TD}>{cellText(r.inspectionKind)}</td>
                    <td className={`${TD} tabular-nums`}>{formatNumber(r.inboundWhCode)}</td>
                    <td className={TD}>{cellText(r.inboundWhName)}</td>
                    <td className={TD}>{cellText(r.lotNo)}</td>
                    <td className={TD}>{cellText(r.productionDate)}</td>
                    <td className={TD}>{cellText(r.expiryDate)}</td>
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
