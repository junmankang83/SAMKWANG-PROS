/** 메일발송메뉴현황에서 ERP 반품요청 품목 조회 UI를 쓸 메뉴 식별 */
export function isTslDvReqItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const labelLower = labelNorm.toLowerCase();
  const code = row.code.trim().toLowerCase();
  /** 라벨이 수출 Invoice 품목조회인데 코드만 `menu_code_005`로 잘못 붙은 경우 — 수출 전용 UI로 가야 함 */
  if (
    labelLower.includes('수출') &&
    !labelLower.includes('반품') &&
    labelLower.includes('품목조회') &&
    (labelLower.includes('invoice') || labelLower.includes('인보이스'))
  ) {
    return false;
  }
  if (labelNorm === '반품요청품목조회') {
    return true;
  }
  if (code === 'tsl_dv_req_items' || code === 'menu_code_005') {
    return true;
  }
  return false;
}
