'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import {
  MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION,
  MOLD_PARENT_CODE_GROUP_INSPECTION_DIVISION,
} from '@samkwang/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

async function readApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    const t = raw.trim();
    return t.length > 0 ? t.slice(0, 800) : `요청 실패 (${res.status})`;
  }
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const m = o.message;
    if (Array.isArray(m)) {
      return m.map(String).join(', ');
    }
    if (typeof m === 'string' && m.length > 0) {
      return m;
    }
    if (typeof o.error === 'string' && o.error.length > 0) {
      return o.error;
    }
  }
  return `요청 실패 (${res.status})`;
}

/** 항목명 + 입력을 한 셀에 세로로 배치 */
function InspectionLabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 py-0.5 text-left">
      <div className="text-[11px] font-semibold leading-tight text-app-muted">{label}</div>
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}

type CodeSelectOption = { id: string; code: string; name: string };

function formatCodeSlashName(code: string, name: string): string {
  return `${code.trim()} / ${name.trim()}`;
}

const INSPECTION_CATEGORY_LEGACY_PREFIX = '__ic_legacy__:';

function inspectionCategoryLegacyOptionValue(raw: string): string {
  return `${INSPECTION_CATEGORY_LEGACY_PREFIX}${encodeURIComponent(raw)}`;
}

function parseInspectionCategoryLegacyOptionValue(v: string): string | null {
  if (!v.startsWith(INSPECTION_CATEGORY_LEGACY_PREFIX)) {
    return null;
  }
  try {
    return decodeURIComponent(v.slice(INSPECTION_CATEGORY_LEGACY_PREFIX.length));
  } catch {
    return null;
  }
}

/** 저장값(코드·코드명·자유입력)을 select value로 맞춤 */
function inspectionCategorySelectControlValue(stored: string, options: CodeSelectOption[]): string {
  const t = stored.trim();
  if (!t) {
    return '';
  }
  const byCode = options.find((o) => o.code.trim() === t);
  if (byCode) {
    return byCode.code.trim();
  }
  const byName = options.find((o) => o.name.trim() === t);
  if (byName) {
    return byName.code.trim();
  }
  return inspectionCategoryLegacyOptionValue(t);
}

/** 저장 시 코드명만 적혀 있으면 기준정보 하위 코드값으로 통일 */
function canonicalInspectionCategory(stored: string, options: CodeSelectOption[]): string {
  const t = stored.trim();
  if (!t) {
    return t;
  }
  const byCode = options.find((o) => o.code.trim() === t);
  if (byCode) {
    return byCode.code.trim();
  }
  const byName = options.find((o) => o.name.trim() === t);
  if (byName) {
    return byName.code.trim();
  }
  return t;
}

function formatInspectionCategoryLabel(stored: string, options: CodeSelectOption[]): string {
  const t = stored.trim();
  if (!t) {
    return '—';
  }
  const byCode = options.find((o) => o.code.trim() === t);
  if (byCode) {
    return formatCodeSlashName(byCode.code, byCode.name);
  }
  const byName = options.find((o) => o.name.trim() === t);
  if (byName) {
    return formatCodeSlashName(byName.code, byName.name);
  }
  return t;
}

function rowToApiBody(r: EditableRow, inspectionDivisionOptions: CodeSelectOption[]) {
  return {
    categoryItemId: r.categoryItemId,
    typeItemId: r.typeItemId ?? null,
    inspectionCategory: canonicalInspectionCategory(r.inspectionCategory, inspectionDivisionOptions),
    itemCode: r.itemCode.trim(),
    itemName: r.itemName.trim(),
    method: r.method.trim(),
    detail: r.detail.trim(),
    criteria: r.criteria.trim(),
    cycle: r.cycle.trim(),
    remarks: r.remarks.trim(),
    sortOrder: r.sortOrder,
  };
}

