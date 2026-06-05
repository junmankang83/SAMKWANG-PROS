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
  emptyGridForItems,
  gridFromJson,
  gridToJson,
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

const WEEK_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: '1', label: '1주차' },
  { value: '2', label: '2주차' },
  { value: '3', label: '3주차' },
  { value: '4', label: '4주차' },
  { value: '5', label: '5주차' },
];

const selectCellCls =
  'h-8 w-full min-w-[4.25rem] max-w-[6rem] rounded border border-app-border bg-app-surface px-0.5 text-xs text-app-text';

export function MoldInspectionPlanRegistry() {
  const [categoryOptions, setCategoryOptions] = useState<CodeSelectOption[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryItemId, setCategoryItemId] = useState('');
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);

  const [items, setItems] = useState<InspectionItemRow[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [planGrid, setPlanGrid] = useState<MonthWeekGrid>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailBody, setDetailBody] = useState('');

  /** 설비구분+연도 조회가 겹칠 때 이전 응답이 나중에 도착해 잘못된 연도 데이터를 쓰지 않도록 함 */
  const loadItemsPlanSeqRef = useRef(0);

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

  const loadItemsAndPlan = useCallback(async () => {
    if (!categoryItemId) {
      setItems([]);
      setPlanGrid({});
      return;
    }
    const seq = ++loadItemsPlanSeqRef.current;
    setBusy(true);
    setItemsError(null);
    setLoadError(null);
    setPlanGrid({});
    try {
      const qsItems = new URLSearchParams({ categoryItemId });
      const qsPlan = new URLSearchParams({ categoryItemId, year: String(year) });
      const fetchOpts: RequestInit = { credentials: 'include', cache: 'no-store' };
      const [resItems, resPlan] = await Promise.all([
        fetch(`/api/mold/inspection-items?${qsItems}`, fetchOpts),
        fetch(`/api/mold/inspection-plans?${qsPlan}`, fetchOpts),
      ]);
      if (seq !== loadItemsPlanSeqRef.current) {
        return;
      }
      if (resItems.status === 401 || resPlan.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!resItems.ok) {
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        const errItems = await readApiError(resItems);
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        setItems([]);
        setItemsError(errItems);
        setPlanGrid({});
        return;
      }
      const list = (await resItems.json()) as InspectionItemRow[];
      if (seq !== loadItemsPlanSeqRef.current) {
        return;
      }
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.itemCode.localeCompare(b.itemCode));
      setItems(list);
      const ids = list.map((x) => x.id);

      if (!resPlan.ok) {
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        const errPlan = await readApiError(resPlan);
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        setLoadError(errPlan);
        setPlanGrid(emptyGridForItems(ids));
        return;
      }
      const planBodyRaw = (await resPlan.json()) as unknown;
      if (seq !== loadItemsPlanSeqRef.current) {
        return;
      }
      const planBody =
        planBodyRaw != null && typeof planBodyRaw === 'object' && !Array.isArray(planBodyRaw)
          ? (planBodyRaw as Record<string, unknown>)
          : null;

      if (planBody) {
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        const y = planBody.year;
        if (typeof y === 'number' && y !== year) {
          if (seq !== loadItemsPlanSeqRef.current) {
            return;
          }
          setLoadError(`서버 응답 연도(${y}년)와 선택 연도(${year}년)가 일치하지 않습니다. 다시 조회해 주세요.`);
          setPlanGrid(emptyGridForItems(ids));
          return;
        }
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        setPlanGrid(gridFromJson(planBody.planJson, list));
      } else {
        if (seq !== loadItemsPlanSeqRef.current) {
          return;
        }
        setPlanGrid(emptyGridForItems(ids));
      }
    } finally {
      if (seq === loadItemsPlanSeqRef.current) {
        setBusy(false);
      }
    }
  }, [categoryItemId, year]);

  useEffect(() => {
    void loadItemsAndPlan();
  }, [loadItemsAndPlan]);

  function setPlanCell(itemId: string, monthIndex: number, value: string) {
    const w = value === '' ? null : parseInt(value, 10);
    setPlanGrid((prev) => {
      const next = { ...prev };
      const row = [...(next[itemId] ?? Array(12).fill(null))];
      row[monthIndex] = w != null && w >= 1 && w <= 5 ? w : null;
      next[itemId] = row;
      return next;
    });
  }

  async function savePlan() {
    if (!categoryItemId) {
      setLoadError('설비구분을 먼저 선택해 주세요.');
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mold/inspection-plans', {
        method: 'PUT',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryItemId,
          year,
          planJson: gridToJson(planGrid),
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
      await loadItemsAndPlan();
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
        <h1 className="text-xl font-semibold text-app-text">설비점검계획등록</h1>
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
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void loadItemsAndPlan()}>
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
              onClick={() => void savePlan()}
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
            <p className="text-sm text-app-muted">설비구분을 선택하면 점검항목과 일정 표가 나타납니다.</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-app-muted">
              이 설비구분에 등록된 점검항목이 없습니다. 「점검항목관리」에서 항목을 먼저 등록해 주세요.
            </p>
          ) : (
            <div className="max-h-[min(70vh,calc(100dvh-14rem))] overflow-auto rounded-md border border-app-border">
              <table className="pros-data-table pros-data-table-head-center w-max min-w-full border-collapse text-xs text-app-text">
                <thead>
                  <tr className="bg-app-muted/30">
                    <th rowSpan={2} className="sticky left-0 z-20 min-w-[2.5rem] bg-app-muted/40 px-1 text-sm">
                      NO
                    </th>
                    <th rowSpan={2} className="sticky left-[2.5rem] z-20 min-w-[7rem] bg-app-muted/40 px-1 text-sm">
                      점검항목코드
                    </th>
                    <th rowSpan={2} className="sticky left-[calc(2.5rem+7rem)] z-20 min-w-[10rem] bg-app-muted/40 px-1 text-sm">
                      점검항목
                    </th>
                    <th rowSpan={2} className="sticky left-[calc(2.5rem+7rem+10rem)] z-20 min-w-[5.5rem] max-w-[6rem] bg-app-muted/40 px-1 text-sm">
                      점검 실시 내용
                    </th>
                    {QUARTERS.map((q) => (
                      <th key={q.label} colSpan={3} className="border-l border-app-border px-1 text-center text-[11px] font-semibold">
                        {q.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-app-muted/20">
                    {MONTH_LABELS.map((lab) => (
                      <th
                        key={lab}
                        className="min-w-[4.5rem] border-l border-app-border px-0.5 py-1 text-[11px] font-semibold"
                      >
                        {lab}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const planRow = planGrid[it.id] ?? Array(12).fill(null);
                    return (
                      <tr key={it.id}>
                        <td className="sticky left-0 z-10 bg-app-surface px-1 text-center align-middle text-sm">{idx + 1}</td>
                        <td className="sticky left-[2.5rem] z-10 bg-app-surface px-1 align-middle font-mono text-xs">
                          {it.itemCode}
                        </td>
                        <td className="sticky left-[calc(2.5rem+7rem)] z-10 bg-app-surface px-1 align-middle text-left text-xs leading-snug">
                          {it.itemName}
                        </td>
                        <td className="sticky left-[calc(2.5rem+7rem+10rem)] z-10 w-[5.5rem] min-w-[5.5rem] max-w-[6rem] bg-app-surface px-1 text-center align-middle">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full px-1 text-xs"
                            disabled={busy}
                            onClick={() => openDetailDialog(it)}
                          >
                            상세보기
                          </Button>
                        </td>
                        {MONTH_LABELS.map((_, mi) => (
                          <td
                            key={`p-${it.id}-${mi}`}
                            className="border-l border-app-border bg-app-muted/10 p-0.5 align-middle"
                          >
                            <select
                              className={selectCellCls}
                              disabled={busy}
                              value={planRow[mi] != null ? String(planRow[mi]) : ''}
                              aria-label={`${it.itemName} ${mi + 1}월 계획 주차`}
                              onChange={(e) => setPlanCell(it.id, mi, e.target.value)}
                            >
                              {WEEK_OPTIONS.map((o) => (
                                <option key={o.value || 'x'} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        ))}
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
    </div>
  );
}
