'use client';

import type {
  SparePartItemRow,
  SparePartLedgerPeriodResponse,
  SparePartMasterRow,
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

export type SparePartsLedgerMode = 'inventory' | 'inbound' | 'outbound';

const MODE_META: Record<
  SparePartsLedgerMode,
  { title: string; description: string; emptyHint: string }
> = {
  inventory: {
    title: '재고현황',
    description: '기준월 기준으로 해당 월 입·출고 합계와 현재 재고를 표시합니다.',
    emptyHint: '등록된 부품이 없습니다. 상단 버튼으로 부품 행을 추가하세요.',
  },
  inbound: {
    title: '부품입고',
    description: '부품별 입고 수량과 일시를 등록합니다.',
    emptyHint: '등록된 부품이 없습니다. 재고현황에서 부품 행을 먼저 추가하세요.',
  },
  outbound: {
    title: '부품출고',
    description: '부품별 출고 수량과 일시를 등록합니다.',
    emptyHint: '등록된 부품이 없습니다. 재고현황에서 부품 행을 먼저 추가하세요.',
  },
};

export function SparePartsLedger({ mode = 'inventory' }: { mode?: SparePartsLedgerMode }) {
  const meta = MODE_META[mode];
  const showApproval = mode === 'inventory';
  const showAddItem = mode === 'inventory';
  const showInboundAction = mode === 'inbound';
  const showOutboundAction = mode === 'outbound';
  const showEditAction = mode === 'inventory';
  const showActions = showInboundAction || showOutboundAction || showEditAction;
  const [month, setMonth] = useState(defaultMonth);
  const [items, setItems] = useState<SparePartItemRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [masters, setMasters] = useState<SparePartMasterRow[]>([]);
  const [addMasterId, setAddMasterId] = useState('');
  const [addManual, setAddManual] = useState(false);
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
    const resItems = await fetch(`/api/spare-parts/items?month=${encodeURIComponent(month)}`, {
      credentials: 'include',
    });
    if (resItems.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!resItems.ok) {
      setLoadError(await readApiError(resItems));
      return;
    }
    setItems((await resItems.json()) as SparePartItemRow[]);

    if (!showApproval) {
      return;
    }
    const resPeriod = await fetch(
      `/api/spare-parts/ledger-period?month=${encodeURIComponent(month)}`,
      { credentials: 'include' },
    );
    if (resPeriod.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!resPeriod.ok) {
      setLoadError(await readApiError(resPeriod));
      return;
    }
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
  }, [month, showApproval]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!addOpen) {
      return;
    }
    void (async () => {
      const res = await fetch('/api/master-data/spare-parts?activeOnly=true', {
        credentials: 'include',
      });
      if (res.ok) {
        setMasters((await res.json()) as SparePartMasterRow[]);
      }
    })();
  }, [addOpen]);

  function applyMasterSelection(masterId: string) {
    setAddMasterId(masterId);
    const m = masters.find((x) => x.id === masterId);
    if (m) {
      setAddForm({
        machineBrand: '',
        productName: m.productName,
        spec: m.spec ?? '',
        optimalQty: m.optimalQty,
        remarks: m.remarks ?? '',
      });
    }
  }

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
      if (!addManual && !addMasterId) {
        setLoadError('기초정보를 선택하거나 직접 입력을 선택해 주세요.');
        return;
      }
      if (addManual && (!addForm.machineBrand.trim() || !addForm.productName.trim())) {
        setLoadError('사출기와 제품명을 입력해 주세요.');
        return;
      }
      const body =
        !addManual && addMasterId
          ? {
              masterId: addMasterId,
              remarks: addForm.remarks || null,
            }
          : {
              machineBrand: addForm.machineBrand,
              productName: addForm.productName,
              spec: addForm.spec || null,
              optimalQty: Number(addForm.optimalQty) || 0,
              remarks: addForm.remarks || null,
            };
      const res = await fetch('/api/spare-parts/items', {
        method: 'POST',
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
      setAddOpen(false);
      setAddMasterId('');
      setAddManual(false);
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

  function openLedger(row: SparePartItemRow, type: 'INBOUND' | 'OUTBOUND') {
    setLedgerType(type);
    setLedgerTarget(row);
    setLedgerQty('1');
    setLedgerNote('');
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setLedgerAt(d.toISOString().slice(0, 16));
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
          <h1 className="text-xl font-semibold text-app-text">{meta.title}</h1>
          <p className="mt-1 text-sm text-app-muted">{meta.description}</p>
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

      {showApproval ? (
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
      ) : null}

      {showAddItem ? (
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
          부품 행 추가
        </Button>
      </div>
      ) : null}

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
                {showActions && <th>작업</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={showActions ? 10 : 9}
                    className="py-8 text-center text-app-muted"
                  >
                    {meta.emptyHint}
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
                    {showActions && (
                      <td className="space-x-1 whitespace-nowrap">
                        {showInboundAction ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-success"
                            onClick={() => openLedger(row, 'INBOUND')}
                          >
                            입고
                          </Button>
                        ) : null}
                        {showOutboundAction ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-warning"
                            onClick={() => openLedger(row, 'OUTBOUND')}
                          >
                            출고
                          </Button>
                        ) : null}
                        {showEditAction ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-app-muted"
                            onClick={() => openEdit(row)}
                          >
                            수정
                          </Button>
                        ) : null}
                      </td>
                    )}
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
                <FormField label="기초정보 선택" fullWidth>
                  <select
                    className="sk-form-input w-full"
                    value={addMasterId}
                    disabled={addManual}
                    onChange={(e) => applyMasterSelection(e.target.value)}
                  >
                    <option value="">— 기초정보에서 선택 —</option>
                    {masters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.partCode} · {m.productName}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label=" " fullWidth>
                  <label className="flex items-center gap-2 text-sm text-app-muted">
                    <input
                      type="checkbox"
                      checked={addManual}
                      onChange={(e) => {
                        setAddManual(e.target.checked);
                        if (e.target.checked) {
                          setAddMasterId('');
                        }
                      }}
                    />
                    기초정보 없이 직접 입력 (레거시)
                  </label>
                </FormField>
                <FormField label="사출기" required>
                  <Input
                    required={addManual || !addMasterId}
                    readOnly={!addManual && !!addMasterId}
                    value={addForm.machineBrand}
                    onChange={(e) => setAddForm((f) => ({ ...f, machineBrand: e.target.value }))}
                  />
                </FormField>
                <FormField label="제품명" required>
                  <Input
                    required={addManual || !addMasterId}
                    readOnly={!addManual && !!addMasterId}
                    value={addForm.productName}
                    onChange={(e) => setAddForm((f) => ({ ...f, productName: e.target.value }))}
                  />
                </FormField>
                <FormField label="규격">
                  <Input
                    readOnly={!addManual && !!addMasterId}
                    value={addForm.spec}
                    onChange={(e) => setAddForm((f) => ({ ...f, spec: e.target.value }))}
                  />
                </FormField>
                <FormField label="적정재고">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    readOnly={!addManual && !!addMasterId}
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
