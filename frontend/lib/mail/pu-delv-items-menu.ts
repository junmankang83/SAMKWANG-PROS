/** 메일발송메뉴현황에서 ERP 구매납품 품목 조회 UI를 쓸 메뉴 식별 */
export function isPuDelvItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm === '구매납품품목조회') {
    return true;
  }
  if (code === 'pu_delv_items' || code === 'menu_code_004') {
    return true;
  }
  return false;
}
