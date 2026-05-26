'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import {
  MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION,
  MOLD_PARENT_CODE_GROUP_INSPECTION_DIVISION,
} from '@samkwang/shared';
import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from 'react';

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

/**
 * 신규 행(!id): 선택된 설비구분(하위) 코드 + `-1`, `-2` … (저장된 동일 설비구분 행의 최대 번호 다음부터)
 * DB `itemCode` 최대 50자 준수
 */
function applyDraftItemCodes(rows: EditableRow[], categoryItemOptions: CodeSelectOption[]): EditableRow[] {
  const maxSavedByCat = new Map<string, number>();
  const categoryIds = [...new Set(rows.map((r) => r.categoryItemId).filter((id) => id.trim()))];
  for (const catId of categoryIds) {
    const opt = categoryItemOptions.find((o) => o.id === catId);
    const base = (opt?.code ?? '').trim().replace(/\s+/g, '');
    if (!base) {
      continue;
    }
    const savedCodes = rows
      .filter((x) => x.id && x.categoryItemId === catId)
      .map((x) => x.itemCode.trim());
    maxSavedByCat.set(catId, maxSuffixForEquipmentCode(base, savedCodes));
  }

  const draftOrdinal = new Map<string, number>();

  return rows.map((r) => {
    if (r.id) {
      return r;
    }
    const opt = categoryItemOptions.find((o) => o.id === r.categoryItemId);
    const base = (opt?.code ?? '').trim().replace(/\s+/g, '');
    if (!base) {
      return r;
    }
    const start = maxSavedByCat.get(r.categoryItemId) ?? 0;
    const k = (draftOrdinal.get(r.categoryItemId) ?? 0) + 1;
    draftOrdinal.set(r.categoryItemId, k);
    const n = start + k;
    let code = `${base}-${n}`;
    if (code.length > 50) {
      const over = code.length - 50;
      const trimmedBase = base.length > over ? base.slice(0, base.length - over) : base.slice(0, 1);
      code = `${trimmedBase}-${n}`.slice(0, 50);
    }
    return { ...r, itemCode: code };
  });
}

