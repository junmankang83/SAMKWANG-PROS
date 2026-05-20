'use client';

import type { SparePartInventoryRow } from '@samkwang/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  FormField,
  Input,
} from '@samkwang/ui-kit';
import { useCallback, useEffect, useState } from 'react';
import { SparePartsLedgerReport } from '@/components/SparePartsLedgerReport';

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultAsOfDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultInboundStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultInboundEnd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatQtyDisplay(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) {
    return s;
  }
  if (Number.isInteger(n)) {
    return String(n);
  }
  return s;
}

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

type SparePartsInventoryProps = {
  title?: string;
  description?: string;
  emptyMessage?: string;
  /** 입고시작일자~입고종료일자 (부품 입출고 대장) */
  filterMode?: 'month' | 'inboundDateRange' | 'asOfDate';
};

export function SparePartsInventory({
  title = '재고현황',
  description = '부품입고·부품출고 내역을 합산해 입·출고 수량과 현재 재고를 표시합니다.',
  emptyMessage = '표시할 재고가 없습니다. 부품입고에서 입고를 등록하면 여기에 반영됩니다.',
  filterMode = 'month',
}: SparePartsInventoryProps = {}) {
  const [month, setMonth] = useState(defaultMonth);
  const [asOfDate, setAsOfDate] = useState(defaultAsOfDate);
  const [inboundStart, setInboundStart] = useState(defaultInboundStart);
  const [inboundEnd, setInboundEnd] = useState(defaultInboundEnd);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SparePartInventoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const showInboundDateColumn = filterMode !== 'asOfDate';

  const inboundDateColumnLabel =
    filterMode === 'inboundDateRange'
      ? '입고일자(기간내)'
      : filterMode === 'asOfDate'
        ? '입고일자(최근)'
        : '입고일자(월내)';

  const reload = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams();
    if (filterMode === 'asOfDate') {
      params.set('asOfDate', asOfDate);
    } else if (filterMode === 'inboundDateRange') {
      params.set('inboundStart', inboundStart);
      params.set('inboundEnd', inboundEnd);
    } else {
      params.set('month', month);
    }
    if (search.trim()) {
      params.set('q', search.trim());
    }
    const res = await fetch(`/api/spare-parts/inventory?${params}`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      setLoadError(await readApiError(res));
      return;
    }
    setRows((await res.json()) as SparePartInventoryRow[]);
  }, [filterMode, month, asOfDate, inboundStart, inboundEnd, search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">{title}</h1>
          <p className="mt-1 text-sm text-app-muted">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filterMode === 'asOfDate' ? (
            <FormField label="기준일">
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </FormField>
          ) : filterMode === 'inboundDateRange' ? (
            <>
              <FormField label="입고시작일자">
                <Input
                  type="date"
                  value={inboundStart}
                  onChange={(e) => setInboundStart(e.target.value)}
                />
              </FormField>
              <FormField label="입고종료일자">
                <Input
                  type="date"
                  value={inboundEnd}
                  onChange={(e) => setInboundEnd(e.target.value)}
                />
              </FormField>
            </>
          ) : (
            <FormField label="기준월">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </FormField>
          )}
          <FormField label="검색">
            <Input
              placeholder="코드·제품명"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormField>
          {filterMode === 'inboundDateRange' ? (
            <Button type="button" variant="primary" onClick={() => setShowReport(true)}>
              보고서출력
            </Button>
          ) : null}
        </div>
      </div>

      {showReport && filterMode === 'inboundDateRange' ? (
        <SparePartsLedgerReport
          rows={rows}
          inboundStart={inboundStart}
          inboundEnd={inboundEnd}
          onClose={() => setShowReport(false)}
        />
      ) : null}

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto">
            <table className="pros-data-table pros-data-table-head-center pros-ledger-table text-app-text">
              <colgroup>
                <col style={{ width: showInboundDateColumn ? '9%' : '10%' }} />
                <col style={{ width: showInboundDateColumn ? '11%' : '12%' }} />
                <col style={{ width: showInboundDateColumn ? '12%' : '14%' }} />
                <col style={{ width: showInboundDateColumn ? '10%' : '11%' }} />
                <col style={{ width: showInboundDateColumn ? '6%' : '7%' }} />
                {showInboundDateColumn ? <col style={{ width: '12%' }} /> : null}
                <col style={{ width: showInboundDateColumn ? '9%' : '11%' }} />
                <col style={{ width: showInboundDateColumn ? '9%' : '11%' }} />
                <col style={{ width: showInboundDateColumn ? '10%' : '12%' }} />
                <col style={{ width: showInboundDateColumn ? '10%' : '12%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">부품코드</th>
                  <th scope="col">사출기</th>
                  <th scope="col">제품명</th>
                  <th scope="col">규격</th>
                  <th scope="col">단위</th>
                  {showInboundDateColumn ? (
                    <th scope="col">{inboundDateColumnLabel}</th>
                  ) : null}
                  <th scope="col">입고수량</th>
                  <th scope="col">출고수량</th>
                  <th scope="col">현재재고</th>
                  <th scope="col">적정재고</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={showInboundDateColumn ? 10 : 9} className="pros-table-empty">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const lowStock = Number(row.currentQty) < Number(row.optimalQty);
                    return (
                      <tr key={row.id}>
                        <td className="pros-cell-center font-mono text-xs">{row.partCode ?? '—'}</td>
                        <td className="pros-cell-center">{row.machineName || '—'}</td>
                        <td className="pros-cell-center font-medium">{row.productName}</td>
                        <td className="pros-cell-center text-app-muted">{row.spec ?? '—'}</td>
                        <td className="pros-cell-center">{row.unit ?? '—'}</td>
                        {showInboundDateColumn ? (
                          <td className="pros-cell-center font-mono text-xs text-app-muted">
                            {row.lastInboundDateInMonth ?? '—'}
                          </td>
                        ) : null}
                        <td className="pros-cell-center tabular-nums">
                          {formatQtyDisplay(row.inboundQtyInMonth)}
                        </td>
                        <td className="pros-cell-center tabular-nums">
                          {formatQtyDisplay(row.outboundQtyInMonth)}
                        </td>
                        <td
                          className={`pros-cell-center font-medium tabular-nums${lowStock ? ' text-warning' : ''}`}
                        >
                          {formatQtyDisplay(row.currentQty)}
                        </td>
                        <td className="pros-cell-center tabular-nums">
                          {formatQtyDisplay(row.optimalQty)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
