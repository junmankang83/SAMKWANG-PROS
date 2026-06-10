/** 작업실적조회 — `GET /api/erp/pdsfc-work-report` (`_TPDSFCWorkReport`). 백엔드 메일 매칭 추가 시 동기 유지. */

export type MailMenuLike = { label: string; code: string };

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

export function isPdsfcWorkReportMailMenu(menu: MailMenuLike): boolean {
  const labelNorm = norm(menu.label ?? '');
  const code = (menu.code ?? '').trim().toLowerCase();

  if (labelNorm.includes('작업실적조회')) {
    return true;
  }
  if (labelNorm.includes('작업실적') && labelNorm.includes('조회')) {
    return true;
  }
  if (
    code === 'pdsfc_work_report' ||
    code === 'menu_code_pdsfc_work_report' ||
    code === 'tpdsfc_work_report'
  ) {
    return true;
  }
  return false;
}
