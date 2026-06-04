'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const BASE = '/app/mail/sending-menu';

type MenuRow = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
};

function normalizeMenus(raw: unknown): MenuRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((r): MenuRow | null => {
      if (!r || typeof r !== 'object') {
        return null;
      }
      const o = r as Record<string, unknown>;
      const id = String(o.id ?? '');
      if (!id) {
        return null;
      }
      return {
        id,
        code: String(o.code ?? ''),
        label: String(o.label ?? ''),
        sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : Number(o.sortOrder) || 0,
      };
    })
    .filter((x): x is MenuRow => x !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** 메일발송메뉴현황 — 메뉴관리 목록 아코디언 + 하위 링크 */
export function MailSendingMenuStatusNav() {
  const pathname = usePathname();
  const underSection = pathname === BASE || pathname.startsWith(`${BASE}/`);
  const isViewRoute = pathname.startsWith(`${BASE}/view/`);
  const [open, setOpen] = useState(isViewRoute);
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(false);

  /** 하위 조회 화면으로 이동할 때는 목록을 펼쳐 둠 */
  useEffect(() => {
    if (isViewRoute) {
      setOpen(true);
    }
  }, [isViewRoute]);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mail/menus', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setMenus([]);
        return;
      }
      const raw = await res.json();
      setMenus(normalizeMenus(raw));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadMenus();
    }
  }, [open, loadMenus]);

  const parentActive = underSection;

  return (
    <div className="border-b border-app-border/60 last:border-b-0">
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-app-muted/40 ${
          parentActive ? 'bg-brand/8 font-medium text-brand' : 'text-app-text'
        }`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon="mdi:email-multiple-outline" className="h-4 w-4 shrink-0 text-app-muted" aria-hidden />
        <span className="min-w-0 flex-1 leading-snug">메일발송메뉴현황</span>
        <Icon
          icon={open ? 'mdi:chevron-down' : 'mdi:chevron-right'}
          className="h-4 w-4 shrink-0 text-app-muted"
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-1 pb-2 pt-0.5">
          {loading ? (
            <p className="px-2 py-1.5 text-xs text-app-muted">불러오는 중…</p>
          ) : menus.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-app-muted">등록된 메뉴가 없습니다. 메뉴관리에서 추가하세요.</p>
          ) : (
            <ul className="space-y-0.5">
              {menus.map((m) => {
                const href = `${BASE}/view/${m.id}`;
                const active = pathname === href;
                return (
                  <li key={m.id}>
                    <Link
                      href={href}
                      className={`block rounded-md px-2 py-1.5 text-xs leading-snug no-underline transition-colors hover:bg-app-muted/40 ${
                        active ? 'bg-brand/10 font-medium text-brand' : 'text-app-text'
                      }`}
                    >
                      <span className="text-app-muted" aria-hidden>
                        -{' '}
                      </span>
                      {m.label || m.code}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
