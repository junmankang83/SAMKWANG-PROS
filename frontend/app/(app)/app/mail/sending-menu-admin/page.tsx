import { MailMenuRegistry } from '@/components/MailMenuRegistry';

/** 메일 발송 설정(수신·요일·시각 등) — 메뉴쿼리는 메뉴관리에서 정의 */
export default function MailSendingMenuAdminPage() {
  return (
    <MailMenuRegistry title="메일발송관리" />
  );
}
