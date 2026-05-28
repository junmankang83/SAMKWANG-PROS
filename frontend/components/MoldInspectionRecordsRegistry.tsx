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
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION } from '@samkwang/shared';
import {
  MONTH_LABELS,
  QUARTERS,
  type MonthWeekGrid,
  coercePlanJsonRoot,
  emptyGridForItems,
  gridFromJson,
  gridToJson,
  weekCellLabel,
} from '@/lib/mold-inspection-plan-grid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

async function readApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const body = raw ? JSON.parse(raw) : null;
    if (body && typeof body === 'object') {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string') {
        return m;
      }
      if (Array.isArray(m)) {
        return m.map(String).join(', ');
      }
    }
  } catch {
    /* ignore */
  }
  return raw.trim().slice(0, 400) || `요청 실패 (${res.status})`;
}

type CodeSelectOption = { id: string; code: string; name: string };

function formatCodeSlashName(code: string, name: string): string {
  return `${code.trim()} / ${name.trim()}`;
}

type InspectionItemRow = {
  id: string;
  itemCode: string;
  itemName: string;
  detail: string;
  method: string;
  sortOrder: number;
};

type ItemRecordMeta = { remarks: string; inspectionNotes: string };

function emptyRecordMeta(itemIds: string[]): Record<string, ItemRecordMeta> {
  const o: Record<string, ItemRecordMeta> = {};
  for (const id of itemIds) {
    o[id] = { remarks: '', inspectionNotes: '' };
  }
  return o;
}

function recordMetaFromJson(json: unknown, items: InspectionItemRow[]): Record<string, ItemRecordMeta> {
  const itemIds = items.map((x) => x.id);
  const base = emptyRecordMeta(itemIds);
  const raw = coercePlanJsonRoot(json);
  if (!raw) {
    return base;
  }
  for (const it of items) {
    const eRaw = raw[it.id] ?? raw[it.itemCode.trim()];
    let e: Record<string, unknown> | null = null;
    if (typeof eRaw === 'string') {
      e = coercePlanJsonRoot(eRaw);
    } else if (eRaw && typeof eRaw === 'object' && !Array.isArray(eRaw)) {
      e = eRaw as Record<string, unknown>;
    }
    if (e) {
      const obj = e;
      base[it.id] = {
        remarks: typeof obj.remarks === 'string' ? obj.remarks : '',
        inspectionNotes: typeof obj.inspectionNotes === 'string' ? obj.inspectionNotes : '',
      };
    }
  }
  return base;
}

function recordMetaToPayload(meta: Record<string, ItemRecordMeta>, itemIds: string[]): Record<string, ItemRecordMeta> {
  const out: Record<string, ItemRecordMeta> = {};
  for (const id of itemIds) {
    const m = meta[id] ?? { remarks: '', inspectionNotes: '' };
    out[id] = {
      remarks: m.remarks.trim(),
      inspectionNotes: m.inspectionNotes.trim(),
    };
  }
  return out;
}

const WEEK_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: '1', label: '1주차' },
  { value: '2', label: '2주차' },
  { value: '3', label: '3주차' },
  { value: '4', label: '4주차' },
  { value: '5', label: '5주차' },
];

/** 월별 실적 셀렉트 — 좌우 잘림 방지(너비는 월 열 `min-w`에 맡김) */
const selectCellCls =
  'box-border h-9 w-full min-w-0 rounded border border-app-border bg-app-surface px-1.5 text-sm text-app-text';

const NOTES_MAX = 16000;

