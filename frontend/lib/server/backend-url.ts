/** 서버 컴포넌트·Route Handler에서 백엔드로 직접 호출할 때 사용 (Docker: http://backend:4000) */
export function getBackendBaseUrl(): string {
  const raw = process.env.BACKEND_INTERNAL_URL?.trim() ?? 'http://127.0.0.1:4000';
  return raw.replace(/\/+$/, '');
}
