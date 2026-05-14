'use client';

import type {
  SparePartItemRow,
  SparePartLedgerPeriodResponse,
} from '@samkwang/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  FormGrid,
  Input,
  Notification,
  Table,
} from '@samkwang/ui-kit';
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

export function SparePartsLedger() {
  const [month, setMonth] = useState(defaultMonth);
  const [items, setItems] = useState<SparePartItemRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    machineBrand: '',
    productName: '',
    spec: '',
    optimalQty: '1',
    remarks: '',
  });

  const [ledgerTarget, setLedgerTarget] = useState<SparePartItemRow | null>(null);
  const [ledgerType, setLedgerType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [ledgerQty, setLedgerQty] = useState('1');
  const [ledgerAt, setLedgerAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [ledgerNote, setLedgerNote] = useState('');

  const [editTarget, setEditTarget] = useState<SparePartItemRow | null>(null);
  const [editForm, setEditForm] = useState({
    machineBrand: '',
    productName: '',
    spec: '',
    optimalQty: '',
    remarks: '',
  });

  const [approval, setApproval] = useState({
    preparedBy: '',
    preparedAt: '',
    reviewedBy: '',
    reviewedAt: '',
    confirmedBy: '',
    confirmedAt: '',
    teamLeadBy: '',
    teamLeadAt: '',
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    const [resItems, resPeriod] = await Promise.all([
      fetch(`/api/spare-parts/items?month=${encodeURIComponent(month)}`, { credentials: 'include' }),
      fetch(`/api/spare-parts/ledger-period?month=${encodeURIComponent(month)}`, { credentials: 'include' }),
    ]);
    if (resItems.status === 401 || resPeriod.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!resItems.ok) {
      setLoadError(await readApiError(resItems));
      return;
    }
    if (!resPeriod.ok) {
      setLoadError(await readApiError(resPeriod));
      return;
    }
    setItems((await resItems.json()) as SparePartItemRow[]);
    const p = (await resPeriod.json()) as SparePartLedgerPeriodResponse;
    setApproval({
      preparedBy: p.preparedBy ?? '',
      preparedAt: p.preparedAt ? p.preparedAt.slice(0, 16) : '',
      reviewedBy: p.reviewedBy ?? '',
      reviewedAt: p.reviewedAt ? p.reviewedAt.slice(0, 16) : '',
      confirmedBy: p.confirmedBy ?? '',
      confirmedAt: p.confirmedAt ? p.confirmedAt.slice(0, 16) : '',
      teamLeadBy: p.teamLeadBy ?? '',
      teamLeadAt: p.teamLeadAt ? p.teamLeadAt.slice(0, 16) : '',
    });
  }, [month]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveApproval() {
    setBusy(true);
    setLoadError(null);
    try {
      const body = {
        periodMonth: month,
        preparedBy: approval.preparedBy || null,
        preparedAt: toIsoFromLocalDatetime(approval.preparedAt),
        reviewedBy: approval.reviewedBy || null,
        reviewedAt: toIsoFromLocalDatetime(approval.reviewedAt),
        confirmedBy: approval.confirmedBy || null,
        confirmedAt: toIsoFromLocalDatetime(approval.confirmedAt),
        teamLeadBy: approval.teamLeadBy || null,
        teamLeadAt: toIsoFromLocalDatetime(approval.teamLeadAt),
      };
      const res = await fetch('/api/spare-parts/ledger-period', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      const p = (await res.json()) as SparePartLedgerPeriodResponse;
      setApproval({
        preparedBy: p.preparedBy ?? '',
        preparedAt: p.preparedAt ? p.preparedAt.slice(0, 16) : '',
        reviewedBy: p.reviewedBy ?? '',
        reviewedAt: p.reviewedAt ? p.reviewedAt.slice(0, 16) : '',
        confirmedBy: p.confirmedBy ?? '',
        confirmedAt: p.confirmedAt ? p.confirmedAt.slice(0, 16) : '',
        teamLeadBy: p.teamLeadBy ?? '',
        teamLeadAt: p.teamLeadAt ? p.teamLeadAt.slice(0, 16) : '',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/spare-parts/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          machineBrand: addForm.machineBrand,
          productName: addForm.productName,
          spec: addForm.spec || null,
          optimalQty: Number(addForm.optimalQty) || 0,
          remarks: addForm.remarks || null,
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
      setAddForm({ machineBrand: '', productName: '', spec: '', optimalQty: '1', remarks: '' });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function submitLedger(e: React.FormEvent) {
    e.preventDefault();
    if (!ledgerTarget) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    const path =
      ledgerType === 'INBOUND'
        ? `/api/spare-parts/items/${ledgerTarget.id}/inbound`
        : `/api/spare-parts/items/${ledgerTarget.id}/outbound`;
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          qty: Number(ledgerQty),
          occurredAt: toIsoFromLocalDatetime(ledgerAt),
          note: ledgerNote || null,
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
      setLedgerTarget(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: SparePartItemRow) {
    setEditTarget(row);
    setEditForm({
      machineBrand: row.machineBrand,
      productName: row.productName,
      spec: row.spec ?? '',
      optimalQty: row.optimalQty,
      remarks: row.remarks ?? '',
    });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/spare-parts/items/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          machineBrand: editForm.machineBrand,
          productName: editForm.productName,
          spec: editForm.spec || null,
          optimalQty: Number(editForm.optimalQty),
          remarks: editForm.remarks || null,
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

  const titleMonth = `${month.slice(0, 4)}년 ${month.slice(5, 7)}월`;

  const approvalFields = [
    { key: 'prepared', label: '작성', nameKey: 'preparedBy' as const, timeKey: 'preparedAt' as const },
    { key: 'reviewed', label: '검토', nameKey: 'reviewedBy' as const, timeKey: 'reviewedAt' as const },
    { key: 'confirmed', label: '확인', nameKey: 'confirmedBy' as const, timeKey: 'confirmedAt' as const },
    { key: 'team', label: '팀장', nameKey: 'teamLeadBy' as const, timeKey: 'teamLeadAt' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">사출기 예비 부품 입출고 관리대장</h1>
          <p className="mt-1 text-sm text-app-muted">
            기준월 기준으로 해당 월 입·출고 합계와 마지막 입고일을 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FormField label="기준월">
            <Input
              id="ledger-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </FormField>
          <Button type="button" variant="secondary" size="sm" onClick={() => void reload()}>
            새로고침
          </Button>
        </div>
      </div>

      {loadError ? (
        <Notification
          variant="error"
          title="오류"
          message={loadError}
          closable
          onClose={() => setLoadError(null)}
        />
      ) : null}

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">결재</CardTitle>
          <CardDescription>{titleMonth}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {approvalFields.map((c) => (
              <Card key={c.key} className="border-app-border bg-app-surface shadow-none">
                <CardHeader className="space-y-2 p-3 pb-2">
                  <CardDescription className="text-center font-semibold text-app-text">
                    {c.label}
                  </CardDescription>
                  <Input
                    placeholder="성명"
                    value={approval[c.nameKey]}
                    onChange={(e) => setApproval((a) => ({ ...a, [c.nameKey]: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    value={approval[c.timeKey]}
                    onChange={(e) => setApproval((a) => ({ ...a, [c.timeKey]: e.target.value }))}
                  />
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="primary" disabled={busy} onClick={() => void saveApproval()}>
              결재 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
          부품 행 추가
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 pt-4">
          <Table frameClassName="w-full">
            <thead>
              <tr>
                <th>사출기</th>
                <th>제품명</th>
                <th>규격</th>
                <th>입고일자(월내)</th>
                <th>입고수량</th>
                <th>출고수량</th>
                <th>현재재고</th>
                <th>적정재고</th>
                <th>비고</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-app-muted">
                    등록된 부품이 없습니다. 상단 버튼으로 추가하세요.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.machineBrand}</td>
                    <td className="font-medium">{row.productName}</td>
                    <td className="text-app-muted">{row.spec ?? '—'}</td>
                    <td className="font-mono text-xs">{row.lastInboundDateInMonth ?? '—'}</td>
                    <td>{formatQtyDisplay(row.inboundQtyInMonth)}</td>
                    <td>{formatQtyDisplay(row.outboundQtyInMonth)}</td>
                    <td className="font-medium">{formatQtyDisplay(row.currentQty)}</td>
                    <td>{formatQtyDisplay(row.optimalQty)}</td>
                    <td className="max-w-[140px] truncate text-app-muted" title={row.remarks ?? ''}>
                      {row.remarks ?? '—'}
                    </td>
                    <td className="space-x-1 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-success"
                        onClick={() => {
                          setLedgerType('INBOUND');
                          setLedgerTarget(row);
                          setLedgerQty('1');
                          setLedgerNote('');
                        }}
                      >
                        입고
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-warning"
                        onClick={() => {
                          setLedgerType('OUTBOUND');
                          setLedgerTarget(row);
                          setLedgerQty('1');
                          setLedgerNote('');
                        }}
                      >
                        출고
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-app-muted"
                        onClick={() => openEdit(row)}
                      >
                        수정
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="default">
          <form onSubmit={submitAdd}>
            <DialogHeader>
              <DialogTitle>부품 행 추가</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <FormGrid>
                <FormField label="사출기" required>
                  <Input
                    required
                    value={addForm.machineBrand}
                    onChange={(e) => setAddForm((f) => ({ ...f, machineBrand: e.target.value }))}
                  />
                </FormField>
                <FormField label="제품명" required>
                  <Input
                    required
                    value={addForm.productName}
                    onChange={(e) => setAddForm((f) => ({ ...f, productName: e.target.value }))}
                  />
                </FormField>
                <FormField label="규격">
                  <Input
                    value={addForm.spec}
                    onChange={(e) => setAddForm((f) => ({ ...f, spec: e.target.value }))}
                  />
                </FormField>
                <FormField label="적정재고">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={addForm.optimalQty}
                    onChange={(e) => setAddForm((f) => ({ ...f, optimalQty: e.target.value }))}
                  />
                </FormField>
                <FormField label="비고" fullWidth>
                  <Input
                    value={addForm.remarks}
                    onChange={(e) => setAddForm((f) => ({ ...f, remarks: e.target.value }))}
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

      <Dialog open={ledgerTarget != null} onOpenChange={(o) => !o && setLedgerTarget(null)}>
        <DialogContent size="default">
          <form onSubmit={submitLedger}>
            <DialogHeader>
              <DialogTitle>
                {ledgerType === 'INBOUND' ? '입고' : '출고'} — {ledgerTarget?.productName}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <FormGrid fullWidth>
                <FormField label="수량" required>
                  <Input
                    type="number"
                    required
                    min={0.0001}
                    step="any"
                    value={ledgerQty}
                    onChange={(e) => setLedgerQty(e.target.value)}
                  />
                </FormField>
                <FormField label="일시" required>
                  <Input
                    type="datetime-local"
                    required
                    value={ledgerAt}
                    onChange={(e) => setLedgerAt(e.target.value)}
                  />
                </FormField>
                <FormField label="비고" fullWidth>
                  <Input value={ledgerNote} onChange={(e) => setLedgerNote(e.target.value)} />
                </FormField>
              </FormGrid>
            </DialogBody>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setLedgerTarget(null)}>
                취소
              </Button>
              <Button type="submit" variant="primary" disabled={busy} loading={busy}>
                등록
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTarget != null} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent size="default">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>부품 정보 수정</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <FormGrid>
                <FormField label="사출기" required>
                  <Input
                    required
                    value={editForm.machineBrand}
                    onChange={(e) => setEditForm((f) => ({ ...f, machineBrand: e.target.value }))}
                  />
                </FormField>
                <FormField label="제품명" required>
                  <Input
                    required
                    value={editForm.productName}
                    onChange={(e) => setEditForm((f) => ({ ...f, productName: e.target.value }))}
                  />
                </FormField>
                <FormField label="규격">
                  <Input value={editForm.spec} onChange={(e) => setEditForm((f) => ({ ...f, spec: e.target.value }))} />
                </FormField>
                <FormField label="적정재고" required>
                  <Input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={editForm.optimalQty}
                    onChange={(e) => setEditForm((f) => ({ ...f, optimalQty: e.target.value }))}
                  />
                </FormField>
                <FormField label="비고" fullWidth>
                  <Input
                    value={editForm.remarks}
                    onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
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
