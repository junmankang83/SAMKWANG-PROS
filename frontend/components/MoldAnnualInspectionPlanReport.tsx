'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { MOLD_PARENT_CODE_GROUP_EQUIPMENT_DIVISION, type AuthUser } from '@samkwang/shared';
import {
  MONTH_LABELS,
  QUARTERS,
  type MonthWeekGrid,
  coercePlanJsonRoot,
  emptyGridForItems,
  gridFromJson,
  weekCellLabel,
} from '@/lib/mold-inspection-plan-grid';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

/** 표시용 작성자: name 우선, 없으면 username·id */
function authorFromUser(u: AuthUser): string {
  const name = typeof u.name === 'string' ? u.name.trim() : '';
  if (name.length > 0) {
    return name;
  }
  const username = typeof u.username === 'string' ? u.username.trim() : '';
  if (username.length > 0) {
    return username;
  }
  const id = typeof u.id === 'string' ? u.id.trim() : '';
  return id.length > 0 ? id : '';
}

/** 로컬 날짜를 `YYYY-MM-DD`로 (date input value) */
function formatIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMethodDetailBody(it: InspectionItemRow): string {
  const blocks: string[] = [];
  if (it.method?.trim()) {
    blocks.push(`[점검방법]\n${it.method.trim()}`);
  }
  if (it.detail?.trim()) {
    blocks.push(it.detail.trim());
  }
  return blocks.length > 0 ? blocks.join('\n\n') : '—';
}

function emptyRemarks(itemIds: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const id of itemIds) {
    o[id] = '';
  }
  return o;
}

/** 계획 recordMetaJson 항목 → 비고 열 표시용 (비고 필드 + 실적 화면의 점검내용(inspectionNotes)) */
function remarksFromRecordMetaJson(json: unknown, items: InspectionItemRow[]): Record<string, string> {
  const itemIds = items.map((x) => x.id);
  const base = emptyRemarks(itemIds);
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
      const remarks = typeof e.remarks === 'string' ? e.remarks.trim() : '';
      const inspectionNotes = typeof e.inspectionNotes === 'string' ? e.inspectionNotes.trim() : '';
      const parts = [inspectionNotes, remarks].filter((s) => s.length > 0);
      base[it.id] = parts.join('\n\n');
    }
  }
  return base;
}

