/** 메일발송메뉴현황에서 ERP 반품요청 품목 조회 UI를 쓸 메뉴 식별 */
export function isTslDvReqItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  if (labelNorm === '반품요청품목조회') {
    return true;
  }
  if (code === 'tsl_dv_req_items' || code === 'menu_code_005') {
    return true;
  }
  return false;
}
