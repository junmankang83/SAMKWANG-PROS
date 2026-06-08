/** 메일발송메뉴현황에서 ERP 구매납품 품목 조회 UI를 쓸 메뉴 식별 */
export function isPuDelvItemsMailMenu(row: { code: string; label: string }): boolean {
  const labelNorm = row.label.trim().replace(/\s+/g, '');
  const code = row.code.trim().toLowerCase();
  /** 라벨이 반품요청이면 코드가 pu_delv로 잘못돼 있어도 구매납품 API로 붙지 않음(반품요청은 tsl-dv-req 전용) */
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
