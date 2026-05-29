-- CreateEnum
CREATE TYPE "MailScheduleType" AS ENUM ('DAILY', 'CRON');

-- CreateEnum
CREATE TYPE "MailSendLogStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "MailSmtpSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "host" VARCHAR(255) NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" VARCHAR(255) NOT NULL DEFAULT '',
    "passwordCipher" TEXT NOT NULL DEFAULT '',
    "fromName" VARCHAR(200) NOT NULL DEFAULT '',
    "fromAddress" VARCHAR(255) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSmtpSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMenu" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "defaultSubject" VARCHAR(500) NOT NULL DEFAULT '',
    "defaultBody" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSendRule" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" VARCHAR(200) NOT NULL,
    "scheduleType" "MailScheduleType" NOT NULL DEFAULT 'DAILY',
    "cronExpression" VARCHAR(120),
    "dailyTime" VARCHAR(5),
    "dailyDaysMask" INTEGER NOT NULL DEFAULT 127,
    "toAddresses" JSONB NOT NULL DEFAULT '[]',
    "subject" VARCHAR(500) NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "mailMenuId" TEXT,
    "lastRunSlotUtc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSendRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailSendLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MailSendLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "smtpMessageId" VARCHAR(255),

    CONSTRAINT "MailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailMenu_code_key" ON "MailMenu"("code");

-- CreateIndex
CREATE INDEX "MailSendRule_enabled_idx" ON "MailSendRule"("enabled");

-- CreateIndex
CREATE INDEX "MailSendRule_mailMenuId_idx" ON "MailSendRule"("mailMenuId");

-- CreateIndex
CREATE INDEX "MailSendLog_ruleId_sentAt_idx" ON "MailSendLog"("ruleId", "sentAt");

-- AddForeignKey
ALTER TABLE "MailSendRule" ADD CONSTRAINT "MailSendRule_mailMenuId_fkey" FOREIGN KEY ("mailMenuId") REFERENCES "MailMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailSendLog" ADD CONSTRAINT "MailSendLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "MailSendRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
