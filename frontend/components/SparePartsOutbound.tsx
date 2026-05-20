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

function defaultPeriodStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultPeriodEnd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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

function rowToEditForm(row: SparePartLedgerEntryRow) {
  return {
    qty: row.qty,
    occurredAt: isoToDatetimeLocal(row.occurredAt),
    note: row.note ?? '',
  };
}

export function SparePartsOutbound() {
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SparePartLedgerEntryRow[]>([]);
  const [masters, setMasters] = useState<SparePartMasterRow[]>([]);
  const [currentQty, setCurrentQty] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addDialogError, setAddDialogError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<SparePartLedgerEntryRow | null>(null);
  const [editForm, setEditForm] = useState({
    qty: '1',
    occurredAt: '',
    note: '',
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams({
      inboundStart: periodStart,
      inboundEnd: periodEnd,
    });
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
  }, [periodStart, periodEnd, search]);

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
      setAddDialogError(null);
    }
  }, [addOpen, loadMasters]);

  useEffect(() => {
    if (addOpen && addForm.masterId) {
      void loadStock(addForm.masterId);
    }
  }, [addOpen, addForm.masterId, loadStock]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddDialogError(null);
    if (!addForm.masterId) {
      setAddDialogError('출고할 부품정보를 선택해 주세요.');
      return;
    }
    const qty = Number(addForm.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setAddDialogError('출고수량은 0보다 큰 값을 입력해 주세요.');
      return;
    }
    if (currentQty != null && qty > Number(currentQty)) {
      setAddDialogError('출고수량이 현재고보다 클수 없습니다.');
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
      setAddDialogError(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) {
      return;
    }
    const qty = Number(editForm.qty);
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/spare-parts/ledger-entries/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          qty,
          occurredAt: toIsoFromLocalDatetime(editForm.occurredAt),
          note: editForm.note || null,
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
      setEditTarget(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(row: SparePartLedgerEntryRow) {
    if (
      !confirm(
        `출고 내역을 삭제할까요?\n${row.productName} · 수량 ${formatQtyDisplay(row.qty)}\n삭제 후에는 복구할 수 없습니다.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/spare-parts/ledger-entries/${row.id}`, {
        method: 'DELETE',
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
          <FormField label="출고시작일자">
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </FormField>
          <FormField label="출고종료일자">
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
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
            <table className="pros-data-table pros-data-table-head-center pros-ledger-table text-app-text">
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">부품코드</th>
                  <th scope="col">사출기</th>
                  <th scope="col">제품명</th>
                  <th scope="col">규격</th>
                  <th scope="col">단위</th>
                  <th scope="col">출고수량</th>
                  <th scope="col">출고일시</th>
                  <th scope="col">비고</th>
                  <th scope="col" className="pros-cell-actions">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pros-table-empty">
                      등록된 출고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="pros-cell-center font-mono text-xs">{row.partCode ?? '—'}</td>
                      <td className="pros-cell-center">{row.machineBrand}</td>
                      <td className="pros-cell-center font-medium">{row.productName}</td>
                      <td className="pros-cell-center text-app-muted">{row.spec ?? '—'}</td>
                      <td className="pros-cell-center">{row.unit ?? '—'}</td>
                      <td className="pros-cell-center tabular-nums">{formatQtyDisplay(row.qty)}</td>
                      <td className="pros-cell-center font-mono text-xs text-app-muted">
                        {formatOccurredAt(row.occurredAt)}
                      </td>
                      <td
                        className="pros-cell-center truncate text-app-muted"
                        title={row.note ?? ''}
                      >
                        {row.note ?? '—'}
                      </td>
                      <td className="pros-cell-actions">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            disabled={busy}
                            onClick={() => {
                              setEditTarget(row);
                              setEditForm(rowToEditForm(row));
                              setLoadError(null);
                            }}
                          >
                            수정
                          </Button>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-error"
                            disabled={busy}
                            onClick={() => void removeEntry(row)}
                          >
                            삭제
                          </Button>
                        </div>
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
              {addDialogError ? (
                <p className="mb-3 text-sm text-error" role="alert">
                  {addDialogError}
                </p>
              ) : null}
              <FormGrid fullWidth>
                <FormField label="부품 선택" required>
                  <MasterPartSearchSelect
                    required
                    masters={masters}
                    value={addForm.masterId}
                    onChange={(masterId) => {
                      setAddForm((f) => ({ ...f, masterId, qty: '1' }));
                      setAddDialogError(null);
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
                    step="any"
                    value={addForm.qty}
                    onChange={(e) => {
                      setAddForm((f) => ({ ...f, qty: e.target.value }));
                      setAddDialogError(null);
                    }}
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

      <Dialog open={editTarget != null} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent size="default">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>출고내역 수정</DialogTitle>
            </DialogHeader>
            <DialogBody>
              {editTarget ? (
                <div className="mb-4 space-y-1 rounded-md border border-app-border bg-app-surface-02 p-3 text-sm">
                  <p>
                    <span className="text-app-muted">부품코드</span>{' '}
                    <span className="font-mono font-medium">{editTarget.partCode ?? '—'}</span>
                  </p>
                  <p>
                    <span className="text-app-muted">제품명</span>{' '}
                    <span className="font-medium">{editTarget.productName}</span>
                  </p>
                </div>
              ) : null}
              <FormGrid fullWidth>
                <FormField label="출고수량" required>
                  <Input
                    type="number"
                    required
                    min={0.0001}
                    step="any"
                    value={editForm.qty}
                    onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
                  />
                </FormField>
                <FormField label="출고일시" required>
                  <Input
                    type="datetime-local"
                    required
                    value={editForm.occurredAt}
                    onChange={(e) => setEditForm((f) => ({ ...f, occurredAt: e.target.value }))}
                  />
                </FormField>
                <FormField label="비고" fullWidth>
                  <Input
                    value={editForm.note}
                    onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </FormField>
              </FormGrid>
            </DialogBody>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
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
