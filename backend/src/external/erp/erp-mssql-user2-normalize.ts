/**
 * `ERP_MSSQL_USER2` 값 보정. 과거 배포·OS 환경 변수에 남은 로그인 오타 `skkracc`를
 * 실제 SQL 로그인 `skkrace`로 통일합니다.
 */
export function normalizeErpMssqlUser2Login(login: string | undefined): string | undefined {
  if (login == null) return undefined;
  const t = login.trim();
  if (t.length === 0) return undefined;
  if (t.toLowerCase() === 'skkracc') return 'skkrace';
  return t;
}