function injectLandscapePrintPageStyle(): () => void {
  const style = document.createElement('style');
  style.setAttribute('data-pros-annual-inspection-print', '1');
  style.textContent = '@media print { @page { size: landscape; margin: 8mm; } }';
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

export type MoldAnnualInspectionPlanReportProps = {
  user: AuthUser;
};

export function MoldAnnualInspectionPlanReport({ user }: MoldAnnualInspectionPlanReportProps) {
  const [categoryOptions, setCategoryOptions] = useState<CodeSelectOption[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryItemId, setCategoryItemId] = useState('');
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);

  const [department, setDepartment] = useState(() => (user.organization ?? '').toString().trim());
  const [authorName, setAuthorName] = useState(() => authorFromUser(user));
  const [writtenDateIso, setWrittenDateIso] = useState(() => formatIsoDateLocal(new Date()));

  const [items, setItems] = useState<InspectionItemRow[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [planGrid, setPlanGrid] = useState<MonthWeekGrid>({});
  const [actualGrid, setActualGrid] = useState<MonthWeekGrid>({});
  const [remarksByItemId, setRemarksByItemId] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queried, setQueried] = useState(false);

  const loadSeqRef = useRef(0);

  /** 서버에서 넘어온 user가 비는 경우(직렬화 등) `/api/auth/me`로 보강 */
  useEffect(() => {
    setDepartment((user.organization ?? '').toString().trim());
    const fromProp = authorFromUser(user);
    setAuthorName(fromProp);
    if (fromProp.length > 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (!res.ok || cancelled) {
          return;
        }
        const body = (await res.json()) as { user?: AuthUser };
        if (cancelled || !body.user) {
          return;
        }
        const a = authorFromUser(body.user);
        if (a) {
          setAuthorName(a);
        }
        const org = body.user.organization;
        if (typeof org === 'string' && org.trim().length > 0) {
          setDepartment(org.trim());
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, user.username, user.name, user.organization]);

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

  useEffect(() => {
    setQueried(false);
    setItems([]);
    setItemsError(null);
    setLoadError(null);
    setPlanGrid({});
    setActualGrid({});
    setRemarksByItemId({});
  }, [categoryItemId, year]);

  const fetchReport = useCallback(async () => {
    if (!categoryItemId) {
      setLoadError('설비구분을 선택한 뒤 조회해 주세요.');
      return;
    }
    const seq = ++loadSeqRef.current;
    setBusy(true);
    setItemsError(null);
    setLoadError(null);
    setQueried(true);
    setItems([]);
    setPlanGrid({});
    setActualGrid({});
    setRemarksByItemId({});
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
        const errItems = await readApiError(resItems);
        if (seq !== loadSeqRef.current) {
          return;
        }
        setItems([]);
        setItemsError(errItems);
        setPlanGrid({});
        setActualGrid({});
        setRemarksByItemId({});
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
        const errPlan = await readApiError(resPlan);
        if (seq !== loadSeqRef.current) {
          return;
        }
        setLoadError(errPlan);
        setPlanGrid(emptyGridForItems(ids));
        setActualGrid(emptyGridForItems(ids));
        setRemarksByItemId(emptyRemarks(ids));
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
        const y = planBody.year;
        if (typeof y === 'number' && y !== year) {
          setLoadError(
            `서버 응답 연도(${y}년)와 선택 연도(${year}년)가 일치하지 않습니다. 다시 조회해 주세요.`,
          );
          setPlanGrid(emptyGridForItems(ids));
          setActualGrid(emptyGridForItems(ids));
          setRemarksByItemId(emptyRemarks(ids));
          return;
        }
        setPlanGrid(gridFromJson(planBody.planJson, list));
        setActualGrid(gridFromJson(planBody.actualJson ?? {}, list));
        setRemarksByItemId(remarksFromRecordMetaJson(planBody.recordMetaJson, list));
      } else {
        setPlanGrid(emptyGridForItems(ids));
        setActualGrid(emptyGridForItems(ids));
        setRemarksByItemId(emptyRemarks(ids));
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setBusy(false);
      }
    }
  }, [categoryItemId, year]);

  const yearOptions = useMemo(() => {
    const ys: number[] = [];
    for (let y = yearNow - 2; y <= yearNow + 6; y++) {
      ys.push(y);
    }
    return ys;
  }, [yearNow]);

  function handlePrint() {
    const remove = injectLandscapePrintPageStyle();
    const onAfterPrint = () => {
      remove();
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);
    window.print();
    window.setTimeout(() => {
      remove();
      window.removeEventListener('afterprint', onAfterPrint);
    }, 3000);
  }

  /** 본문 표: `MoldInspectionRecordsRegistry` 표와 동일한 글자 크기 체계(text-xs 기본, NO·주요 헤더 text-sm, 분기·월 text-xs font-semibold) */
  const cellBorder =
    'border border-black px-0.5 py-0.5 align-middle text-center text-xs leading-tight print:text-xs';
  const monthColCls = 'min-w-0 align-middle print:min-w-0';
  const headBg = 'bg-[#d9d9d9] font-semibold text-black';
  /** 구분 열: 계획·실적 라벨 — 실적내역 월 하위 행과 동일 크기 */
  const kindWordCls =
    'inline-block w-full text-center text-xs font-semibold leading-tight text-black print:text-xs';
  /** 분기·월 헤더 */
  const quarterHeaderCls = `${cellBorder} ${headBg} min-h-[4rem] py-0 align-middle print:min-h-[3.5rem]`;
  const monthHeaderCls = `${cellBorder} ${headBg} ${monthColCls} min-h-[4rem] py-0 align-middle print:min-h-[3.5rem]`;
  const quarterMonthHeaderInner =
    'flex min-h-[4rem] w-full flex-col items-center justify-center px-1 py-3 text-xs font-semibold leading-tight print:min-h-[3.5rem] print:py-2.5';
  const headerApprovalLabel = `${headBg} border border-black px-0 py-0 align-middle text-center text-xs font-semibold text-black print:text-xs`;
  const headerApprovalLabelInner = 'flex min-h-[2rem] items-center justify-center px-1 py-0.5';
  const headerApprovalSig = 'border border-black bg-white align-middle p-0 print:min-h-0';
  const headerApprovalSigInner = 'flex min-h-[2.75rem] w-full items-center justify-center print:min-h-[2.5rem]';
  /** 좌 메타 열 고정 27rem · 중앙 제목 · 우 결재 22% */
  /** 메타 내부: 라벨 4.5rem + 값 칸 고정 9rem×2 (1fr 없음 → 뷰포트에 따라 칸이 커지지 않음) */
  const docMetaLabelCol = 'w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] shrink-0';
  const docMetaTh =
    `${headBg} ${docMetaLabelCol} box-border flex h-full min-h-0 items-center justify-center border border-black px-1 py-0.5 text-center text-xs font-semibold leading-none text-black print:text-xs`;
  const docMetaTd =
    'box-border flex h-full min-h-0 min-w-0 items-center justify-center border border-black bg-white p-0 align-middle overflow-visible [&_input]:box-border [&_input]:min-h-[2rem] [&_input]:w-full [&_input]:min-w-0 [&_input]:max-w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1.5 [&_input]:text-center [&_input]:text-sm [&_input]:text-black [&_input]:outline-none print:[&_input]:text-sm [&_input[type=date]]:cursor-pointer [&_input[type=date]]:max-w-full';

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-app-text">연간 설비점검 계획서</h1>
      </div>

      {loadError ? (
        <Alert variant="error" className="print:hidden">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="print:hidden flex w-full flex-wrap items-end justify-between gap-4 border-b border-app-border pb-4">
        <div className="flex min-w-0 flex-wrap items-end gap-4">
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void fetchReport()}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:magnify" className="h-4 w-4 shrink-0" aria-hidden />
              조회
            </span>
          </Button>
          <Button type="button" size="sm" disabled={busy || !queried || items.length === 0} onClick={handlePrint}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="mdi:printer-outline" className="h-4 w-4 shrink-0" aria-hidden />
              인쇄
            </span>
          </Button>
        </div>
      </div>

      {categoryError ? (
        <p className="text-xs text-red-600 print:hidden">설비구분 목록: {categoryError}</p>
      ) : null}

      <article className="pros-annual-inspection-report w-full max-w-none bg-white text-black print:w-full print:max-w-none print:bg-white print:text-black">
        <header className="pros-annual-inspection-header mb-0 print:mb-0">
          {/* 좌측 메타: 고정 27rem 열 + w-full(여백 없음) / 중앙 제목 · 우 결재 */}
          <div className="grid min-h-[6.75rem] w-full border border-black bg-white [grid-template-columns:27rem_minmax(0,1fr)_22%] [grid-template-rows:1fr_1fr] print:min-h-[6.25rem] sm:[grid-template-columns:27rem_minmax(0,1fr)_22%]">
            <div className="col-start-1 row-span-2 row-start-1 grid h-full min-h-0 w-full shrink-0 grid-cols-[4.5rem_9rem_4.5rem_9rem] grid-rows-2 border-r border-black">
              <div className={docMetaTh}>부서</div>
              <div className={`${docMetaTd} col-span-3 min-w-0`}>
                <input
                  value={department ?? ''}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder=""
                  aria-label="부서"
                />
              </div>
              <div className={docMetaTh}>작성자</div>
              <div className={`${docMetaTd} min-w-0`}>
                <input
                  value={authorName ?? ''}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder=""
                  aria-label="작성자"
                />
              </div>
              <div className={docMetaTh}>작성일</div>
              <div className={`${docMetaTd} min-w-0`}>
                <input
                  type="date"
                  value={writtenDateIso}
                  onChange={(e) => setWrittenDateIso(e.target.value)}
                  aria-label="작성일"
                />
              </div>
              </div>
            <div className="col-start-2 row-span-2 row-start-1 flex h-full min-h-0 items-center justify-center border-r border-black px-0 py-2 print:py-1.5">
              <h2 className="text-center text-[1.35rem] font-bold leading-snug text-black print:text-[17pt] sm:text-2xl sm:print:text-[20pt]">
                연간 설비점검 계획서
              </h2>
            </div>
            <div className="col-start-3 row-span-2 row-start-1 h-full min-h-0 p-0">
              <table className="h-full w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <tbody>
                  <tr className="h-8 print:h-8">
                    <th
                      rowSpan={2}
                      scope="row"
                      className={`${headBg} border border-black px-0.5 py-1 align-middle text-center text-xs font-semibold leading-snug text-black print:text-xs`}
                    >
                      <span className="inline-flex min-h-[2.5rem] flex-col items-center justify-center gap-0.5 print:min-h-[2.25rem]">
                        <span>결</span>
                        <span>재</span>
                      </span>
                    </th>
                    {['작성', '검토', '확인', '승인'].map((label) => (
                      <th key={label} className={headerApprovalLabel}>
                        <span className={headerApprovalLabelInner}>{label}</span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <td key={i} className={headerApprovalSig} aria-hidden>
                        <div className={headerApprovalSigInner} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </header>

        {itemsError ? (
          <Alert variant="error" className="mt-0 print:hidden">
            <AlertTitle>점검항목</AlertTitle>
            <AlertDescription>{itemsError}</AlertDescription>
          </Alert>
        ) : null}

        {!queried ? (
          <p className="mt-0 text-sm text-app-muted print:hidden">설비구분과 연도를 선택한 뒤 「조회」를 눌러 주세요.</p>
        ) : items.length === 0 ? (
          <p className="mt-0 text-sm text-app-muted print:hidden">
            이 설비구분에 등록된 점검항목이 없거나 조회 결과가 비어 있습니다.
          </p>
        ) : (
          <div className="mt-0 w-full min-w-0 max-w-full">
            <div className="w-full min-w-0 max-w-full">
              <div className="overflow-x-auto rounded-md border border-black print:overflow-visible print:rounded-none">
                <table className="w-full min-w-[42rem] table-fixed border-collapse border border-black text-xs text-black print:min-w-0 print:text-xs">
                  <colgroup>
                    <col style={{ width: '2.5%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '17.5%' }} />
                    <col style={{ width: '4%' }} />
                    {Array.from({ length: 12 }, (_, i) => (
                      <col key={`annual-month-col-${i}`} style={{ width: `${56 / 12}%` }} />
                    ))}
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2} className={`${cellBorder} ${headBg}`}>
                        <span className="inline-flex min-h-[3rem] w-full flex-col items-center justify-center gap-0 px-0.5 text-sm print:min-h-[2.75rem]">
                          NO
                        </span>
                      </th>
                      <th rowSpan={2} className={`${cellBorder} ${headBg}`}>
                        <span className="inline-flex min-h-[3rem] w-full flex-col items-center justify-center gap-0 px-0.5 text-sm leading-tight print:min-h-[2.75rem]">
                          <span>점검 및</span>
                          <span>관리 항목</span>
                        </span>
                      </th>
                      <th rowSpan={2} className={`${cellBorder} ${headBg}`}>
                        <span className="inline-flex min-h-[3rem] w-full flex-col items-center justify-center gap-0 px-0.5 text-xs font-semibold leading-tight print:min-h-[2.75rem]">
                          점검 실시 내용
                        </span>
                      </th>
                      <th rowSpan={2} className={`${cellBorder} ${headBg} w-[2.75rem] max-w-[3.25rem] px-0`}>
                        <span className="inline-flex min-h-[3rem] w-full flex-col items-center justify-center gap-0 text-xs font-semibold print:min-h-[2.75rem]">
                          구분
                        </span>
                      </th>
                      {QUARTERS.map((q) => (
                        <th key={q.label} colSpan={q.months.length} className={quarterHeaderCls}>
                          <span className={quarterMonthHeaderInner}>{q.label}</span>
                        </th>
                      ))}
                      <th rowSpan={2} className={`${cellBorder} ${headBg}`}>
                        <span className="inline-flex min-h-[3rem] w-full flex-col items-center justify-center gap-0 px-0.5 text-sm leading-tight print:min-h-[2.75rem]">
                          비고
                        </span>
                      </th>
                    </tr>
                    <tr>
                      {MONTH_LABELS.map((lab) => (
                        <th key={lab} className={monthHeaderCls}>
                          <span className={quarterMonthHeaderInner}>{lab}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const planRow = planGrid[it.id] ?? Array(12).fill(null);
                      const actualRow = actualGrid[it.id] ?? Array(12).fill(null);
                      const remarksDisplay = remarksByItemId[it.id]?.trim() ?? '';
                      return (
                        <Fragment key={it.id}>
                          <tr>
                            <td rowSpan={2} className={`${cellBorder} bg-white align-middle`}>
                              <div className="flex min-h-[2.5rem] items-center justify-center text-sm">{idx + 1}</div>
                            </td>
                            <td rowSpan={2} className={`${cellBorder} bg-white align-middle text-left text-xs leading-snug print:text-xs`}>
                              <div className="flex min-h-[2.5rem] items-center justify-start py-0.5">{it.itemName}</div>
                            </td>
                            <td
                              rowSpan={2}
                              className={`${cellBorder} !text-left bg-white align-top break-words whitespace-pre-wrap text-xs leading-snug print:text-xs`}
                            >
                              <div className="min-h-[2.5rem] w-full py-0.5 pr-0.5 text-left">{formatMethodDetailBody(it)}</div>
                            </td>
                            <td className={`${cellBorder} bg-white px-0 py-0 align-middle`}>
                              <div className="flex min-h-[2.25rem] items-center justify-center py-1">
                                <span className={kindWordCls}>계획</span>
                              </div>
                            </td>
                            {MONTH_LABELS.map((_, mi) => (
                              <td key={`p-${it.id}-${mi}`} className={`${cellBorder} bg-white ${monthColCls} p-0 align-middle`}>
                                <div className="flex min-h-[2.25rem] items-center justify-center px-0.5 py-0.5 text-xs leading-tight print:text-xs">
                                  {weekCellLabel(planRow[mi])}
                                </div>
                              </td>
                            ))}
                            <td rowSpan={2} className={`${cellBorder} bg-white align-middle break-words whitespace-pre-wrap text-left text-xs leading-snug print:text-xs`}>
                              <div className="flex min-h-[2.5rem] items-center justify-start py-0.5">{remarksDisplay}</div>
                            </td>
                          </tr>
                          <tr>
                            <td className={`${cellBorder} bg-white px-0 py-0 align-middle`}>
                              <div className="flex min-h-[2.25rem] items-center justify-center py-1">
                                <span className={kindWordCls}>실적</span>
                              </div>
                            </td>
                            {MONTH_LABELS.map((_, mi) => (
                              <td key={`a-${it.id}-${mi}`} className={`${cellBorder} bg-white ${monthColCls} p-0 align-middle`}>
                                <div className="flex min-h-[2.25rem] items-center justify-center px-0.5 py-0.5 text-xs leading-tight print:text-xs">
                                  {weekCellLabel(actualRow[mi])}
                                </div>
                              </td>
                            ))}
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
