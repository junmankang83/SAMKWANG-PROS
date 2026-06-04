-- 열람 추적(HTML 픽셀): 토큰·최초 열람 시각·요청 횟수
ALTER TABLE "MailMenuSendLog" ADD COLUMN "openTrackingToken" VARCHAR(64);
ALTER TABLE "MailMenuSendLog" ADD COLUMN "firstOpenedAt" TIMESTAMP(3);
ALTER TABLE "MailMenuSendLog" ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "MailMenuSendLog_openTrackingToken_key" ON "MailMenuSendLog"("openTrackingToken");

ALTER TABLE "MailSendLog" ADD COLUMN "openTrackingToken" VARCHAR(64);
ALTER TABLE "MailSendLog" ADD COLUMN "firstOpenedAt" TIMESTAMP(3);
ALTER TABLE "MailSendLog" ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "MailSendLog_openTrackingToken_key" ON "MailSendLog"("openTrackingToken");
