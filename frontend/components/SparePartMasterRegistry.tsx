'use client';

import type { SparePartMasterRow } from '@samkwang/shared';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  ProsListPageSizeSelect,
  ProsListPaginationBar,
  clampPage,
  getTotalPages,
  rowSequenceNo,
  slicePage,
} from '@/components/ProsListPagination';

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
  partCode: '',
  productName: '',
  spec: '',
  unit: 'EA',
  optimalQty: '0',
  manufacturer: '',
  storageLocation: '',
  leadTimeDays: '',
  remarks: '',
  sortOrder: '0',
  isActive: 'Y' as 'Y' | 'N',
});

function rowToForm(row: SparePartMasterRow) {
  return {
    partCode: row.partCode,
    productName: row.productName,
    spec: row.spec ?? '',
    unit: row.unit,
    optimalQty: row.optimalQty,
    manufacturer: row.manufacturer ?? '',
    storageLocation: row.storageLocation ?? '',
    leadTimeDays: row.leadTimeDays != null ? String(row.leadTimeDays) : '',
    remarks: row.remarks ?? '',
    sortOrder: String(row.sortOrder),
    isActive: row.isActive ? 'Y' : 'N',
  };
}

export function SparePartMasterRegistry() {
  const [rows, setRows] = useState<SparePartMasterRow[]>([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  const [editTarget, setEditTarget] = useState<SparePartMasterRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);

  const totalPages = useMemo(() => getTotalPages(rows.length, pageSize), [rows.length, pageSize]);
  const currentPage = useMemo(() => clampPage(page, totalPages), [page, totalPages]);
  const pageRows = useMemo(
    () => slicePage(rows, currentPage, pageSize),
    [rows, currentPage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPage((p) => clampPage(p, totalPages));
  }, [totalPages]);

  const reload = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams({ activeOnly: 'false' });
    if (search.trim()) {
      params.set('q', search.trim());
    }
    const res = await fetch(`/api/master-data/spare-parts?${params}`, {
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
    setRows((await res.json()) as SparePartMasterRow[]);
  }, [search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/master-data/spare-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          partCode: addForm.partCode.trim().toUpperCase(),
          productName: addForm.productName,
          spec: addForm.spec || null,
          unit: addForm.unit || 'EA',
          optimalQty: Number(addForm.optimalQty) || 0,
          manufacturer: addForm.manufacturer || null,
          storageLocation: addForm.storageLocation || null,
          leadTimeDays: addForm.leadTimeDays ? Number(addForm.leadTimeDays) : null,
          remarks: addForm.remarks || null,
          sortOrder: Number(addForm.sortOrder) || 0,
          isActive: addForm.isActive === 'Y',
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

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/master-data/spare-parts/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productName: editForm.productName,
          spec: editForm.spec || null,
          unit: editForm.unit || 'EA',
          optimalQty: Number(editForm.optimalQty) || 0,
          manufacturer: editForm.manufacturer || null,
          storageLocation: editForm.storageLocation || null,
          leadTimeDays: editForm.leadTimeDays ? Number(editForm.leadTimeDays) : null,
          remarks: editForm.remarks || null,
          sortOrder: Number(editForm.sortOrder) || 0,
          isActive: editForm.isActive === 'Y',
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

  async function removeRow(row: SparePartMasterRow) {
    if (!confirm(`「${row.partCode}」 부품정보를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/master-data/spare-parts/${row.id}`, {
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

  function openEdit(row: SparePartMasterRow) {
    setEditTarget(row);
    setEditForm(rowToForm(row));
  }

  const masterFormFields = (
    form: typeof addForm,
    setForm: React.Dispatch<React.SetStateAction<typeof addForm>>,
    partCodeReadOnly: boolean,
  ) => (
    <FormGrid>
      <FormField label="부품코드" required={!partCodeReadOnly}>
        <Input
          required={!partCodeReadOnly}
          readOnly={partCodeReadOnly}
          placeholder="SP-LS-001"
          value={form.partCode}
          onChange={(e) => setForm((f) => ({ ...f, partCode: e.target.value.toUpperCase() }))}
        />
      </FormField>
      <FormField label="제품명" required>
        <Input
          required
          value={form.productName}
          onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
        />
      </FormField>
      <FormField label="규격">
        <Input value={form.spec} onChange={(e) => setForm((f) => ({ ...f, spec: e.target.value }))} />
      </FormField>
      <FormField label="단위" required>
        <Input
          required
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
        />
      </FormField>
      <FormField label="적정재고" required>
        <Input
          type="number"
          min={0}
          step="any"
          value={form.optimalQty}
          onChange={(e) => setForm((f) => ({ ...f, optimalQty: e.target.value }))}
        />
      </FormField>
      <FormField label="제조사/공급처">
        <Input
          value={form.manufacturer}
          onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
        />
      </FormField>
      <FormField label="보관위치">
        <Input
          value={form.storageLocation}
          onChange={(e) => setForm((f) => ({ ...f, storageLocation: e.target.value }))}
        />
      </FormField>
      <FormField label="조달리드타임(일)">
        <Input
          type="number"
          min={0}
          value={form.leadTimeDays}
          onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
        />
      </FormField>
      <FormField label="정렬순서">
        <Input
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
        />
      </FormField>
      <FormField label="사용">
        <select
          className="sk-form-input w-full"
          value={form.isActive}
          onChange={(e) =>
            setForm((f) => ({ ...f, isActive: e.target.value as 'Y' | 'N' }))
          }
        >
          <option value="Y">Y (사용)</option>
          <option value="N">N (미사용)</option>
        </select>
      </FormField>
      <FormField label="비고" fullWidth>
        <Input
          value={form.remarks}
          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
        />
      </FormField>
    </FormGrid>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">부품정보관리</h1>
          <p className="mt-1 text-sm text-app-muted">
            입출고 관리대장에서 선택할 부품 마스터를 등록·관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FormField label="검색">
            <Input
              placeholder="코드·제품명"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormField>
          <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
            부품정보 등록
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
          <div className="flex justify-end border-b border-app-border px-4 py-2">
            <ProsListPageSizeSelect
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="pros-data-table pros-data-table-head-center text-app-text">
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="pros-cell-seq">
                    순번
                  </th>
                  <th scope="col" className="pros-cell-center">
                    부품코드
                  </th>
                  <th scope="col" className="pros-cell-center">
                    제품명
                  </th>
                  <th scope="col" className="pros-cell-center">
                    규격
                  </th>
                  <th scope="col" className="pros-cell-center">
                    단위
                  </th>
                  <th scope="col" className="pros-cell-center">
                    적정재고
                  </th>
                  <th scope="col" className="pros-cell-center">
                    보관위치
                  </th>
                  <th scope="col" className="pros-cell-center">
                    사용
                  </th>
                  <th scope="col" className="pros-cell-actions">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pros-table-empty">
                      등록된 부품정보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.id} className={!row.isActive ? 'opacity-50' : undefined}>
                      <td className="pros-cell-seq">{rowSequenceNo(currentPage, pageSize, idx)}</td>
                      <td className="pros-cell-center font-mono text-xs">{row.partCode}</td>
                      <td className="pros-cell-center font-medium">{row.productName}</td>
                      <td className="pros-cell-center text-app-muted">{row.spec ?? '—'}</td>
                      <td className="pros-cell-center">{row.unit}</td>
                      <td className="pros-cell-center">{row.optimalQty}</td>
                      <td className="pros-cell-center text-app-muted">{row.storageLocation ?? '—'}</td>
                      <td className="pros-cell-center">{row.isActive ? 'Y' : 'N'}</td>
                      <td className="pros-cell-actions">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => openEdit(row)}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="ml-2 h-auto p-0 text-error"
                          onClick={() => void removeRow(row)}
                        >
                          삭제
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ProsListPaginationBar
            page={currentPage}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="default">
          <form onSubmit={submitAdd}>
            <DialogHeader>
              <DialogTitle>부품정보 등록</DialogTitle>
            </DialogHeader>
            <DialogBody>{masterFormFields(addForm, setAddForm, false)}</DialogBody>
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
              <DialogTitle>부품정보 수정 — {editTarget?.partCode}</DialogTitle>
            </DialogHeader>
            <DialogBody>{masterFormFields(editForm, setEditForm, true)}</DialogBody>
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
