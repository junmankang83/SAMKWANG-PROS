/** 메일발송 메뉴가 ERP 이동품목조회(_TLGInoutDaily, InOutType=80)와 연결되는지 */

export type MailMenuLike = { label: string; code: string };

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

export function isLgInoutMoveItemsMailMenu(menu: MailMenuLike): boolean {
  const label = norm(menu.label ?? '');
  /** 메뉴 코드만 LG로 잘못 등록된 경우(예: 작업실적조회) 이동품목 UI가 뜨는 것 방지 */
  if (label.includes('작업실적')) {
    return false;
  }
  const code = (menu.code ?? '').trim().toLowerCase();
  if (label.includes('이동품목') && label.includes('조회')) {
    return true;
  }
  if (code === 'lg_inout_move_items' || code === 'menu_code_lg_move' || code === 'menu_code_011') {
    return true;
  }
  return false;
}
