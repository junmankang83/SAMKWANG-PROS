-- 발송 이력에 발송 시점 수신자 스냅샷(메일발송정보 화면 표시용)
ALTER TABLE "MailMenuSendLog" ADD COLUMN "toAddressesSnapshot" JSONB;
ALTER TABLE "MailSendLog" ADD COLUMN "toAddressesSnapshot" JSONB;
