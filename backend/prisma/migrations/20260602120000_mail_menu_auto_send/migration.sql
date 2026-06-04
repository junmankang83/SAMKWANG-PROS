-- MailMenu 자동 발송 슬롯 + 메뉴 발송 로그
ALTER TABLE "MailMenu" ADD COLUMN "lastMenuSendSlotUtc" TIMESTAMP(3);

CREATE TABLE "MailMenuSendLog" (
    "id" TEXT NOT NULL,
    "mailMenuId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MailSendLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "smtpMessageId" VARCHAR(255),

    CONSTRAINT "MailMenuSendLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MailMenuSendLog_mailMenuId_sentAt_idx" ON "MailMenuSendLog"("mailMenuId", "sentAt");

ALTER TABLE "MailMenuSendLog" ADD CONSTRAINT "MailMenuSendLog_mailMenuId_fkey" FOREIGN KEY ("mailMenuId") REFERENCES "MailMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
