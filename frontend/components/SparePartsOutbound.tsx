'use client';

import type { SparePartLedgerEntryRow, SparePartMasterRow } from '@samkwang/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  FormGrid,
  Input,
} from '@samkwang/ui-kit';
import { MasterPartSearchSelect } from '@/components/MasterPartSearchSelect';
import { useCallback, useEffect, useState } from 'react';

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toIsoFromLocalDatetime(value: string): string | null {
  if (!value) {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
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

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const emptyForm = () => ({
  masterId: '',
  qty: '1',
  occurredAt: (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })(),
  note: '',
});

export function SparePartsOutbound() {
  const [month, setMonth] = useState(defaultMonth);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SparePartLedgerEntryRow[]>([]);
  const [masters, setMasters] = useState<SparePartMasterRow[]>([]);
  const [currentQty, setCurrentQty] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  const reload = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams({ month });
    if (search.trim()) {
      params.set('q', search.trim());
    }
    const res = await fetch(`/api/spare-parts/outbound-entries?${params}`, {
      credentials: 'include',
    });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      setLoadError(await readApiError(res));
      return;
    }
    setRows((await res.json()) as SparePartLedgerEntryRow[]);
  }, [month, search]);

  const loadMasters = useCallback(async () => {
    const res = await fetch('/api/master-data/spare-parts?activeOnly=true', {
      credentials: 'include',
    });
    if (res.ok) {
      setMasters((await res.json()) as SparePartMasterRow[]);
    }
  }, []);

  const loadStock = useCallback(async (masterId: string) => {
    if (!masterId) {
      setCurrentQty(null);
      return;
    }
    const res = await fetch(`/api/spare-parts/masters/${masterId}/stock`, {
      credentials: 'include',
    });
    if (res.ok) {
      const body = (await res.json()) as { currentQty: string };
      setCurrentQty(body.currentQty);
    } else {
      setCurrentQty('0');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (addOpen) {
      void loadMasters();
      setCurrentQty(null);
    }
  }, [addOpen, loadMasters]);

  useEffect(() => {
    if (addOpen && addForm.masterId) {
      void loadStock(addForm.masterId);
    }
  }, [addOpen, addForm.masterId, loadStock]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.masterId) {
      setLoadError('출고할 부품정보를 선택해 주세요.');
      return;
    }
    const qty = Number(addForm.qty);
    if (currentQty != null && qty > Number(currentQty)) {
      setLoadError('출고 수량이 현재고를 초과합니다.');
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/spare-parts/masters/${addForm.masterId}/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          qty,
          occurredAt: toIsoFromLocalDatetime(addForm.occurredAt),
          note: addForm.note || null,
        }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      setAddOpen(false);
      setAddForm(emptyForm());
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">부품출고</h1>
          <p className="mt-1 text-sm text-app-muted">부품별 출고 수량과 일시를 등록·조회합니다.</p>
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
          <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
            출고내역등록
          </Button>
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
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">부품코드</th>
                  <th scope="col">사출기</th>
                  <th scope="col">제품명</th>
                  <th scope="col">규격</th>
                  <th scope="col" className="pros-cell-center">
                    단위
                  </th>
                  <th scope="col" className="pros-cell-num">
                    출고수량
                  </th>
                  <th scope="col">출고일시</th>
                  <th scope="col">비고</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="pros-table-empty">
                      등록된 출고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.partCode ?? '—'}</td>
                      <td>{row.machineBrand}</td>
                      <td className="font-medium">{row.productName}</td>
                      <td className="text-app-muted">{row.spec ?? '—'}</td>
                      <td className="pros-cell-center">{row.unit ?? '—'}</td>
                      <td className="pros-cell-num">{formatQtyDisplay(row.qty)}</td>
                      <td className="font-mono text-xs text-app-muted">
                        {formatOccurredAt(row.occurredAt)}
                      </td>
                      <td className="max-w-[140px] truncate text-app-muted" title={row.note ?? ''}>
                        {row.note ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="default">
          <form onSubmit={submitAdd}>
            <DialogHeader>
              <DialogTitle>출고내역등록</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <FormGrid fullWidth>
                <FormField label="부품 선택" required>
                  <MasterPartSearchSelect
                    required
                    masters={masters}
                    value={addForm.masterId}
                    onChange={(masterId) => {
                      setAddForm((f) => ({ ...f, masterId, qty: '1' }));
                    }}
                  />
                </FormField>
                {masters.length === 0 ? (
                  <p className="text-sm text-app-muted">
                    기준정보 · 부품정보관리에서 사용 중인 부품을 먼저 등록해 주세요.
                  </p>
                ) : null}
                {addForm.masterId ? (
                  <p className="text-sm text-app-muted">
                    현재고: {currentQty != null ? formatQtyDisplay(currentQty) : '—'}
                  </p>
                ) : null}
                <FormField label="출고수량" required>
                  <Input
                    type="number"
                    required
                    min={0.0001}
                    step="any"
                    max={currentQty != null ? Number(currentQty) : undefined}
                    value={addForm.qty}
                    onChange={(e) => setAddForm((f) => ({ ...f, qty: e.target.value }))}
                  />
                </FormField>
                <FormField label="출고일시" required>
                  <Input
                    type="datetime-local"
                    required
                    value={addForm.occurredAt}
                    onChange={(e) => setAddForm((f) => ({ ...f, occurredAt: e.target.value }))}
                  />
                </FormField>
                <FormField label="비고" fullWidth>
                  <Input
                    value={addForm.note}
                    onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </FormField>
              </FormGrid>
            </DialogBody>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary" disabled={busy} loading={busy}>
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
