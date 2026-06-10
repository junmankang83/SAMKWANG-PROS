import { cookies, headers } from 'next/headers';
import { defaultNavVisibility, mergeNavVisibility, type NavDomainVisibilityMap } from '@/lib/nav-visibility-shared';

export type { NavDomainVisibilityMap } from '@/lib/nav-visibility-shared';
export { defaultNavVisibility } from '@/lib/nav-visibility-shared';

/**
 * 서버 컴포넌트에서 상단 메뉴 표시 설정 로드(쿠키 전달). 실패 시 전부 표시.
 */
export async function loadNavDomainVisibility(): Promise<NavDomainVisibilityMap> {
  const defaults = defaultNavVisibility();
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '127.0.0.1:3000';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const url = `${proto}://${host}/api/app/nav-domains-visibility`;
    const res = await fetch(url, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: 'no-store',
    });
    if (!res.ok) return defaults;
    const body = (await res.json()) as { domains?: Record<string, unknown> };
    if (!body.domains || typeof body.domains !== 'object') return defaults;
    return mergeNavVisibility(body.domains);
  } catch {
    return defaults;
  }
}
