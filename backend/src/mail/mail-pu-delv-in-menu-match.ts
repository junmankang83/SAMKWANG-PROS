/** 메일발송 메뉴가 ERP 구매입고/반품 품목 조회와 연결되는지 (프론트 `pu-delv-in-items-menu.ts`와 동일 조건) */
export function isPuDelvInItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
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
