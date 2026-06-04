/** 메일발송메뉴현황 — 인덱스(하위 메뉴는 사이드바에서 선택) */
export default function MailSendingMenuIndexPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-app-text">메일발송메뉴현황</h1>
      <p className="max-w-xl text-sm text-app-muted">
        왼쪽 사이드바에서 「메일발송메뉴현황」을 펼친 뒤, 조회할 메뉴를 선택하세요. 각 메뉴 화면에서는 메뉴관리에 등록한 쿼리를 이용해 데이터를 표시할 예정입니다.
      </p>
    </div>
  );
}
