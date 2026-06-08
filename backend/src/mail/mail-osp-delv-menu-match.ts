/** 메일발송 메뉴가 ERP 외주납품 품목(TPDOSPDelv) 조회와 연결되는지 */
export function isOspDelvItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const code = menu.code.trim().toLowerCase();
  if (labelNorm === '반품요청품목조회') {
    return false;
  }
  if (labelNorm === '구매납품품목조회') {
    return false;
  }
  if (labelNorm.includes('외주납품') && labelNorm.includes('품목조회')) {
    return true;
  }
  if (code === 'osp_delv_items' || code === 'menu_code_osp_delv' || code === 'menu_code_009') {
    return true;
  }
  return false;
}
