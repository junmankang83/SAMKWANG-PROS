'use client';

import type { AuthUser } from '@samkwang/shared';
import { Button } from '@samkwang/ui-kit';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { UserProfileDialog } from '@/components/UserProfileDialog';
import { APP_DOMAINS } from '@/lib/navigation/app-menu';

const navLinkBase =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-base font-medium transition-colors no-underline';
const navLinkIdle = `${navLinkBase} text-app-text hover:bg-app-hover`;
const navLinkActive = `${navLinkBase} bg-brand text-app-text-on-color hover:bg-brand-hover`;

function formatUserDisplayName(user: AuthUser): string {
  return user.name?.trim() || user.username;
}

function UserAvatarIcon() {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </span>
  );
}

type AppTopNavProps = {
  user: AuthUser;
};

export function AppTopNav({ user }: AppTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
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
        <div className="ml-2 flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="max-w-[min(16rem,36vw)] text-[14px] font-medium text-app-text"
            onClick={() => setProfileOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${formatUserDisplayName(user)} 사용자 정보`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <UserAvatarIcon />
              <span className="truncate">{formatUserDisplayName(user)}</span>
            </span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 text-[14px]"
            onClick={() => void logout()}
          >
            로그아웃
          </Button>
        </div>
      </header>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />
    </>
  );
}
