-- 수동으로 MoldInspectionPlan만 만든 경우 등: recordMetaJson 누락 시 보완 (이미 있으면 무시)
ALTER TABLE "MoldInspectionPlan" ADD COLUMN IF NOT EXISTS "recordMetaJson" JSONB NOT NULL DEFAULT '{}';
