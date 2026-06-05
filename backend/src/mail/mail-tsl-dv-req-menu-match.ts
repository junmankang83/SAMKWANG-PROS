/** 메일발송 메뉴가 ERP 반품요청 품목 조회와 연결되는지 (프론트 `tsl-dv-req-items-menu.ts`와 동일 조건) */
export function isTslDvReqItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
  if (labelNorm === '반품요청품목조회') {
    return true;
  }
  if (code === 'tsl_dv_req_items' || code === 'menu_code_005') {
    return true;
  }
  return false;
}
