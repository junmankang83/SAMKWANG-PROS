-- 점검항목 상세·판정: 장문 입력 대비 TEXT
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "detail" SET DATA TYPE TEXT;
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "criteria" SET DATA TYPE TEXT;
