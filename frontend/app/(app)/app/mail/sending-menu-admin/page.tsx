import { MailMenuRegistry } from '@/components/MailMenuRegistry';

/** 메일발송 메뉴(템플릿) CRUD — 규칙에서 연결하는 메뉴 정의 */
export default function MailSendingMenuAdminPage() {
  return (
    <MailMenuRegistry
      title="메일발송메뉴관리"
      description="발송 규칙에서 선택할 메뉴(템플릿)를 등록·수정합니다. 기본 제목·본문은 규칙에서 비워 두었을 때 적용됩니다."
    />
  );
}
