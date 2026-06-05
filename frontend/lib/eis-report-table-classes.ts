/**
 * EIS(전사 보고) 형태 그리드: 연회색 헤더, 검은 1px 테두리, 본문 흰 배경.
 * 메일발송 메뉴 하위 ERP 조회 테이블에서 공통 사용.
 */
export const EIS_TH =
  'whitespace-nowrap border border-black bg-[#E7E6E6] px-1.5 py-2 text-center text-[11px] font-bold text-black';

export const EIS_TD =
  'whitespace-nowrap border border-black bg-white px-1.5 py-1 text-center text-[11px] text-black';

export const EIS_TD_NUM =
  'whitespace-nowrap border border-black bg-white px-1.5 py-1 text-right text-[11px] text-black tabular-nums';

export const EIS_TD_LEFT =
  'whitespace-nowrap border border-black bg-white px-1.5 py-1 text-left text-[11px] text-black';

/** 스크롤 영역 외곽 — 표와 동일하게 검은 실선 */
export const EIS_TABLE_SCROLL_WRAP = 'max-h-[min(70vh,720px)] overflow-auto border border-black bg-white';
