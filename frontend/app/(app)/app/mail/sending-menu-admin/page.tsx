import { MailMenuRegistry } from '@/components/MailMenuRegistry';

/** 메일 발송 설정(수신·요일·시각 등) — 메뉴쿼리는 메뉴관리에서 정의 */
export default function MailSendingMenuAdminPage() {
  return (
    <MailMenuRegistry
      title="메일발송관리"
      description="「발송 목록」에는 받을사람·발송일·발송시간이 모두 저장된 메뉴만 나옵니다. 메뉴(코드·이름·쿼리)는 「메뉴관리」에서 등록하고, 「발송 추가」에서 SMTP·수신자·요일·시각을 지정해 「목록에 저장」하면 반영됩니다. 각 행의 「해제」로 지정 시각 자동 발송만 끄고, 「자동설정」으로 다시 켤 수 있습니다. 「지금 발송」은 메뉴 기본 제목·본문으로 즉시 보냅니다. 메일발송정보 규칙과 같은 분에 겹치면 이중 발송될 수 있으니 시각을 조정하세요."
    />
  );
}
