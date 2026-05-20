-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';

-- 기존 등록 계정 이름 일괄 반영
UPDATE "User" SET "name" = '강준만' WHERE "name" = '';
