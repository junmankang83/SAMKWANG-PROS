-- 메뉴 기준 스케줄 자동 발송 on/off (기본: 사용)
ALTER TABLE "MailMenu" ADD COLUMN "scheduleAutoSendEnabled" BOOLEAN NOT NULL DEFAULT true;
