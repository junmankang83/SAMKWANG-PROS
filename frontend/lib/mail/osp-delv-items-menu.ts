/** 외주납품 품목조회(TPDOSPDelv) — 구매납품(pu-delv)과 분리 */
export function isOspDelvItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm === '반품요청품목조회' || labelNorm === '구매납품품목조회') {
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
