'use client';

import type { ToolRow, ToolsSyncResult } from '@samkwang/shared';
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
import { ToolSyncDialog } from '@/components/ToolSyncDialog';
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

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString('ko-KR');
}

function parseOptionalInt(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

type ToolFormState = {
  toolSeq: string;
  toolName: string;
  toolNo: string;
  spec: string;
  smStatus: string;
  smStatusNm: string;
  umToolKind: string;
  umToolKindName: string;
  assetSeq: string;
  asstName: string;
  asstNo: string;
  deptSeq: string;
  deptName: string;
  empSeq: string;
  empName: string;
  sortOrder: string;
  isActive: 'Y' | 'N';
};

const emptyForm = (): ToolFormState => ({
  toolSeq: '',
  toolName: '',
  toolNo: '',
  spec: '',
  smStatus: '',
  smStatusNm: '',
  umToolKind: '',
  umToolKindName: '',
  assetSeq: '',
  asstName: '',
  asstNo: '',
  deptSeq: '',
  deptName: '',
  empSeq: '',
  empName: '',
  sortOrder: '0',
  isActive: 'Y',
});

function rowToForm(row: ToolRow) {
  return {
    toolSeq: String(row.toolSeq),
    toolName: row.toolName,
    toolNo: row.toolNo,
    spec: row.spec ?? '',
    smStatus: row.smStatus != null ? String(row.smStatus) : '',
    smStatusNm: row.smStatusNm ?? '',
    umToolKind: row.umToolKind != null ? String(row.umToolKind) : '',
    umToolKindName: row.umToolKindName ?? '',
    assetSeq: row.assetSeq != null ? String(row.assetSeq) : '',
    asstName: row.asstName ?? '',
    asstNo: row.asstNo ?? '',
    deptSeq: row.deptSeq != null ? String(row.deptSeq) : '',
    deptName: row.deptName ?? '',
    empSeq: row.empSeq != null ? String(row.empSeq) : '',
    empName: row.empName ?? '',
    sortOrder: String(row.sortOrder),
    isActive: (row.isActive ? 'Y' : 'N') as 'Y' | 'N',
  };
}

export function ToolMasterRegistry() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<ToolsSyncResult | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [syncOpen, setSyncOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<ToolRow | null>(null);
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
    const res = await fetch(`/api/master-data/tools?${params}`, {
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
    setRows((await res.json()) as ToolRow[]);
  }, [search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/master-data/tools/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toolName: editForm.toolName,
          toolNo: editForm.toolNo,
          spec: editForm.spec || null,
          smStatus: parseOptionalInt(editForm.smStatus),
          smStatusNm: editForm.smStatusNm || null,
          umToolKind: parseOptionalInt(editForm.umToolKind),
          umToolKindName: editForm.umToolKindName || null,
          assetSeq: parseOptionalInt(editForm.assetSeq),
          asstName: editForm.asstName || null,
          asstNo: editForm.asstNo || null,
          deptSeq: parseOptionalInt(editForm.deptSeq),
          deptName: editForm.deptName || null,
          empSeq: parseOptionalInt(editForm.empSeq),
          empName: editForm.empName || null,
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

  async function removeRow(row: ToolRow) {
    if (!confirm(`「${row.toolSeq} · ${row.toolName}」 설비정보를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/master-data/tools/${row.id}`, {
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

  async function removeAllRows() {
    if (rows.length === 0) {
      return;
    }
    if (
      !confirm(
        `등록된 설비정보 전체(${rows.length}건)를 삭제할까요?\n삭제 후에는 복구할 수 없으며, 부품/입출고 이력의 설비 연결은 해제됩니다.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    setSyncSuccess(null);
    setDeleteSuccess(null);
    try {
      const res = await fetch('/api/master-data/tools', {
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
      const result = (await res.json()) as { deleted: number };
      setDeleteSuccess(result.deleted);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: ToolRow) {
    setEditTarget(row);
    setEditForm(rowToForm(row));
  }

  const toolFormFields = (
    form: ToolFormState,
    setForm: React.Dispatch<React.SetStateAction<ToolFormState>>,
    toolSeqReadOnly: boolean,
    audit?: ToolRow,
  ) => (
    <FormGrid>
      <FormField label="설비코드" required={!toolSeqReadOnly}>
        <Input
          type="number"
          required={!toolSeqReadOnly}
          readOnly={toolSeqReadOnly}
          min={1}
          value={form.toolSeq}
          onChange={(e) => setForm((f) => ({ ...f, toolSeq: e.target.value }))}
        />
      </FormField>
      <FormField label="설비명" required>
        <Input
          required
          value={form.toolName}
          onChange={(e) => setForm((f) => ({ ...f, toolName: e.target.value }))}
        />
      </FormField>
      <FormField label="설비번호" required>
        <Input
          required
          value={form.toolNo}
          onChange={(e) => setForm((f) => ({ ...f, toolNo: e.target.value }))}
        />
      </FormField>
      <FormField label="규격">
        <Input value={form.spec} onChange={(e) => setForm((f) => ({ ...f, spec: e.target.value }))} />
      </FormField>
      <FormField label="설비종류">
        <Input
          value={form.umToolKindName}
          onChange={(e) => setForm((f) => ({ ...f, umToolKindName: e.target.value }))}
        />
      </FormField>
      <FormField label="설비종류코드">
        <Input
          type="number"
          value={form.umToolKind}
          onChange={(e) => setForm((f) => ({ ...f, umToolKind: e.target.value }))}
        />
      </FormField>
      <FormField label="설비상태">
        <Input
          value={form.smStatusNm}
          onChange={(e) => setForm((f) => ({ ...f, smStatusNm: e.target.value }))}
        />
      </FormField>
      <FormField label="설비상태코드">
        <Input
          type="number"
          value={form.smStatus}
          onChange={(e) => setForm((f) => ({ ...f, smStatus: e.target.value }))}
        />
      </FormField>
      <FormField label="자산명">
        <Input
          value={form.asstName}
          onChange={(e) => setForm((f) => ({ ...f, asstName: e.target.value }))}
        />
      </FormField>
      <FormField label="자산번호">
        <Input
          value={form.asstNo}
          onChange={(e) => setForm((f) => ({ ...f, asstNo: e.target.value }))}
        />
      </FormField>
      <FormField label="자산코드">
        <Input
          type="number"
          value={form.assetSeq}
          onChange={(e) => setForm((f) => ({ ...f, assetSeq: e.target.value }))}
        />
      </FormField>
      <FormField label="관리부서">
        <Input
          value={form.deptName}
          onChange={(e) => setForm((f) => ({ ...f, deptName: e.target.value }))}
        />
      </FormField>
      <FormField label="관리부서코드">
        <Input
          type="number"
          value={form.deptSeq}
          onChange={(e) => setForm((f) => ({ ...f, deptSeq: e.target.value }))}
        />
      </FormField>
      <FormField label="관리담당자">
        <Input
          value={form.empName}
          onChange={(e) => setForm((f) => ({ ...f, empName: e.target.value }))}
        />
      </FormField>
      <FormField label="관리담당자코드">
        <Input
          type="number"
          value={form.empSeq}
          onChange={(e) => setForm((f) => ({ ...f, empSeq: e.target.value }))}
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
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value as 'Y' | 'N' }))}
        >
          <option value="Y">Y (사용)</option>
          <option value="N">N (미사용)</option>
        </select>
      </FormField>
      {audit ? (
        <>
          <FormField label="최종작업자">
            <Input readOnly value={audit.lastUserName ?? '—'} />
          </FormField>
          <FormField label="최종작업자ID">
            <Input readOnly value={audit.empid ?? '—'} />
          </FormField>
          <FormField label="최종작업일시" fullWidth>
            <Input readOnly value={formatDateTime(audit.lastDateTime)} />
          </FormField>
        </>
      ) : null}
    </FormGrid>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-app-text">설비정보관리</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FormField label="검색">
            <Input
              placeholder="설비명·번호·자산명"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormField>
          <Button type="button" variant="secondary" onClick={() => setSyncOpen(true)}>
            설비정보 동기화
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy || rows.length === 0}
            loading={busy}
            onClick={() => void removeAllRows()}
          >
            전체 삭제
          </Button>
        </div>
      </div>

      <ToolSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onApplied={(result) => {
          setSyncSuccess(result);
          setDeleteSuccess(null);
          void reload();
        }}
      />

      {syncSuccess ? (
        <Alert variant="success">
          <AlertTitle>동기화 완료</AlertTitle>
          <AlertDescription>
            신규 {syncSuccess.inserted}건 · 갱신 {syncSuccess.updated}건 · 전체 {syncSuccess.total}건
            이 반영되었습니다.
          </AlertDescription>
        </Alert>
      ) : null}

      {deleteSuccess != null ? (
        <Alert variant="success">
          <AlertTitle>전체 삭제 완료</AlertTitle>
          <AlertDescription>설비정보 {deleteSuccess}건이 삭제되었습니다.</AlertDescription>
        </Alert>
      ) : null}

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
                <col style={{ width: '5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="pros-cell-seq">
                    순번
                  </th>
                  <th scope="col" className="pros-cell-center">
                    설비코드
                  </th>
                  <th scope="col" className="pros-cell-center">
                    설비명
                  </th>
                  <th scope="col" className="pros-cell-center">
                    설비번호
                  </th>
                  <th scope="col" className="pros-cell-center">
                    규격
                  </th>
                  <th scope="col" className="pros-cell-center">
                    설비종류
                  </th>
                  <th scope="col" className="pros-cell-center">
                    설비상태
                  </th>
                  <th scope="col" className="pros-cell-center">
                    관리부서
                  </th>
                  <th scope="col" className="pros-cell-center">
                    관리담당자
                  </th>
                  <th scope="col" className="pros-cell-actions">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="pros-table-empty">
                      등록된 설비정보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.id} className={!row.isActive ? 'opacity-50' : undefined}>
                      <td className="pros-cell-seq">{rowSequenceNo(currentPage, pageSize, idx)}</td>
                      <td className="pros-cell-center font-mono text-xs">{row.toolSeq}</td>
                      <td className="pros-cell-center font-medium">{row.toolName}</td>
                      <td className="pros-cell-center font-mono text-xs">{row.toolNo}</td>
                      <td className="pros-cell-center text-app-muted">{row.spec ?? '—'}</td>
                      <td className="pros-cell-center text-app-muted">{row.umToolKindName ?? '—'}</td>
                      <td className="pros-cell-center text-app-muted">{row.smStatusNm ?? '—'}</td>
                      <td className="pros-cell-center text-app-muted">{row.deptName ?? '—'}</td>
                      <td className="pros-cell-center text-app-muted">{row.empName ?? '—'}</td>
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

      <Dialog open={editTarget != null} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent size="default">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>
                설비정보 수정 — {editTarget?.toolSeq} · {editTarget?.toolName}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              {toolFormFields(editForm, setEditForm, true, editTarget ?? undefined)}
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
