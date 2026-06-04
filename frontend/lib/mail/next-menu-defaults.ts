/** 기존 행 기준 다음 순번 문자열 (비어 있으면 1, 이후는 max(sortOrder)+1, 최소 1) */
export function suggestNextSortOrder(rows: { sortOrder: number }[]): string {
  if (rows.length === 0) {
    return '1';
  }
  const max = Math.max(...rows.map((r) => (Number.isFinite(r.sortOrder) ? r.sortOrder : 0) || 0), 0);
  return String(Math.max(1, max + 1));
}

/**
 * `Menu_code_001` 형태의 다음 코드.
 * 동일 패턴이 있으면 최대 번호+1, 없으면 `Menu_code_001`.
 */
export function suggestNextMenuCode(rows: { code: string }[]): string {
  const pattern = /^Menu_code_(\d+)$/i;
  let maxSuffix = 0;
  let anyMatch = false;
  for (const { code } of rows) {
    const m = code.trim().match(pattern);
    if (m) {
      anyMatch = true;
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) {
        maxSuffix = Math.max(maxSuffix, n);
      }
    }
  }
  if (anyMatch) {
    return `Menu_code_${String(maxSuffix + 1).padStart(3, '0')}`;
  }
  return 'Menu_code_001';
}