type InspectionApiRow = {
  id: string;
  categoryItemId: string;
  typeItemId: string | null;
  inspectionCategory: string;
  itemCode: string;
  itemName: string;
  method: string;
  detail: string;
  criteria: string;
  cycle: string;
  remarks: string;
  sortOrder: number;
};

type EditableRow = {
  clientKey: string;
  id?: string;
  categoryItemId: string;
  typeItemId: string | null;
  inspectionCategory: string;
  itemCode: string;
  itemName: string;
  method: string;
  detail: string;
  criteria: string;
  cycle: string;
  remarks: string;
  sortOrder: number;
};

function newClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `${설비구분코드}-숫자` 패턴에서 최대 일련번호 (예: A-S-001-3 → 3) */
function maxSuffixForEquipmentCode(base: string, itemCodes: readonly string[]): number {
  const b = base.trim().replace(/\s+/g, '');
  if (!b) {
    return 0;
  }
  const re = new RegExp(`^${escapeRegExp(b)}-(\\d+)$`);
  let max = 0;
  for (const code of itemCodes) {
    const m = code.trim().match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) {
        max = Math.max(max, n);
      }
    }
  }
  return max;
}

/** 신규 행: 동일 설비구분의 기존·임시 코드 중 최대 번호 + 1 (예: A-S-001-2) */
function nextItemCodeForNewDraft(
  draft: EditableRow,
  contextRows: EditableRow[],
  categoryItemOptions: CodeSelectOption[],
): string {
  const opt = categoryItemOptions.find((o) => o.id === draft.categoryItemId);
  const base = (opt?.code ?? '').trim().replace(/\s+/g, '');
  if (!base) {
    return '';
  }
  const otherCodes = contextRows
    .filter((x) => x.categoryItemId === draft.categoryItemId && x.clientKey !== draft.clientKey)
    .map((x) => x.itemCode.trim())
    .filter(Boolean);
  const n = maxSuffixForEquipmentCode(base, otherCodes) + 1;
  let code = `${base}-${n}`;
  if (code.length > 50) {
    const over = code.length - 50;
    const trimmedBase = base.length > over ? base.slice(0, base.length - over) : base.slice(0, 1);
    code = `${trimmedBase}-${n}`.slice(0, 50);
  }
  return code;
}

/**
 * 신규 행(!id): 선택된 설비구분(하위) 코드 + `-1`, `-2` … (목록에 있는 모든 코드 기준 순차 부여)
 * DB `itemCode` 최대 50자 준수
 */
function applyDraftItemCodes(rows: EditableRow[], categoryItemOptions: CodeSelectOption[]): EditableRow[] {
  const out: EditableRow[] = [];
  for (const r of rows) {
    if (r.id) {
      out.push(r);
      continue;
    }
    out.push({
      ...r,
      itemCode: nextItemCodeForNewDraft(r, out, categoryItemOptions),
    });
  }
  return out;
}

function emptyNewDraftFields(row: EditableRow): EditableRow {
  return {
    ...row,
    itemName: '',
    method: '',
    detail: '',
    criteria: '',
    cycle: '',
    remarks: '',
    inspectionCategory: row.inspectionCategory ?? '',
  };
}

/** 저장 직전 신규 행 점검항목코드를 설비구분 코드-일련번호 규칙으로 확정 */
function assignAutoItemCodesForSave(
  rows: EditableRow[],
  categoryItemOptions: CodeSelectOption[],
): EditableRow[] {
  return applyDraftItemCodes(rows, categoryItemOptions);
}

function newRowHasIncompleteRequired(r: EditableRow): boolean {
  const hasCode = Boolean(r.itemCode.trim());
  const hasName = Boolean(r.itemName.trim());
  const hasOther = Boolean(
    r.inspectionCategory.trim() ||
      r.method.trim() ||
      r.detail.trim() ||
      r.criteria.trim() ||
      r.cycle.trim() ||
      r.remarks.trim(),
  );
  return (!hasCode || !hasName) && (hasCode || hasName || hasOther);
}

