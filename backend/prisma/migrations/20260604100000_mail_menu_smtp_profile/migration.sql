-- MailMenu: 메뉴 기준 자동 발송 시 사용할 SMTP 프로필(선택)
ALTER TABLE "MailMenu" ADD COLUMN "mailSmtpProfileId" TEXT;

ALTER TABLE "MailMenu" ADD CONSTRAINT "MailMenu_mailSmtpProfileId_fkey" FOREIGN KEY ("mailSmtpProfileId") REFERENCES "MailSmtpProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MailMenu_mailSmtpProfileId_idx" ON "MailMenu"("mailSmtpProfileId");
