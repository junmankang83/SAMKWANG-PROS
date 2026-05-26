-- 설비구분·연도별 점검 계획(월별 계획 주차 JSON)
CREATE TABLE "MoldInspectionPlan" (
    "id" TEXT NOT NULL,
    "categoryItemId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "planJson" JSONB NOT NULL DEFAULT '{}',
    "actualJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoldInspectionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MoldInspectionPlan_categoryItemId_year_key" ON "MoldInspectionPlan"("categoryItemId", "year");
CREATE INDEX "MoldInspectionPlan_year_categoryItemId_idx" ON "MoldInspectionPlan"("year", "categoryItemId");

ALTER TABLE "MoldInspectionPlan" ADD CONSTRAINT "MoldInspectionPlan_categoryItemId_fkey" FOREIGN KEY ("categoryItemId") REFERENCES "MoldCodeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
