-- 점검방법·비고 등에 절차 문장을 넣을 수 있도록 확장 (기존 detail/criteria TEXT 마이그레이션 이후 적용 권장)
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "inspectionCategory" SET DATA TYPE VARCHAR(500);
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "itemName" SET DATA TYPE VARCHAR(500);
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "method" SET DATA TYPE TEXT;
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "cycle" SET DATA TYPE VARCHAR(300);
ALTER TABLE "MoldInspectionItem" ALTER COLUMN "remarks" SET DATA TYPE TEXT;
