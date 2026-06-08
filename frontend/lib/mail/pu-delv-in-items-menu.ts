/** 메일발송메뉴현황에서 ERP 구매입고/반품 품목 조회 UI를 쓸 메뉴 식별 */
export function isPuDelvInItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm.includes('외주입고') && labelNorm.includes('반품') && labelNorm.includes('품목조회')) {
    return false;
  }
  if (code === 'osp_delv_in_items' || code === 'menu_code_osp_delv_in' || code === 'menu_code_010') {
    return false;
  }
  if (labelNorm === '구매입고/반품품목조회') {
    return true;
  }
  if (code === 'pu_delv_in_items' || code === 'menu_code_003') {
    return true;
  }
  return false;
}
