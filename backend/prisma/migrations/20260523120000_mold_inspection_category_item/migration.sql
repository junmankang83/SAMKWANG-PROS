-- 점검항목: 설비구분을 상위그룹이 아닌 「설비구분」그룹의 하위코드(MoldCodeItem)로 저장
DELETE FROM "MoldInspectionItem";

ALTER TABLE "MoldInspectionItem" DROP CONSTRAINT IF EXISTS "MoldInspectionItem_categoryGroupId_fkey";

DROP INDEX IF EXISTS "MoldInspectionItem_categoryGroupId_typeItemId_sortOrder_idx";
DROP INDEX IF EXISTS "MoldInspectionItem_categoryGroupId_itemCode_key";

ALTER TABLE "MoldInspectionItem" DROP COLUMN "categoryGroupId";

ALTER TABLE "MoldInspectionItem" ADD COLUMN "categoryItemId" TEXT NOT NULL;

CREATE UNIQUE INDEX "MoldInspectionItem_categoryItemId_itemCode_key" ON "MoldInspectionItem"("categoryItemId", "itemCode");

CREATE INDEX "MoldInspectionItem_categoryItemId_typeItemId_sortOrder_idx" ON "MoldInspectionItem"("categoryItemId", "typeItemId", "sortOrder");

ALTER TABLE "MoldInspectionItem" ADD CONSTRAINT "MoldInspectionItem_categoryItemId_fkey" FOREIGN KEY ("categoryItemId") REFERENCES "MoldCodeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