export function MoldInspectionRecordsRegistry() {
  const [categoryOptions, setCategoryOptions] = useState<CodeSelectOption[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryItemId, setCategoryItemId] = useState('');
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);

  const [items, setItems] = useState<InspectionItemRow[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  /** 계획 주차(읽기 전용 표시) */
  const [planGrid, setPlanGrid] = useState<MonthWeekGrid>({});
  /** 실적 주차(편집) */
  const [actualGrid, setActualGrid] = useState<MonthWeekGrid>({});
  const [recordMeta, setRecordMeta] = useState<Record<string, ItemRecordMeta>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailBody, setDetailBody] = useState('');

  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentItem, setContentItem] = useState<InspectionItemRow | null>(null);
  const [contentDraft, setContentDraft] = useState('');
  /** 점검내용 다이얼로그에서 삭제·저장 시 서버 반영 중 */
  const [contentPersistBusy, setContentPersistBusy] = useState(false);

  const loadSeqRef = useRef(0);

  const loadCategories = useCallback(async () => {
    setCategoryError(null);
    const res = await fetch(
      `/api/mold/code-groups/filter-items?parentCode=${encodeURIComponent(MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION)}`,
      { credentials: 'include' },
    );
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      setCategoryOptions([]);
      setCategoryError(await readApiError(res));
      return;
    }
    const data = (await res.json()) as { id: string; code: string; name: string }[];
    setCategoryOptions(data.map((r) => ({ id: r.id, code: r.code, name: r.name })));
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadData = useCallback(async () => {
    if (!categoryItemId) {
      setItems([]);
      setPlanGrid({});
      setActualGrid({});
      setRecordMeta({});
      return;
    }
    const seq = ++loadSeqRef.current;
    setBusy(true);
    setItemsError(null);
    setLoadError(null);
    setPlanGrid({});
    setActualGrid({});
    setRecordMeta({});
    try {
      const qsItems = new URLSearchParams({ categoryItemId });
      const qsPlan = new URLSearchParams({ categoryItemId, year: String(year) });
      const fetchOpts: RequestInit = { credentials: 'include', cache: 'no-store' };
      const [resItems, resPlan] = await Promise.all([
        fetch(`/api/mold/inspection-items?${qsItems}`, fetchOpts),
        fetch(`/api/mold/inspection-plans?${qsPlan}`, fetchOpts),
      ]);
      if (seq !== loadSeqRef.current) {
        return;
      }
      if (resItems.status === 401 || resPlan.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!resItems.ok) {
        if (seq !== loadSeqRef.current) {
          return;
        }
        const errItems = await readApiError(resItems);
        if (seq !== loadSeqRef.current) {
          return;
        }
        setItems([]);
        setItemsError(errItems);
        setPlanGrid({});
        setActualGrid({});
        setRecordMeta({});
        return;
      }
      const list = (await resItems.json()) as InspectionItemRow[];
      if (seq !== loadSeqRef.current) {
        return;
      }
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.itemCode.localeCompare(b.itemCode));
      setItems(list);
      const ids = list.map((x) => x.id);

      if (!resPlan.ok) {
        if (seq !== loadSeqRef.current) {
          return;
        }
        const errPlan = await readApiError(resPlan);
        if (seq !== loadSeqRef.current) {
          return;
        }
        setLoadError(errPlan);
        setPlanGrid(emptyGridForItems(ids));
        setActualGrid(emptyGridForItems(ids));
        setRecordMeta(emptyRecordMeta(ids));
        return;
      }

      const planBodyRaw = (await resPlan.json()) as unknown;

      if (seq !== loadSeqRef.current) {
        return;
      }

      const planBody =
        planBodyRaw != null && typeof planBodyRaw === 'object' && !Array.isArray(planBodyRaw)
          ? (planBodyRaw as Record<string, unknown>)
          : null;

      if (planBody) {
        if (seq !== loadSeqRef.current) {
          return;
        }
        const y = planBody.year;
        if (typeof y === 'number' && y !== year) {
          setLoadError(
            `서버 응답 연도(${y}년)와 선택 연도(${year}년)가 일치하지 않습니다. 다시 조회해 주세요.`,
          );
          setPlanGrid(emptyGridForItems(ids));
          setActualGrid(emptyGridForItems(ids));
          setRecordMeta(emptyRecordMeta(ids));
          return;
        }
        if (seq !== loadSeqRef.current) {
          return;
        }
        setPlanGrid(gridFromJson(planBody.planJson, list));
        setActualGrid(gridFromJson(planBody.actualJson ?? {}, list));
        setRecordMeta(recordMetaFromJson(planBody.recordMetaJson, list));
      } else {
        if (seq !== loadSeqRef.current) {
          return;
        }
        setPlanGrid(emptyGridForItems(ids));
        setActualGrid(emptyGridForItems(ids));
        setRecordMeta(emptyRecordMeta(ids));
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setBusy(false);
      }
    }
  }, [categoryItemId, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function setActualCell(itemId: string, monthIndex: number, value: string) {
    const w = value === '' ? null : parseInt(value, 10);
    setActualGrid((prev) => {
      const next = { ...prev };
      const row = [...(next[itemId] ?? Array(12).fill(null))];
      row[monthIndex] = w != null && w >= 1 && w <= 5 ? w : null;
      next[itemId] = row;
      return next;
    });
  }

  function openContentDialog(it: InspectionItemRow) {
    setContentItem(it);
    setContentDraft((recordMeta[it.id]?.inspectionNotes ?? '').slice(0, NOTES_MAX));
    setContentDialogOpen(true);
  }

  function closeContentDialog() {
    setContentDialogOpen(false);
    setContentItem(null);
    setContentDraft('');
  }

  async function persistInspectionPlan(
    nextMeta: Record<string, ItemRecordMeta>,
    options?: { closeContentDialog?: boolean },
  ): Promise<boolean> {
    if (!categoryItemId) {
      setLoadError('설비구분을 먼저 선택해 주세요.');
      return false;
    }
    const ids = items.map((x) => x.id);
    setLoadError(null);
    const res = await fetch('/api/mold/inspection-plans', {
      method: 'PUT',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryItemId,
        year,
        planJson: gridToJson(planGrid),
        actualJson: gridToJson(actualGrid),
        recordMetaJson: recordMetaToPayload(nextMeta, ids),
      }),
    });
    if (res.status === 401) {
      window.location.href = '/login';
      return false;
    }
    if (!res.ok) {
      setLoadError(await readApiError(res));
      return false;
    }
    setRecordMeta(nextMeta);
    if (options?.closeContentDialog) {
      closeContentDialog();
    }
    await loadData();
    return true;
  }

  async function saveContentDialog() {
    if (!contentItem) {
      return;
    }
    const trimmed = contentDraft.slice(0, NOTES_MAX);
    const nextMeta: Record<string, ItemRecordMeta> = {
      ...recordMeta,
      [contentItem.id]: {
        remarks: recordMeta[contentItem.id]?.remarks ?? '',
        inspectionNotes: trimmed,
      },
    };
    setContentPersistBusy(true);
    try {
      await persistInspectionPlan(nextMeta, { closeContentDialog: true });
    } finally {
      setContentPersistBusy(false);
    }
  }

  async function deleteContentDialog() {
    if (!contentItem || !categoryItemId) {
      return;
    }
    if (
      !window.confirm(
        '이 점검항목의 점검내용을 삭제할까요? 저장된 내용은 서버에서도 제거되며 복구할 수 없습니다.',
      )
    ) {
      return;
    }
    const nextMeta: Record<string, ItemRecordMeta> = {
      ...recordMeta,
      [contentItem.id]: {
        remarks: recordMeta[contentItem.id]?.remarks ?? '',
        inspectionNotes: '',
      },
    };
    setContentPersistBusy(true);
    try {
      await persistInspectionPlan(nextMeta, { closeContentDialog: true });
    } finally {
      setContentPersistBusy(false);
    }
  }

  async function saveRecords() {
    if (!categoryItemId) {
      setLoadError('설비구분을 먼저 선택해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await persistInspectionPlan(recordMeta);
    } finally {
      setBusy(false);
    }
  }

  const selectedLabel = useMemo(() => {
    if (!categoryItemId) {
      return '선택 안 함';
    }
    const o = categoryOptions.find((x) => x.id === categoryItemId);
    return o ? formatCodeSlashName(o.code, o.name) : categoryItemId;
  }, [categoryItemId, categoryOptions]);

  const yearOptions = useMemo(() => {
    const ys: number[] = [];
    for (let y = yearNow - 2; y <= yearNow + 6; y++) {
      ys.push(y);
    }
    return ys;
  }, [yearNow]);

  function openDetailDialog(it: InspectionItemRow) {
    setDetailTitle(`${it.itemCode} · ${it.itemName}`);
    const blocks: string[] = [];
    if (it.method?.trim()) {
      blocks.push(`[점검방법]\n${it.method.trim()}`);
    }
    if (it.detail?.trim()) {
      blocks.push(it.detail.trim());
    }
    setDetailBody(blocks.length > 0 ? blocks.join('\n\n') : '등록된 점검방법·상세 내용이 없습니다.');
    setDetailOpen(true);
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-app-text">설비점검실적내역등록</h1>
        <p className="mt-1 text-sm text-app-muted">
          설비구분·연도를 선택하면 계획(읽기 전용)과 실적 주차를 나란히 확인할 수 있습니다. 실적·점검내용을 입력한 뒤 저장하세요. 계획은 「설비점검계획등록」에서 등록합니다.
        </p>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 border-b border-app-border pb-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-app-muted">설비구분</span>
              <select
                className="h-9 min-w-[12rem] rounded-md border border-app-border bg-app-surface px-2 text-sm text-app-text"
                value={categoryItemId}
                disabled={busy}
                onChange={(e) => setCategoryItemId(e.target.value)}
                aria-label="설비구분"
              >
                <option value="">선택</option>
                {categoryOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {formatCodeSlashName(g.code, g.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-app-muted">연도</span>
              <select
                className="h-9 min-w-[6rem] rounded-md border border-app-border bg-app-surface px-2 text-sm text-app-text"
                value={year}
                disabled={busy}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label="연도"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void loadData()}>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:magnify" className="h-4 w-4 shrink-0" aria-hidden />
                조회
              </span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy || !categoryItemId}
              loading={busy}
              onClick={() => void saveRecords()}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
                저장
              </span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {categoryError ? (
            <p className="text-xs text-red-600">설비구분 목록: {categoryError}</p>
          ) : null}
          {itemsError ? (
            <Alert variant="error">
              <AlertTitle>점검항목</AlertTitle>
              <AlertDescription>{itemsError}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm text-app-text">
            <span className="font-medium text-app-muted">선택된 설비구분</span>{' '}
            <span className="font-semibold">{selectedLabel}</span>
            {categoryItemId ? (
              <>
                {' '}
                · <span className="font-medium text-app-muted">연도</span>{' '}
                <span className="font-semibold">{year}년</span>
              </>
            ) : null}
          </p>

          {!categoryItemId ? (
            <p className="text-sm text-app-muted">설비구분을 선택하면 점검항목과 표가 나타납니다.</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-app-muted">
              이 설비구분에 등록된 점검항목이 없습니다. 「점검항목관리」에서 항목을 먼저 등록해 주세요.
            </p>
          ) : (
            <div className="max-h-[min(70vh,calc(100dvh-14rem))] overflow-auto rounded-md border border-app-border">
              <table className="pros-data-table pros-data-table-head-center w-max min-w-full border-collapse text-xs text-app-text">
                <thead>
                  <tr className="bg-app-muted/30">
                    <th rowSpan={3} className="sticky left-0 z-20 w-[2.25rem] min-w-[2.25rem] bg-app-muted/40 px-0.5 text-sm">
                      NO
                    </th>
                    <th
                      rowSpan={3}
                      className="sticky left-[2.25rem] z-20 w-[6.75rem] min-w-[6.75rem] bg-app-muted/40 px-0.5 text-sm"
                    >
                      점검항목코드
                    </th>
                    <th
                      rowSpan={3}
                      className="sticky left-[calc(2.25rem+6.75rem)] z-20 w-[9.5rem] min-w-[9.5rem] bg-app-muted/40 px-0.5 text-left text-sm"
                    >
                      점검항목
                    </th>
                    <th
                      rowSpan={3}
                      className="sticky left-[calc(2.25rem+6.75rem+9.5rem)] z-20 w-[5.75rem] min-w-[5.75rem] bg-app-muted/40 px-0.5 text-center text-xs font-semibold leading-tight whitespace-normal"
                    >
                      점검 실시 내용
                    </th>
                    {QUARTERS.map((q) => (
                      <th
                        key={q.label}
                        colSpan={3}
                        className="border-l border-app-border px-1 text-center text-xs font-semibold"
                      >
                        {q.label}
                      </th>
                    ))}
                    <th rowSpan={3} className="w-[7.5rem] min-w-[7.5rem] border-l border-app-border px-1 text-sm">
                      점검내용
                    </th>
                  </tr>
                  <tr className="bg-app-muted/20">
                    {MONTH_LABELS.map((lab) => (
                      <th
                        key={lab}
                        className="w-[6.75rem] min-w-[6.75rem] border-l border-app-border px-0.5 py-1 text-xs font-semibold"
                      >
                        {lab}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-app-muted/15 text-xs font-normal text-app-muted">
                    {MONTH_LABELS.map((lab) => (
                      <th key={`${lab}-sub`} className="w-[6.75rem] min-w-[6.75rem] border-l border-app-border px-0.5 pb-1">
                        <div className="grid grid-rows-2 gap-0 border-t border-app-border/60 pt-0.5">
                          <span>계획</span>
                          <span>실적</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const planRow = planGrid[it.id] ?? Array(12).fill(null);
                    const actRow = actualGrid[it.id] ?? Array(12).fill(null);
                    const meta = recordMeta[it.id] ?? { remarks: '', inspectionNotes: '' };
                    const hasNotes = meta.inspectionNotes.trim().length > 0;
                    return (
                      <tr key={it.id}>
                        <td className="sticky left-0 z-10 w-[2.25rem] min-w-[2.25rem] bg-app-surface px-0.5 text-center align-middle text-sm">
                          {idx + 1}
                        </td>
                        <td className="sticky left-[2.25rem] z-10 w-[6.75rem] min-w-[6.75rem] bg-app-surface px-0.5 align-middle font-mono text-xs leading-tight">
                          {it.itemCode}
                        </td>
                        <td className="sticky left-[calc(2.25rem+6.75rem)] z-10 w-[9.5rem] min-w-[9.5rem] bg-app-surface px-0.5 align-middle text-left text-xs leading-snug">
                          {it.itemName}
                        </td>
                        <td className="sticky left-[calc(2.25rem+6.75rem+9.5rem)] z-10 w-[5.75rem] min-w-[5.75rem] bg-app-surface px-0.5 text-center align-middle">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full max-w-none px-1 text-xs leading-tight"
                            disabled={busy}
                            onClick={() => openDetailDialog(it)}
                          >
                            상세보기
                          </Button>
                        </td>
                        {MONTH_LABELS.map((_, mi) => (
                          <td
                            key={`c-${it.id}-${mi}`}
                            className="w-[6.75rem] min-w-[6.75rem] border-l border-app-border bg-app-muted/10 p-1 align-middle"
                          >
                            <div className="flex w-full min-w-0 flex-col gap-1 py-0.5">
                              <div className="flex min-h-[1.25rem] items-center justify-center text-center text-xs leading-tight text-app-text">
                                {weekCellLabel(planRow[mi])}
                              </div>
                              <select
                                className={selectCellCls}
                                disabled={busy}
                                value={actRow[mi] != null ? String(actRow[mi]) : ''}
                                aria-label={`${it.itemName} ${mi + 1}월 실적 주차`}
                                onChange={(e) => setActualCell(it.id, mi, e.target.value)}
                              >
                                {WEEK_OPTIONS.map((o) => (
                                  <option key={o.value || 'x'} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        ))}
                        <td className="w-[7.5rem] min-w-[7.5rem] border-l border-app-border bg-app-surface p-1 text-center align-middle">
                          <div className="flex flex-col items-center gap-1">
                            {hasNotes ? (
                              <span className="text-xs text-emerald-700 dark:text-emerald-400">등록됨</span>
                            ) : (
                              <span className="text-xs text-app-muted">미등록</span>
                            )}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 w-full px-1 text-xs leading-tight"
                              disabled={busy}
                              onClick={() => openContentDialog(it)}
                            >
                              점검내용등록
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>점검 실시 내용</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <p className="text-sm font-semibold text-app-text">{detailTitle}</p>
            <div className="max-h-[min(65vh,32rem)] overflow-y-auto rounded-md border border-app-border bg-app-muted/10 p-3 text-left text-sm leading-relaxed text-app-text">
              <pre className="whitespace-pre-wrap font-sans">{detailBody}</pre>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDetailOpen(false)}>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="mdi:close" className="h-4 w-4 shrink-0" aria-hidden />
                닫기
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contentDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setContentDialogOpen(false);
            setContentItem(null);
            setContentDraft('');
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>점검내용 등록</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {contentItem ? (
              <p className="text-sm font-semibold text-app-text">
                {contentItem.itemCode} · {contentItem.itemName}
              </p>
            ) : null}
            <textarea
              className="min-h-[min(50vh,20rem)] w-full rounded-md border border-app-border bg-app-surface p-3 text-sm leading-relaxed text-app-text"
              placeholder="점검 시 확인한 내용·특이사항 등을 입력하세요."
              maxLength={NOTES_MAX}
              value={contentDraft}
              disabled={busy || contentPersistBusy}
              onChange={(e) => setContentDraft(e.target.value.slice(0, NOTES_MAX))}
              aria-label="점검내용"
            />
            <p className="text-right text-[11px] text-app-muted">
              {contentDraft.length} / {NOTES_MAX}
            </p>
          </DialogBody>
          <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || contentPersistBusy}
              onClick={() => {
                setContentDialogOpen(false);
                setContentItem(null);
                setContentDraft('');
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
              disabled={busy || contentPersistBusy || !contentItem}
              loading={contentPersistBusy}
              onClick={() => void deleteContentDialog()}
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
              disabled={busy || contentPersistBusy || !contentItem}
              loading={contentPersistBusy}
              onClick={() => void saveContentDialog()}
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
