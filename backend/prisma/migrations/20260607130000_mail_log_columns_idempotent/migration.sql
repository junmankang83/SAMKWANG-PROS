-- 일부 DB에서 마이그레이션 순서·누락으로 Mail*SendLog 컬럼이 없을 때 보강 (PostgreSQL 11+)
-- 메일발송정보(list)·수동발송 이력 저장이 Prisma 스키마와 맞도록 합니다.

ALTER TABLE "MailMenuSendLog" ADD COLUMN IF NOT EXISTS "toAddressesSnapshot" JSONB;
ALTER TABLE "MailSendLog" ADD COLUMN IF NOT EXISTS "toAddressesSnapshot" JSONB;

ALTER TABLE "MailMenuSendLog" ADD COLUMN IF NOT EXISTS "openTrackingToken" VARCHAR(64);
ALTER TABLE "MailMenuSendLog" ADD COLUMN IF NOT EXISTS "firstOpenedAt" TIMESTAMP(3);
ALTER TABLE "MailMenuSendLog" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MailSendLog" ADD COLUMN IF NOT EXISTS "openTrackingToken" VARCHAR(64);
ALTER TABLE "MailSendLog" ADD COLUMN IF NOT EXISTS "firstOpenedAt" TIMESTAMP(3);
ALTER TABLE "MailSendLog" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "MailMenuSendLog_openTrackingToken_key" ON "MailMenuSendLog"("openTrackingToken");
CREATE UNIQUE INDEX IF NOT EXISTS "MailSendLog_openTrackingToken_key" ON "MailSendLog"("openTrackingToken");
