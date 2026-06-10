/** 로컬 달력 기준 YYYY-MM-DD */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 메일발송메뉴현황 ERP 조회: 시작일·종료일 기본값 = 당일(로컬).
 */
export function defaultMailSendingMenuInquiryDateRange(): { from: string; to: string } {
  const ymd = localYmd(new Date());
  return { from: ymd, to: ymd };
}

/** 부품관리 등 단독 페이지: 당월 1일 ~ 오늘(로컬). */
export function defaultMonthStartToTodayRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: localYmd(start), to: localYmd(today) };
}
