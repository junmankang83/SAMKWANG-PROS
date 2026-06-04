-- 다중 SMTP 프로필 + 발송 규칙 연결 (기존 단일 MailSmtpSettings 이관 후 삭제)

CREATE TABLE "MailSmtpProfile" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "host" VARCHAR(255) NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" VARCHAR(255) NOT NULL DEFAULT '',
    "passwordCipher" TEXT NOT NULL DEFAULT '',
    "fromName" VARCHAR(200) NOT NULL DEFAULT '',
    "fromAddress" VARCHAR(255) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailSmtpProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MailSmtpProfile_sortOrder_idx" ON "MailSmtpProfile"("sortOrder");

INSERT INTO "MailSmtpProfile" ("id","name","host","port","secure","user","passwordCipher","fromName","fromAddress","sortOrder","createdAt","updatedAt")
SELECT gen_random_uuid()::text, '기본 (이전 단일 SMTP)', "host", "port", "secure", "user", "passwordCipher", "fromName", "fromAddress", 0, "createdAt", "updatedAt"
FROM "MailSmtpSettings"
WHERE id = 'default';

INSERT INTO "MailSmtpProfile" ("id","name","host","port","secure","user","passwordCipher","fromName","fromAddress","sortOrder","createdAt","updatedAt")
SELECT gen_random_uuid()::text, '기본', '', 587, false, '', '', '', '', 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM "MailSmtpProfile");

ALTER TABLE "MailSendRule" ADD COLUMN "mailSmtpProfileId" TEXT;

UPDATE "MailSendRule"
SET "mailSmtpProfileId" = (SELECT "id" FROM "MailSmtpProfile" ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1);

ALTER TABLE "MailSendRule" ALTER COLUMN "mailSmtpProfileId" SET NOT NULL;

ALTER TABLE "MailSendRule" ADD CONSTRAINT "MailSendRule_mailSmtpProfileId_fkey" FOREIGN KEY ("mailSmtpProfileId") REFERENCES "MailSmtpProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "MailSendRule_mailSmtpProfileId_idx" ON "MailSendRule"("mailSmtpProfileId");

DROP TABLE "MailSmtpSettings";