function rowHasContentBeyondCode(r: EditableRow): boolean {
  return Boolean(
    r.itemName.trim() ||
      r.inspectionCategory.trim() ||
      r.method.trim() ||
      r.detail.trim() ||
      r.criteria.trim() ||
      r.cycle.trim() ||
      r.remarks.trim(),
  );
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

function serializeRow(r: EditableRow): string {
  return JSON.stringify({
    categoryItemId: r.categoryItemId,
    typeItemId: r.typeItemId,
    inspectionCategory: r.inspectionCategory.trim(),
    itemCode: r.itemCode.trim(),
    itemName: r.itemName.trim(),
    method: r.method.trim(),
    detail: r.detail.trim(),
    criteria: r.criteria.trim(),
    cycle: r.cycle.trim(),
    remarks: r.remarks.trim(),
    sortOrder: r.sortOrder,
  });
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
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const baseline = useRef<Map<string, string>>(new Map());

  const selectedRow = useMemo(
    () => rows.find((r) => r.clientKey === selectedClientKey) ?? null,
    [rows, selectedClientKey],
  );

  const rebuildBaseline = useCallback((list: EditableRow[]) => {
    const m = new Map<string, string>();
    for (const r of list) {
      if (r.id) {
        m.set(r.id, serializeRow(r));
      }
    }
    baseline.current = m;
  }, []);

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
        rebuildBaseline([]);
        return;
      }
      const mapped = result.data.map(mapApiToEditable);
      setRows(mapped);
      rebuildBaseline(mapped);
      setSelectedClientKey(null);
    } finally {
      setBusy(false);
    }
  }, [loadInspectionItems, rebuildBaseline]);

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

  function updateRow(clientKey: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)));
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
    setRows((prev) => {
      const fresh: EditableRow = {
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
        sortOrder: prev.length,
      };
      return applyDraftItemCodes([...prev, fresh], categoryItemOptions);
    });
    setSelectedClientKey(clientKey);
  }

  async function saveRows() {
    setBusy(true);
    setLoadError(null);
    try {
      const enriched = assignAutoItemCodesForSave(rows, categoryItemOptions);
      setRows(enriched);
      const snapshot = [...enriched];
      const writtenCategoryIds = new Set<string>();
      for (const r of snapshot) {
        if (!r.id) {
          if (newRowHasIncompleteRequired(r)) {
            setLoadError(
              '신규 행은 점검항목(명)이 필요합니다. 점검항목코드는 설비구분(하위) 코드 뒤에 -1, -2 … 순으로 자동 부여됩니다.',
            );
            return;
          }
          if (!r.itemCode.trim() || !r.itemName.trim()) {
            continue;
          }
          if (!r.categoryItemId?.trim()) {
            setLoadError('신규 행은 설비구분(하위 코드)이 있어야 저장할 수 있습니다.');
            return;
          }
          const res = await fetch('/api/mold/inspection-items', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
          writtenCategoryIds.add(r.categoryItemId);
        } else {
          const snap = baseline.current.get(r.id);
          const now = serializeRow(r);
          if (snap === now) {
            continue;
          }
          const res = await fetch(`/api/mold/inspection-items/${r.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
          writtenCategoryIds.add(r.categoryItemId);
        }
      }
      const reloadCategoryId =
        writtenCategoryIds.size === 1 ? [...writtenCategoryIds][0] : undefined;
      const reload = await loadInspectionItems(
        reloadCategoryId !== undefined ? { categoryItemId: reloadCategoryId } : undefined,
      );
      if (!reload.ok) {
        if (reload.kind === 'auth') {
          window.location.href = '/login';
          return;
        }
        setLoadError(
          `저장은 완료되었으나 목록을 다시 불러오지 못했습니다. 상단 [조회]로 새로고침해 주세요. · ${reload.message}`,
        );
        return;
      }
      if (reloadCategoryId !== undefined && reloadCategoryId !== filterCategoryItemId) {
        setFilterCategoryItemId(reloadCategoryId);
      }
      const mapped = reload.data.map(mapApiToEditable);
      setRows(mapped);
      rebuildBaseline(mapped);
      setSelectedClientKey(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const r = selectedRow;
    if (!r) {
      setLoadError('삭제할 행을 표에서 선택해 주세요.');
      return;
    }
    if (!r.id) {
      setRows((prev) => applyDraftItemCodes(
        prev.filter((x) => x.clientKey !== r.clientKey),
        categoryItemOptions,
      ));
      setSelectedClientKey(null);
      return;
    }
    if (!confirm(`「${r.itemCode}」 점검항목을 삭제할까요?`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mold/inspection-items/${r.id}`, {
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
      await inquire();
    } finally {
      setBusy(false);
    }
  }

  const tableInputCls = 'h-8 min-w-0 text-sm';
  const tableSelectCls =
    'h-8 min-w-0 w-full rounded-md border border-app-border bg-app-surface px-2 text-sm text-app-text';
  const detailTextareaCls =
    'min-h-[6rem] w-full resize-y rounded-md border border-app-border bg-app-surface px-2 py-1.5 text-sm leading-relaxed text-app-text';

  const inspectionItemsColgroup = (
    <colgroup>
      <col style={{ width: '3rem' }} />
      <col />
      <col />
      <col />
      <col />
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
          설비구분을 바꾸면 해당 구분 목록이 자동으로 조회됩니다. 전체 목록은 「전체」 선택 후 [조회]를 누르세요.
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
                <Button type="button" variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => void saveRows()}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
                    저장
                  </span>
                </Button>
                <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void deleteSelected()}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="mdi:delete-outline" className="h-4 w-4 shrink-0" aria-hidden />
                    삭제
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
            <table className="pros-data-table pros-data-table-head-center w-full min-w-[40rem] text-app-text">
              {inspectionItemsColgroup}
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pros-table-empty text-app-muted">
                      {emptyListHint}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, rowIdx) => {
                    const sel = r.clientKey === selectedClientKey;
                    const rowBg = sel ? 'cursor-pointer bg-brand/10' : 'cursor-pointer';
                    const onSelect = () => setSelectedClientKey(r.clientKey);
                    const seq = rowIdx + 1;
                    return (
                      <Fragment key={r.clientKey}>
                        <tr className={rowBg} onClick={onSelect} aria-selected={sel}>
                          <td rowSpan={3} className="pros-cell-center align-middle text-sm font-medium text-app-muted">
                            {seq}
                          </td>
                          <td className="p-1 align-top">
                            <InspectionLabeledField label="점검구분">
                              <select
                                className={tableSelectCls}
                                value={inspectionCategorySelectControlValue(
                                  r.inspectionCategory,
                                  inspectionDivisionOptions,
                                )}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const legacy = parseInspectionCategoryLegacyOptionValue(v);
                                  updateRow(r.clientKey, {
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
                                  const t = r.inspectionCategory.trim();
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
                                      (기준정보에 없음){' '}
                                      {t.length > 48 ? `${t.slice(0, 48)}…` : t}
                                    </option>
                                  );
                                })()}
                              </select>
                            </InspectionLabeledField>
                          </td>
                          <td className="p-1 align-top">
                            <InspectionLabeledField label="점검항목코드">
                              <Input
                                readOnly
                                title="설비구분(하위) 코드에 따라 -1, -2 … 순으로 자동 부여됩니다."
                                className={`${tableInputCls} cursor-default bg-app-muted/20`}
                                value={r.itemCode}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </InspectionLabeledField>
                          </td>
                          <td colSpan={2} className="p-1 align-top">
                            <InspectionLabeledField label="점검항목">
                              <Input
                                className={tableInputCls}
                                value={r.itemName}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateRow(r.clientKey, { itemName: e.target.value })}
                              />
                            </InspectionLabeledField>
                          </td>
                        </tr>
                        <tr className={rowBg} onClick={onSelect} aria-selected={sel}>
                          <td className="p-1 align-top">
                            <InspectionLabeledField label="점검방법">
                              <Input
                                className={tableInputCls}
                                value={r.method}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateRow(r.clientKey, { method: e.target.value })}
                              />
                            </InspectionLabeledField>
                          </td>
                          <td className="p-1 align-top">
                            <InspectionLabeledField label="판정기준">
                              <Input
                                className={tableInputCls}
                                value={r.criteria}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateRow(r.clientKey, { criteria: e.target.value })}
                              />
                            </InspectionLabeledField>
                          </td>
                          <td className="p-1 align-top">
                            <InspectionLabeledField label="점검주기">
                              <Input
                                className={tableInputCls}
                                value={r.cycle}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateRow(r.clientKey, { cycle: e.target.value })}
                              />
                            </InspectionLabeledField>
                          </td>
                          <td className="p-1 align-top">
                            <InspectionLabeledField label="비고">
                              <Input
                                className={tableInputCls}
                                value={r.remarks}
                                disabled={busy}
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateRow(r.clientKey, { remarks: e.target.value })}
                              />
                            </InspectionLabeledField>
                          </td>
                        </tr>
                        <tr className={`${rowBg} border-b-2 border-app-border`} onClick={onSelect} aria-selected={sel}>
                          <td colSpan={4} className="p-1 align-top">
                            <InspectionLabeledField label="점검항목상세내역">
                              <textarea
                                className={detailTextareaCls}
                                value={r.detail}
                                disabled={busy}
                                rows={5}
                                placeholder="점검항목 상세내역을 입력하세요."
                                aria-label="점검항목상세내역"
                                onFocus={() => setSelectedClientKey(r.clientKey)}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => updateRow(r.clientKey, { detail: e.target.value })}
                              />
                            </InspectionLabeledField>
                          </td>
                        </tr>
                      </Fragment>
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
