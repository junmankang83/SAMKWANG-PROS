function trimEndSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/** `…/api` 형태로 정규화 */
function toApiBase(originOrBase: string): string {
  const s = trimEndSlashes(originOrBase);
  if (s.endsWith('/api')) {
    return s;
  }
  return `${s}/api`;
}

function tryParseOriginUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === '*') {
    return null;
  }
  try {
    const u = new URL(t.includes('://') ? t : `http://${t}`);
    return toApiBase(u.origin);
  } catch {
    return null;
  }
}

/** `CORS_ORIGIN` 첫 항목으로 웹 진입 URL 추정(게이트웨이와 동일 호스트인 경우가 많음) */
function apiBaseFromCorsOriginFirst(): string | null {
  const first = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  if (!first) {
    return null;
  }
  return tryParseOriginUrl(first);
}

/**
 * 메일 본문에 넣는 픽셀 URL의 공개 API 베이스.
 * 수신자 메일 클라이언트가 접근 가능해야 하므로, 브라우저와 동일한 호스트(nginx gateway 등)를 권장합니다.
 *
 * 우선순위: `MAIL_TRACKING_PUBLIC_URL` → `PUBLIC_APP_BASE` → `FRONTEND_PUBLIC_URL` → `BACKEND_PUBLIC_URL`
 * → `CORS_ORIGIN` 의 첫 Origin(예: 개발 시 `http://localhost:3000` → `…/api`).
 *
 * 예: `http://192.168.0.10:3000/api` (끝의 `/api` 미포함이면 자동으로 붙입니다.)
 */
export function resolveMailTrackingPublicApiBase(): string | null {
  const raw = process.env.MAIL_TRACKING_PUBLIC_URL?.trim();
  if (raw) {
    const s = trimEndSlashes(raw);
    if (s.endsWith('/api')) {
      return s;
    }
    return `${s}/api`;
  }
  const app = process.env.PUBLIC_APP_BASE?.trim();
  if (app) {
    return toApiBase(trimEndSlashes(app));
  }
  const fe = process.env.FRONTEND_PUBLIC_URL?.trim();
  if (fe) {
    return toApiBase(trimEndSlashes(fe));
  }
  const be = process.env.BACKEND_PUBLIC_URL?.trim();
  if (be) {
    return toApiBase(trimEndSlashes(be));
  }
  return apiBaseFromCorsOriginFirst();
}

export function buildMailOpenPixelUrl(publicApiBase: string, token: string): string {
  const base = publicApiBase.replace(/\/+$/, '');
  const q = encodeURIComponent(token);
  return `${base}/mail/open?t=${q}`;
}
