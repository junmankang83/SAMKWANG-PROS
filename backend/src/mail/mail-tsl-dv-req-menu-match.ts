/** 메일발송 메뉴가 ERP 반품요청 품목 조회와 연결되는지 (프론트 `tsl-dv-req-items-menu.ts`와 동일 조건) */
export function isTslDvReqItemsMailMenu(menu: { code: string; label: string }): boolean {
  const labelNorm = menu.label.trim().replace(/\s+/g, '');
  const labelLower = labelNorm.toLowerCase();
  const code = menu.code.trim().toLowerCase();
  /** 라벨이 수출 Invoice 품목조회인데 코드만 반품요청으로 잘못 붙은 경우 제외 */
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
