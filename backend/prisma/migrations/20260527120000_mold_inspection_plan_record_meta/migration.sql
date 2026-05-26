-- 설비점검 실적 화면: 항목별 비고·점검내용(JSON)
ALTER TABLE "MoldInspectionPlan" ADD COLUMN "recordMetaJson" JSONB NOT NULL DEFAULT '{}';
