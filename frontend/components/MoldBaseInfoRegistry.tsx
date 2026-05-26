'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

type MoldCodeGroupRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
};

type MoldCodeItemRow = {
  id: string;
  groupId: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
};

type GroupEditable = {
  clientKey: string;
  id?: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
};

type ItemEditable = {
  clientKey: string;
  id?: string;
  code: string;
  name: string;
  category: string;
  description: string;
  sortOrder: number;
};

function newClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 엑셀 열 문자열(A, B, …, Z, AA, …)을 0 기반 인덱스로 */
function parentLettersToIndex(letters: string): number {
  let sum = 0;
  for (let i = 0; i < letters.length; i++) {
    const c = letters.charCodeAt(i);
    if (c < 65 || c > 90) {
      return -1;
    }
    sum = sum * 26 + (c - 64);
  }
  return sum - 1;
}

/** 0 기반 인덱스 → A, B, …, Z, AA, … */
function indexToParentLetters(zeroBased: number): string {
  let n = zeroBased + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** 상위 코드 행 추가 시: 기존 `A-001` 형식 중 가장 큰 문자 다음 + `-001` */
function suggestNextParentGroupCode(groups: GroupEditable[]): string {
  let maxIdx = -1;
  for (const g of groups) {
    const t = g.code.trim();
    const m = t.match(/^([A-Za-z]+)-(\d+)$/);
    if (!m) {
      continue;
    }
    const letters = m[1].toUpperCase();
    const idx = parentLettersToIndex(letters);
    if (idx >= 0) {
      maxIdx = Math.max(maxIdx, idx);
    }
  }
  const next = indexToParentLetters(maxIdx + 1);
  return `${next}-001`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 상위 `C-001` → 하위 첫 줄 `C-S-001` (첫 `-` 앞 글자 뒤에 `-S-` 삽입). 동일 패턴 다건이면 끝 숫자 증가 */
function suggestNextChildItemCode(parentCode: string, items: ItemEditable[]): string {
  const trimmed = parentCode.trim();
  const dash = trimmed.indexOf('-');
  if (dash <= 0) {
    return '';
  }
  const head = trimmed.slice(0, dash);
  const rest = trimmed.slice(dash + 1);
  if (!head || !rest) {
    return '';
  }
  const prefix = `${head}-S-`;
  const restIsDigits = /^\d+$/.test(rest);
  const parentNum = restIsDigits ? parseInt(rest, 10) : NaN;
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);

  let maxSeq = Number.isFinite(parentNum) ? parentNum - 1 : -1;
  for (const it of items) {
    const m = it.code.trim().match(re);
    if (m) {
      maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
  }
  const next = maxSeq + 1;
  const width = Math.max(3, rest.length, String(next).length);
  return `${prefix}${String(next).padStart(width, '0')}`;
}

function serializeGroup(g: Pick<GroupEditable, 'code' | 'name' | 'category' | 'description' | 'sortOrder'>) {
  return JSON.stringify({
    code: g.code.trim(),
    name: g.name.trim(),
    category: g.category.trim(),
    description: g.description.trim(),
    sortOrder: g.sortOrder,
  });
}

function serializeItem(g: Pick<ItemEditable, 'code' | 'name' | 'category' | 'description' | 'sortOrder'>) {
  return serializeGroup(g);
}

function mapGroupFromApi(row: MoldCodeGroupRow): GroupEditable {
  return {
    clientKey: row.id,
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

function mapItemFromApi(row: MoldCodeItemRow): ItemEditable {
  return {
    clientKey: row.id,
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

function ArrowBridge() {
  return (
    <div
      className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 self-center px-1 text-center sm:w-40 sm:px-2"
      aria-hidden
    >
      <Icon icon="mdi:arrow-right-bold" className="h-10 w-20 text-brand" />
      <p className="text-xs leading-snug text-app-muted">
        저장된 왼쪽 행을 <span className="font-medium text-app-text">더블클릭</span>하면 하위 코드를
        조회·등록할 수 있습니다.
      </p>
    </div>
  );
}

export function MoldBaseInfoRegistry() {
  const [groups, setGroups] = useState<GroupEditable[]>([]);
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedItemClientKey, setSelectedItemClientKey] = useState<string | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);

  const groupBaseline = useRef<Map<string, string>>(new Map());
  const itemBaseline = useRef<Map<string, string>>(new Map());

  const selectedGroup = useMemo(
    () => groups.find((g) => g.clientKey === selectedClientKey) ?? null,
    [groups, selectedClientKey],
  );
  const itemsPanelEnabled = Boolean(detailGroupId);

  const selectedItem = useMemo(
    () => items.find((it) => it.clientKey === selectedItemClientKey) ?? null,
    [items, selectedItemClientKey],
  );

  const rebuildGroupBaseline = useCallback((rows: GroupEditable[]) => {
    const m = new Map<string, string>();
    for (const g of rows) {
      if (g.id) {
        m.set(g.id, serializeGroup(g));
      }
    }
    groupBaseline.current = m;
  }, []);

  const rebuildItemBaseline = useCallback((rows: ItemEditable[]) => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.id) {
        m.set(r.id, serializeItem(r));
      }
    }
    itemBaseline.current = m;
  }, []);

  const reloadGroups = useCallback(async (): Promise<GroupEditable[] | null> => {
    setLoadError(null);
    const res = await fetch('/api/mold/code-groups', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/login';
      return null;
    }
    if (!res.ok) {
      setLoadError(await readApiError(res));
      return null;
    }
    const data = (await res.json()) as MoldCodeGroupRow[];
    const mapped = data.map(mapGroupFromApi);
    setGroups(mapped);
    rebuildGroupBaseline(mapped);
    return mapped;
  }, [rebuildGroupBaseline]);

  const reloadItems = useCallback(
    async (groupId: string): Promise<ItemEditable[] | null> => {
      setItemsError(null);
      const res = await fetch(`/api/mold/code-groups/${groupId}/items`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) {
        setItemsError(await readApiError(res));
        setItems([]);
        rebuildItemBaseline([]);
        return null;
      }
      const data = (await res.json()) as MoldCodeItemRow[];
      const mapped = data.map(mapItemFromApi);
      setItems(mapped);
      rebuildItemBaseline(mapped);
      return mapped;
    },
    [rebuildItemBaseline],
  );

  const inquireMaster = useCallback(async () => {
    if (busy) return;
    const openDetail = detailGroupId;
    const selId = selectedGroup?.id ?? null;
    const selKey = selectedClientKey;
    setBusy(true);
    try {
      const refreshed = await reloadGroups();
      if (!refreshed) return;
      if (selId) {
        const r = refreshed.find((x) => x.id === selId);
        if (r) setSelectedClientKey(r.clientKey);
      } else if (selKey) {
        const r = refreshed.find((x) => x.clientKey === selKey);
        if (r) setSelectedClientKey(r.clientKey);
      }
      if (openDetail) {
        const still = refreshed.some((x) => x.id === openDetail);
        if (still) {
          await reloadItems(openDetail);
        } else {
          setDetailGroupId(null);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [busy, detailGroupId, selectedGroup, selectedClientKey, reloadGroups, reloadItems]);

  const inquireDetail = useCallback(async () => {
    if (!detailGroupId || busy) return;
    setBusy(true);
    try {
      await reloadItems(detailGroupId);
    } finally {
      setBusy(false);
    }
  }, [detailGroupId, busy, reloadItems]);

  function handleMasterRowDoubleClick(g: GroupEditable) {
    if (!g.id) {
      setLoadError('저장된 행만 더블클릭으로 하위 코드를 조회할 수 있습니다.');
      return;
    }
    setLoadError(null);
    setSelectedClientKey(g.clientKey);
    setDetailGroupId(g.id);
    setSelectedItemClientKey(null);
  }

  useEffect(() => {
    void reloadGroups();
  }, [reloadGroups]);

  useEffect(() => {
    if (!detailGroupId) {
      setItems([]);
      rebuildItemBaseline([]);
      return;
    }
    void reloadItems(detailGroupId);
  }, [detailGroupId, reloadItems, rebuildItemBaseline]);

  useEffect(() => {
    setSelectedItemClientKey(null);
  }, [detailGroupId]);

  function updateGroup(clientKey: string, patch: Partial<GroupEditable>) {
    setGroups((prev) => prev.map((g) => (g.clientKey === clientKey ? { ...g, ...patch } : g)));
  }

  function updateItem(clientKey: string, patch: Partial<ItemEditable>) {
    setItems((prev) => prev.map((g) => (g.clientKey === clientKey ? { ...g, ...patch } : g)));
  }

  function addGroupRow() {
    const code = suggestNextParentGroupCode(groups);
    const fresh: GroupEditable = {
      clientKey: newClientKey(),
      code,
      name: '',
      category: '',
      description: '',
      sortOrder: 0,
    };
    setGroups((prev) => [...prev, fresh]);
    setSelectedClientKey(fresh.clientKey);
  }

  function addItemRow() {
    if (!detailGroupId) {
      return;
    }
    const parentGroup = groups.find((g) => g.id === detailGroupId) ?? null;
    const parentCode = parentGroup?.code?.trim() ?? '';
    setItems((prev) => {
      const code = suggestNextChildItemCode(parentCode, prev);
      const fresh: ItemEditable = {
        clientKey: newClientKey(),
        code,
        name: '',
        category: '',
        description: '',
        sortOrder: 0,
      };
      return [...prev, fresh];
    });
  }

  async function saveGroups() {
    setBusy(true);
    setLoadError(null);
    const prevSelectedId = selectedGroup?.id;
    const prevClientKey = selectedGroup?.clientKey ?? selectedClientKey;
    let lastCreatedId: string | null = null;
    try {
      const snapshot = [...groups];
      for (const g of snapshot) {
        if (!g.id) {
          if (!g.code.trim()) {
            continue;
          }
          const res = await fetch('/api/mold/code-groups', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: g.code.trim(),
              name: g.name.trim(),
              category: g.category.trim(),
              description: g.description.trim(),
              sortOrder: g.sortOrder,
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
          const created = (await res.json()) as MoldCodeGroupRow;
          lastCreatedId = created.id;
        } else {
          const snap = groupBaseline.current.get(g.id);
          const now = serializeGroup(g);
          if (snap === now) {
            continue;
          }
          const res = await fetch(`/api/mold/code-groups/${g.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: g.code.trim(),
              name: g.name.trim(),
              category: g.category.trim(),
              description: g.description.trim(),
              sortOrder: g.sortOrder,
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
        }
      }

      const refreshed = await reloadGroups();
      if (!refreshed) {
        return;
      }
      if (prevSelectedId) {
        const f = refreshed.find((x) => x.id === prevSelectedId);
        if (f) {
          setSelectedClientKey(f.clientKey);
        }
      } else if (lastCreatedId) {
        const f = refreshed.find((x) => x.id === lastCreatedId);
        if (f) {
          setSelectedClientKey(f.clientKey);
        }
      } else if (prevClientKey) {
        const f = refreshed.find((x) => x.clientKey === prevClientKey);
        if (f) {
          setSelectedClientKey(f.clientKey);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedGroup() {
    const g = selectedGroup;
    if (!g) {
      setLoadError('삭제할 행을 왼쪽 목록에서 선택해 주세요.');
      return;
    }
    if (!g.id) {
      setGroups((prev) => prev.filter((x) => x.clientKey !== g.clientKey));
      setSelectedClientKey(null);
      return;
    }
    if (!confirm(`「${g.code}」 상위 코드와 하위 코드 전체를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mold/code-groups/${g.id}`, {
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
      if (g.id === detailGroupId) {
        setDetailGroupId(null);
      }
      setSelectedClientKey(null);
      await reloadGroups();
    } finally {
      setBusy(false);
    }
  }

  async function saveItems() {
    if (!detailGroupId) {
      return;
    }
    setBusy(true);
    setItemsError(null);
    const prevItemId = selectedItem?.id;
    let lastItemCreatedId: string | null = null;
    try {
      const snapshot = [...items];
      for (const it of snapshot) {
        if (!it.id) {
          if (!it.code.trim()) {
            continue;
          }
          const res = await fetch(`/api/mold/code-groups/${detailGroupId}/items`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: it.code.trim(),
              name: it.name.trim(),
              category: it.category.trim(),
              description: it.description.trim(),
              sortOrder: it.sortOrder,
            }),
          });
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          if (!res.ok) {
            setItemsError(await readApiError(res));
            return;
          }
          const created = (await res.json()) as MoldCodeItemRow;
          lastItemCreatedId = created.id;
        } else {
          const snap = itemBaseline.current.get(it.id);
          const now = serializeItem(it);
          if (snap === now) {
            continue;
          }
          const res = await fetch(`/api/mold/code-groups/${detailGroupId}/items/${it.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: it.code.trim(),
              name: it.name.trim(),
              category: it.category.trim(),
              description: it.description.trim(),
              sortOrder: it.sortOrder,
            }),
          });
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          if (!res.ok) {
            setItemsError(await readApiError(res));
            return;
          }
        }
      }
      const refreshed = await reloadItems(detailGroupId);
      if (!refreshed) {
        return;
      }
      if (lastItemCreatedId) {
        const f = refreshed.find((x) => x.id === lastItemCreatedId);
        if (f) {
          setSelectedItemClientKey(f.clientKey);
        }
      } else if (prevItemId) {
        const f = refreshed.find((x) => x.id === prevItemId);
        if (f) {
          setSelectedItemClientKey(f.clientKey);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedItem() {
    if (!detailGroupId) {
      return;
    }
    const item = selectedItem;
    if (!item) {
      setItemsError('삭제할 행을 오른쪽 목록에서 선택해 주세요.');
      return;
    }
    if (!item.id) {
      setItems((prev) => prev.filter((x) => x.clientKey !== item.clientKey));
      setSelectedItemClientKey(null);
      return;
    }
    if (!confirm(`「${item.code}」 하위 코드를 삭제할까요?`)) {
      return;
    }
    setBusy(true);
    setItemsError(null);
    try {
      const res = await fetch(`/api/mold/code-groups/${detailGroupId}/items/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setItemsError(await readApiError(res));
        return;
      }
      setSelectedItemClientKey(null);
      await reloadItems(detailGroupId);
    } finally {
      setBusy(false);
    }
  }

  const tableInputCls = 'h-8 min-w-0 text-sm';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-app-text">기준정보관리</h1>
        <p className="mt-1 text-sm text-app-muted">
          설비관리용 상·하위 코드를 등록합니다. 왼쪽에서 행을 선택해 편집하고, 저장된 행을{' '}
          <span className="font-medium text-app-text">더블클릭</span>하면 오른쪽에서 하위 코드를
          조회·등록할 수 있습니다.
        </p>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="min-w-0 overflow-x-auto">
        <div className="flex min-h-[min(28rem,70vh)] min-w-[min(100%,56rem)] flex-row flex-nowrap items-stretch gap-4">
        <Card className="min-w-[22rem] flex-1 shadow-card">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">상위 코드</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void inquireMaster()}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:magnify" className="h-4 w-4 shrink-0" aria-hidden />
                  조회
                </span>
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={addGroupRow}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:table-row-plus-after" className="h-4 w-4 shrink-0" aria-hidden />
                  행 추가
                </span>
              </Button>
              <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void deleteSelectedGroup()}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:delete-outline" className="h-4 w-4 shrink-0" aria-hidden />
                  삭제
                </span>
              </Button>
              <Button type="button" variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => void saveGroups()}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
                  저장
                </span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <div className="overflow-x-auto px-4 pb-4">
              <table className="pros-data-table pros-data-table-head-center w-full min-w-[28rem] text-app-text">
                <thead>
                  <tr>
                    <th scope="col" className="pros-cell-center">
                      코드
                    </th>
                    <th scope="col" className="pros-cell-center">
                      코드명
                    </th>
                    <th scope="col" className="pros-cell-center">
                      구분
                    </th>
                    <th scope="col" className="pros-cell-center">
                      코드설명
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="pros-table-empty text-app-muted">
                        등록된 상위 코드가 없습니다. 행 추가 후 저장해 주세요.
                      </td>
                    </tr>
                  ) : (
                    groups.map((g) => {
                      const sel = g.clientKey === selectedClientKey;
                      return (
                        <tr
                          key={g.clientKey}
                          className={sel ? 'cursor-pointer bg-brand/10' : 'cursor-pointer'}
                          onClick={() => setSelectedClientKey(g.clientKey)}
                          onDoubleClick={() => handleMasterRowDoubleClick(g)}
                          aria-selected={sel}
                        >
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={g.code}
                              disabled={busy}
                              onFocus={() => setSelectedClientKey(g.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateGroup(g.clientKey, { code: e.target.value })}
                            />
                          </td>
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={g.name}
                              disabled={busy}
                              onFocus={() => setSelectedClientKey(g.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateGroup(g.clientKey, { name: e.target.value })}
                            />
                          </td>
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={g.category}
                              disabled={busy}
                              onFocus={() => setSelectedClientKey(g.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateGroup(g.clientKey, { category: e.target.value })}
                            />
                          </td>
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={g.description}
                              disabled={busy}
                              onFocus={() => setSelectedClientKey(g.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateGroup(g.clientKey, { description: e.target.value })}
                            />
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

        <ArrowBridge />

        <Card
          className={`min-w-[22rem] flex-1 shadow-card ${!itemsPanelEnabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">하위 코드</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy || !detailGroupId}
                onClick={() => void inquireDetail()}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:magnify" className="h-4 w-4 shrink-0" aria-hidden />
                  조회
                </span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy || !itemsPanelEnabled}
                onClick={addItemRow}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:table-row-plus-after" className="h-4 w-4 shrink-0" aria-hidden />
                  행 추가
                </span>
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={busy || !itemsPanelEnabled}
                onClick={() => void deleteSelectedItem()}
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
                disabled={busy || !itemsPanelEnabled}
                loading={busy}
                onClick={() => void saveItems()}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon icon="mdi:content-save-outline" className="h-4 w-4 shrink-0" aria-hidden />
                  저장
                </span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            {!itemsPanelEnabled ? (
              <p className="px-4 pb-4 text-sm text-app-muted">
                왼쪽 표에서 저장된 상위 코드 행을 <span className="font-medium text-app-text">더블클릭</span>
                하면 이 영역이 활성화됩니다.
              </p>
            ) : null}
            {itemsError ? (
              <div className="px-4 pb-2">
                <Alert variant="error">
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{itemsError}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            <div className="overflow-x-auto px-4 pb-4">
              <table className="pros-data-table pros-data-table-head-center w-full min-w-[28rem] text-app-text">
                <thead>
                  <tr>
                    <th scope="col" className="pros-cell-center">
                      코드
                    </th>
                    <th scope="col" className="pros-cell-center">
                      코드명
                    </th>
                    <th scope="col" className="pros-cell-center">
                      구분
                    </th>
                    <th scope="col" className="pros-cell-center">
                      코드설명
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!itemsPanelEnabled ? (
                    <tr>
                      <td colSpan={4} className="pros-table-empty text-app-muted">
                        —
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="pros-table-empty text-app-muted">
                        하위 코드가 없습니다. 행 추가 후 저장해 주세요.
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => {
                      const sel = it.clientKey === selectedItemClientKey;
                      return (
                        <tr
                          key={it.clientKey}
                          className={sel ? 'cursor-pointer bg-brand/10' : 'cursor-pointer'}
                          onClick={() => setSelectedItemClientKey(it.clientKey)}
                          aria-selected={sel}
                        >
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={it.code}
                              disabled={busy || !itemsPanelEnabled}
                              onFocus={() => setSelectedItemClientKey(it.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateItem(it.clientKey, { code: e.target.value })}
                            />
                          </td>
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={it.name}
                              disabled={busy || !itemsPanelEnabled}
                              onFocus={() => setSelectedItemClientKey(it.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateItem(it.clientKey, { name: e.target.value })}
                            />
                          </td>
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={it.category}
                              disabled={busy || !itemsPanelEnabled}
                              onFocus={() => setSelectedItemClientKey(it.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateItem(it.clientKey, { category: e.target.value })}
                            />
                          </td>
                          <td className="pros-cell-center p-1">
                            <Input
                              className={tableInputCls}
                              value={it.description}
                              disabled={busy || !itemsPanelEnabled}
                              onFocus={() => setSelectedItemClientKey(it.clientKey)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateItem(it.clientKey, { description: e.target.value })}
                            />
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
        </div>
      </div>
    </div>
  );
}
