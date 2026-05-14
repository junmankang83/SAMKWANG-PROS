import { cookies } from 'next/headers';
import type { AuthMeResponse } from '@samkwang/shared';
import { getBackendBaseUrl } from '@/lib/server/backend-url';

const SESSION_COOKIE = 'pros_session';

export type SessionUser = AuthMeResponse['user'];

export async function getServerSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const res = await fetch(`${getBackendBaseUrl()}/api/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE}=${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as AuthMeResponse;
  return data.user;
}
