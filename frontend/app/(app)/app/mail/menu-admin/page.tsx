import { MailMenuDefinitionRegistry } from '@/components/MailMenuDefinitionRegistry';

/** 메일 메뉴 정의(순번·코드·이름·쿼리) — 메일설정 하위 */
export default function MailMenuAdminPage() {
  return (
    <MailMenuDefinitionRegistry
      title="메뉴관리"
      description="순번·메뉴코드·메뉴명·메뉴쿼리를 등록합니다. 받을사람·발송 요일·발송 시각은 「메일발송관리」에서 설정합니다."
    />
  );
}
