'use client';

import { Button } from '@samkwang/ui-kit';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';

const navLinkBase =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors no-underline';
const navLinkIdle = `${navLinkBase} text-app-text hover:bg-app-hover`;
const navLinkActive = `${navLinkBase} bg-brand text-app-text-on-color hover:bg-brand-hover`;

export function AppTopNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface-02 px-4 shadow-topbar">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link href="/app" className={`${navLinkIdle} shrink-0 font-semibold`}>
          SAMKWANG-PROS
        </Link>
        <nav
          className="flex min-w-0 flex-wrap items-center gap-1"
          aria-label="주 메뉴"
        >
          {APP_DOMAINS.map((d) => {
            const active =
              pathname === d.basePath || pathname.startsWith(`${d.basePath}/`);
            return (
              <Link
                key={d.id}
                href={d.basePath}
                className={active ? navLinkActive : navLinkIdle}
                aria-current={active ? 'page' : undefined}
              >
                {d.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="ml-2 shrink-0"
        onClick={() => void logout()}
      >
        로그아웃
      </Button>
    </header>
  );
}
