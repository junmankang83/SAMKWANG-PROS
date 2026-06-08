/** 메일발송 메뉴가 ERP 구매납품 품목 조회와 연결되는지 (프론트 `pu-delv-items-menu.ts`와 동일 조건) */
export function isPuDelvItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
  if (labelNorm === '반품요청품목조회') {
    return false;
  }
  if (labelNorm === '구매납품품목조회') {
    return true;
  }
  if (code === 'pu_delv_items' || code === 'menu_code_004') {
    return true;
  }
  return false;
}
