'use client';

import type { SparePartInventoryRow } from '@samkwang/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  FormField,
  Input,
} from '@samkwang/ui-kit';
import { useCallback, useEffect, useState } from 'react';

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

export function SparePartsInventory() {
  const [month, setMonth] = useState(defaultMonth);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SparePartInventoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams({ month });
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
  }, [month, search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">재고현황</h1>
          <p className="mt-1 text-sm text-app-muted">
            부품입고·부품출고 내역을 합산해 기준월 입·출고 수량과 현재 재고를 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FormField label="기준월">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </FormField>
          <FormField label="검색">
            <Input
              placeholder="코드·제품명"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto">
            <table className="pros-data-table text-app-text">
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">부품코드</th>
                  <th scope="col">제품명</th>
                  <th scope="col">규격</th>
                  <th scope="col" className="pros-cell-center">
                    단위
                  </th>
                  <th scope="col">입고일자(월내)</th>
                  <th scope="col" className="pros-cell-num">
                    입고수량
                  </th>
                  <th scope="col" className="pros-cell-num">
                    출고수량
                  </th>
                  <th scope="col" className="pros-cell-num">
                    현재재고
                  </th>
                  <th scope="col" className="pros-cell-num">
                    적정재고
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pros-table-empty">
                      표시할 재고가 없습니다. 부품입고에서 입고를 등록하면 여기에 반영됩니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const lowStock = Number(row.currentQty) < Number(row.optimalQty);
                    return (
                      <tr key={row.id}>
                        <td className="font-mono text-xs">{row.partCode ?? '—'}</td>
                        <td className="font-medium">{row.productName}</td>
                        <td className="text-app-muted">{row.spec ?? '—'}</td>
                        <td className="pros-cell-center">{row.unit ?? '—'}</td>
                        <td className="font-mono text-xs text-app-muted">
                          {row.lastInboundDateInMonth ?? '—'}
                        </td>
                        <td className="pros-cell-num">{formatQtyDisplay(row.inboundQtyInMonth)}</td>
                        <td className="pros-cell-num">{formatQtyDisplay(row.outboundQtyInMonth)}</td>
                        <td
                          className={`pros-cell-num font-medium${lowStock ? ' text-warning' : ''}`}
                        >
                          {formatQtyDisplay(row.currentQty)}
                        </td>
                        <td className="pros-cell-num">{formatQtyDisplay(row.optimalQty)}</td>
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