function mapApiToEditable(row: InspectionApiRow): EditableRow {
  return {
    clientKey: row.id,
    id: row.id,
    categoryItemId: row.categoryItemId,
    typeItemId: row.typeItemId,
    inspectionCategory: row.inspectionCategory,
    itemCode: row.itemCode,
    itemName: row.itemName,
    method: row.method,
    detail: row.detail,
    criteria: row.criteria,
    cycle: row.cycle,
    remarks: row.remarks,
    sortOrder: row.sortOrder,
  };
}

const selectClass =
  'h-9 w-full min-w-[10rem] rounded-md border border-app-border bg-app-surface px-2 text-sm text-app-text';

export function MoldInspectionItemsRegistry() {
  const [categoryItemOptions, setCategoryItemOptions] = useState<CodeSelectOption[]>([]);
  const [categoryFilterError, setCategoryFilterError] = useState<string | null>(null);
  const [inspectionDivisionOptions, setInspectionDivisionOptions] = useState<CodeSelectOption[]>([]);
  const [inspectionDivisionError, setInspectionDivisionError] = useState<string | null>(null);
  const [filterCategoryItemId, setFilterCategoryItemId] = useState('');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailDraft, setDetailDraft] = useState<EditableRow | null>(null);
  const [detailPersistBusy, setDetailPersistBusy] = useState(false);

  const loadCategoryFilterItems = useCallback(async () => {
    setCategoryFilterError(null);
    const res = await fetch(
      `/api/mold/code-groups/filter-items?parentCode=${encodeURIComponent(MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION)}`,
      { credentials: 'include' },
    );
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      setCategoryItemOptions([]);
      setCategoryFilterError(await readApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string; code: string; name: string }[];
    setCategoryItemOptions(data.map((r) => ({ id: r.id, code: r.code, name: r.name })));
  }, []);

  const loadInspectionDivisionItems = useCallback(async () => {
    setInspectionDivisionError(null);
    const res = await fetch(
      `/api/mold/code-groups/filter-items?parentCode=${encodeURIComponent(MOLD_PARENT_CODE_GROUP_INSPECTION_DIVISION)}`,
      { credentials: 'include' },
    );
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      setInspectionDivisionOptions([]);
      setInspectionDivisionError(await readApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string; code: string; name: string }[];
    setInspectionDivisionOptions(data.map((r) => ({ id: r.id, code: r.code, name: r.name })));
  }, []);

  useEffect(() => {
    void loadCategoryFilterItems();
  }, [loadCategoryFilterItems]);

  useEffect(() => {
    void loadInspectionDivisionItems();
  }, [loadInspectionDivisionItems]);

  type LoadInspectionListResult =
    | { ok: true; data: InspectionApiRow[] }
    | { ok: false; kind: 'auth' }
    | { ok: false; kind: 'error'; message: string };

  const loadInspectionItems = useCallback(
    async (opts?: { categoryItemId?: string }): Promise<LoadInspectionListResult> => {
      const categoryItemId =
        opts?.categoryItemId !== undefined ? opts.categoryItemId : filterCategoryItemId;
      const params = new URLSearchParams();
      if (categoryItemId) {
        params.set('categoryItemId', categoryItemId);
      }
      const qs = params.toString();
      const res = await fetch(`/api/mold/inspection-items${qs ? `?${qs}` : ''}`, { credentials: 'include' });
      if (res.status === 401) {
        return { ok: false, kind: 'auth' };
      }
      if (!res.ok) {
        return { ok: false, kind: 'error', message: await readApiError(res) };
      }
      const data = (await res.json()) as InspectionApiRow[];
      return { ok: true, data };
    },
    [filterCategoryItemId],
  );

  const selectedCategoryLabel = useMemo(() => {
    if (!filterCategoryItemId) {
      return '전체';
    }
    const o = categoryItemOptions.find((x) => x.id === filterCategoryItemId);
    return o ? formatCodeSlashName(o.code, o.name) : filterCategoryItemId;
  }, [filterCategoryItemId, categoryItemOptions]);

  const inquire = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const result = await loadInspectionItems();
      if (!result.ok) {
        if (result.kind === 'auth') {
          window.location.href = '/login';
          return;
        }
        setLoadError(result.message);
        setRows([]);
        return;
      }
      const mapped = result.data.map(mapApiToEditable);
      setRows(mapped);
    } finally {
      setBusy(false);
    }
  }, [loadInspectionItems]);

  /** 설비구분 값이 바뀔 때마다 목록을 불러옵니다. 처음에는 전체만 선택된 상태면 자동 조회를 하지 않습니다. */
  const prevFilterCategoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevFilterCategoryRef.current === null) {
      prevFilterCategoryRef.current = filterCategoryItemId;
      if (filterCategoryItemId === '') {
        return;
      }
    }
    if (prevFilterCategoryRef.current === filterCategoryItemId) {
      return;
    }
    prevFilterCategoryRef.current = filterCategoryItemId;
    void inquire();
  }, [filterCategoryItemId, inquire]);

  function closeDetailDialog() {
    setDetailDialogOpen(false);
    setDetailDraft(null);
  }

  function patchDetailDraft(patch: Partial<EditableRow>) {
    setDetailDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function openDetailDialog(row: EditableRow) {
    setLoadError(null);
    if (row.id) {
      setDetailDraft({ ...row });
    } else {
      const cleared = emptyNewDraftFields(row);
      const withCode = {
        ...cleared,
        itemCode: nextItemCodeForNewDraft(cleared, rows, categoryItemOptions),
      };
      setDetailDraft(withCode);
    }
    setDetailDialogOpen(true);
  }

  function addInputRow() {
    if (!filterCategoryItemId) {
      setLoadError(
        '입력하려면 설비구분에서 하위 코드를 하나 선택해 주세요. (맨 위 전체는 조회만 가능합니다.)',
      );
      return;
    }
    setLoadError(null);
    const clientKey = newClientKey();
    const fresh: EditableRow = emptyNewDraftFields({
      clientKey,
      categoryItemId: filterCategoryItemId,
      typeItemId: null,
      inspectionCategory: '',
      itemCode: '',
      itemName: '',
      method: '',
      detail: '',
      criteria: '',
      cycle: '',
      remarks: '',
      sortOrder: rows.length,
    });
    const nextRows = applyDraftItemCodes([...rows, fresh], categoryItemOptions);
    setRows(nextRows);
    const draft = nextRows.find((r) => r.clientKey === clientKey) ?? fresh;
    openDetailDialog(draft);
  }

  const detailItemCodePreview = useMemo(() => {
    if (!detailDraft) {
      return '';
    }
    if (detailDraft.id) {
      return detailDraft.itemCode;
    }
    return nextItemCodeForNewDraft(detailDraft, rows, categoryItemOptions);
  }, [detailDraft, rows, categoryItemOptions]);

  async function saveDetailDialog() {
    if (!detailDraft) {
      return;
    }
    const prepared = detailDraft.id
      ? detailDraft
      : {
          ...detailDraft,
          itemCode: nextItemCodeForNewDraft(detailDraft, rows, categoryItemOptions),
        };
    if (!prepared.itemName.trim()) {
      setLoadError('점검항목(명)을 입력해 주세요.');
      return;
    }
    if (!prepared.categoryItemId.trim()) {
      setLoadError('설비구분(하위 코드)이 없어 저장할 수 없습니다.');
      return;
    }
    if (!prepared.itemCode.trim()) {
      setLoadError('점검항목코드를 생성할 수 없습니다. 설비구분을 확인해 주세요.');
      return;
    }
    if (!prepared.id && newRowHasIncompleteRequired(prepared)) {
      setLoadError('점검항목(명)을 입력해 주세요.');
      return;
    }

    setDetailPersistBusy(true);
    setLoadError(null);
    try {
      const body = rowToApiBody(prepared, inspectionDivisionOptions);
      const res = prepared.id
        ? await fetch(`/api/mold/inspection-items/${prepared.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/mold/inspection-items', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
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
      if (!prepared.id) {
        setRows((prev) => prev.filter((x) => x.clientKey !== prepared.clientKey));
      }
      closeDetailDialog();
      await inquire();
    } finally {
      setDetailPersistBusy(false);
    }
  }

  async function deleteDetailDialog() {
    if (!detailDraft) {
      return;
    }
    if (!detailDraft.id) {
      setRows((prev) =>
        applyDraftItemCodes(
          prev.filter((x) => x.clientKey !== detailDraft.clientKey),
          categoryItemOptions,
        ),
      );
      closeDetailDialog();
      return;
    }
    if (!window.confirm(`「${detailDraft.itemCode}」 점검항목을 삭제할까요? 저장된 데이터는 서버에서도 제거됩니다.`)) {
      return;
    }
    setDetailPersistBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mold/inspection-items/${detailDraft.id}`, {
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
      closeDetailDialog();
      await inquire();
    } finally {
      setDetailPersistBusy(false);
    }
  }

  const detailEquipmentLabel = useMemo(() => {
    if (!detailDraft?.categoryItemId) {
      return '';
    }
    const o = categoryItemOptions.find((x) => x.id === detailDraft.categoryItemId);
    return o ? formatCodeSlashName(o.code, o.name) : detailDraft.categoryItemId;
  }, [detailDraft, categoryItemOptions]);

  const tableInputCls = 'h-8 min-w-0 text-sm';
  const tableSelectCls =
    'h-8 min-w-0 w-full rounded-md border border-app-border bg-app-surface px-2 text-sm text-app-text';
  const detailTextareaCls =
    'min-h-[6rem] w-full resize-y rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm leading-relaxed text-app-text';

  const inspectionItemsColgroup = (
    <colgroup>
      <col style={{ width: '3rem' }} />
      <col style={{ width: '12rem' }} />
      <col style={{ width: '9rem' }} />
      <col />
      <col style={{ width: '8.5rem' }} />
    </colgroup>
  );

  const emptyListHint = filterCategoryItemId
    ? '해당 설비구분으로 저장된 점검항목이 없습니다. [입력]으로 추가하거나, 다른 설비구분으로 조회해 보세요.'
    : '설비구분을 선택하면 해당 구분만 자동 조회됩니다. 맨 위 「전체」에서 [조회]를 누르면 모든 구분의 항목이 표시됩니다.';

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[20rem] flex-col gap-4">
      <div className="shrink-0 space-y-1">
        <h1 className="text-xl font-semibold text-app-text">점검항목관리</h1>
        <p className="mt-1 text-sm text-app-muted">
          설비구분을 바꾸면 해당 구분 목록이 자동으로 조회됩니다. [상세내역수정] 팝업에서 점검방법·상세내역 등을 입력·저장·삭제할 수 있습니다.
        </p>
      </div>

      {loadError ? (
        <div className="shrink-0">
          <Alert variant="error">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-card">
        <CardHeader className="shrink-0 space-y-4 border-b border-app-border pb-3">
          <div className="min-w-0 overflow-x-auto overflow-y-hidden">
            <div className="flex w-full min-w-[min(100%,48rem)] flex-row flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex shrink-0 items-center gap-2">
                <span className="whitespace-nowrap text-sm font-medium text-app-text">설비구분</span>
                <select
                  className={`${selectClass} w-[min(100%,14rem)]`}
                  value={filterCategoryItemId}
                  disabled={busy}
                  onChange={(e) => setFilterCategoryItemId(e.target.value)}
                  aria-label="설비구분"
                >
                  <option value="">전체</option>
                  {categoryItemOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {formatCodeSlashName(g.code, g.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void inquire()}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="mdi:magnify" className="h-4 w-4 shrink-0" aria-hidden />
                    조회
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy || !filterCategoryItemId}
                  onClick={addInputRow}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="mdi:playlist-plus" className="h-4 w-4 shrink-0" aria-hidden />
                    입력
                  </span>
                </Button>
              </div>
            </div>
          </div>
          {categoryFilterError ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-red-600">
              <span>설비구분 목록: {categoryFilterError}</span>
            </div>
          ) : null}
          {inspectionDivisionError ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-red-600">
              <span>점검구분(기준정보·{MOLD_PARENT_CODE_GROUP_INSPECTION_DIVISION} 하위): {inspectionDivisionError}</span>
            </div>
          ) : null}
          <p className="text-sm text-app-text">
            <span className="font-medium text-app-muted">선택된 설비구분</span>{' '}
            <span className="font-semibold text-app-text">{selectedCategoryLabel}</span>
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto px-4 pb-4 pt-3">
            <table className="pros-data-table pros-data-table-head-center w-full min-w-[36rem] text-app-text">
              {inspectionItemsColgroup}
              <thead>
                <tr className="bg-app-muted/30 text-xs font-semibold">
                  <th className="px-1 py-2">NO</th>
                  <th className="px-2 py-2">점검구분</th>
                  <th className="px-2 py-2">점검항목코드</th>
                  <th className="px-2 py-2 text-left">점검항목</th>
                  <th className="px-1 py-2">상세</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pros-table-empty text-app-muted">
                      {emptyListHint}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, rowIdx) => {
                    const isDraft = !r.id;
                    return (
                      <tr
                        key={r.clientKey}
                        className={isDraft ? 'bg-amber-50/80 dark:bg-amber-950/20' : undefined}
                      >
                        <td className="pros-cell-center align-middle text-sm font-medium text-app-muted">
                          {rowIdx + 1}
                        </td>
                        <td className="px-2 py-2 align-middle text-left text-sm">
                          {formatInspectionCategoryLabel(r.inspectionCategory, inspectionDivisionOptions)}
                        </td>
                        <td className="px-2 py-2 align-middle font-mono text-xs">{r.itemCode || '—'}</td>
                        <td className="px-2 py-2 align-middle text-left text-sm">
                          {r.itemName.trim() || (
                            <span className="text-app-muted">{isDraft ? '(입력 중)' : '—'}</span>
                          )}
                        </td>
                        <td className="px-1 py-2 align-middle text-center">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 whitespace-nowrap px-2 text-xs"
                            disabled={busy || detailPersistBusy}
                            onClick={() => openDetailDialog(r)}
                          >
                            상세내역수정
                          </Button>
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

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          if (!open && !detailPersistBusy) {
            if (detailDraft && !detailDraft.id) {
              setRows((prev) =>
                applyDraftItemCodes(
                  prev.filter((x) => x.clientKey !== detailDraft.clientKey),
                  categoryItemOptions,
                ),
              );
            }
            closeDetailDialog();
          }
        }}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{detailDraft?.id ? '점검항목 상세내역 수정' : '점검항목 등록'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[min(75vh,40rem)] space-y-4 overflow-y-auto">
            {detailDraft ? (
              <>
                {detailEquipmentLabel ? (
                  <p className="text-sm text-app-muted">
                    <span className="font-medium">설비구분</span>{' '}
                    <span className="font-semibold text-app-text">{detailEquipmentLabel}</span>
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <InspectionLabeledField label="점검구분">
                    <select
                      className={tableSelectCls}
                      value={inspectionCategorySelectControlValue(
                        detailDraft.inspectionCategory,
                        inspectionDivisionOptions,
                      )}
                      disabled={busy || detailPersistBusy}
                      onChange={(e) => {
                        const v = e.target.value;
                        const legacy = parseInspectionCategoryLegacyOptionValue(v);
                        patchDetailDraft({
                          inspectionCategory: legacy !== null ? legacy : v.trim(),
                        });
                      }}
                    >
                      <option value="">선택</option>
                      {inspectionDivisionOptions.map((o) => (
                        <option key={o.id} value={o.code.trim()}>
                          {formatCodeSlashName(o.code, o.name)}
                        </option>
                      ))}
                      {(() => {
                        const t = detailDraft.inspectionCategory.trim();
                        if (!t) {
                          return null;
                        }
                        const inList = inspectionDivisionOptions.some(
                          (o) => o.code.trim() === t || o.name.trim() === t,
                        );
                        if (inList) {
                          return null;
                        }
                        return (
                          <option value={inspectionCategoryLegacyOptionValue(t)}>
                            (기준정보에 없음) {t.length > 48 ? `${t.slice(0, 48)}…` : t}
                          </option>
                        );
                      })()}
                    </select>
                  </InspectionLabeledField>
                  <InspectionLabeledField label="점검항목코드">
                    <Input
                      readOnly
                      title="설비구분(하위) 코드에 따라 -1, -2 … 순으로 자동 부여됩니다."
                      className={`${tableInputCls} cursor-default bg-app-muted/20`}
                      value={detailItemCodePreview}
                      disabled={busy || detailPersistBusy}
                    />
                  </InspectionLabeledField>
                </div>
                <InspectionLabeledField label="점검항목">
                  <Input
                    className={tableInputCls}
                    value={detailDraft.itemName}
                    placeholder={detailDraft.id ? undefined : '점검항목명을 입력하세요.'}
                    disabled={busy || detailPersistBusy}
                    onChange={(e) => patchDetailDraft({ itemName: e.target.value })}
                  />
                </InspectionLabeledField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InspectionLabeledField label="점검방법">
                    <Input
                      className={tableInputCls}
                      value={detailDraft.method}
                      disabled={busy || detailPersistBusy}
                      onChange={(e) => patchDetailDraft({ method: e.target.value })}
                    />
                  </InspectionLabeledField>
                  <InspectionLabeledField label="판정기준">
                    <Input
                      className={tableInputCls}
                      value={detailDraft.criteria}
                      disabled={busy || detailPersistBusy}
                      onChange={(e) => patchDetailDraft({ criteria: e.target.value })}
                    />
                  </InspectionLabeledField>
                  <InspectionLabeledField label="점검주기">
                    <Input
                      className={tableInputCls}
                      value={detailDraft.cycle}
                      disabled={busy || detailPersistBusy}
                      onChange={(e) => patchDetailDraft({ cycle: e.target.value })}
                    />
                  </InspectionLabeledField>
                  <InspectionLabeledField label="비고">
                    <Input
                      className={tableInputCls}
                      value={detailDraft.remarks}
                      disabled={busy || detailPersistBusy}
                      onChange={(e) => patchDetailDraft({ remarks: e.target.value })}
                    />
                  </InspectionLabeledField>
                </div>
                <InspectionLabeledField label="점검항목상세내역">
                  <textarea
                    className={detailTextareaCls}
                    value={detailDraft.detail}
                    disabled={busy || detailPersistBusy}
                    rows={8}
                    placeholder="점검항목 상세내역을 입력하세요."
                    aria-label="점검항목상세내역"
                    onChange={(e) => patchDetailDraft({ detail: e.target.value })}
                  />
                </InspectionLabeledField>
              </>
            ) : null}
          </DialogBody>
          <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || detailPersistBusy}
              onClick={() => {
                if (detailDraft && !detailDraft.id) {
                  setRows((prev) =>
                    applyDraftItemCodes(
                      prev.filter((x) => x.clientKey !== detailDraft.clientKey),
                      categoryItemOptions,
                    ),
                  );
                }
                closeDetailDialog();
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:close" className="h-4 w-4 shrink-0" aria-hidden />
                취소
              </span>
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={busy || detailPersistBusy || !detailDraft}
              loading={detailPersistBusy}
              onClick={() => void deleteDetailDialog()}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:delete-outline" className="h-4 w-4 shrink-0" aria-hidden />
                삭제
              </span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy || detailPersistBusy || !detailDraft}
              loading={detailPersistBusy}
              onClick={() => void saveDetailDialog()}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
                저장
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
