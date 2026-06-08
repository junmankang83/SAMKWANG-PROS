/** 메일발송 메뉴가 ERP 외주입고/반품 품목(_TPDOSPDelvIn) 조회와 연결되는지 */
export function isOspDelvInItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
  if (labelNorm === '구매입고/반품품목조회') {
    return false;
  }
  if (labelNorm.includes('외주입고') && labelNorm.includes('품목조회')) {
    return true;
  }
  if (
    code === 'osp_delv_in_items' ||
    code === 'menu_code_osp_delv_in' ||
    code === 'menu_code_010'
  ) {
    return true;
  }
  return false;
}
