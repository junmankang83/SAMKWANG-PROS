-- CreateTable
CREATE TABLE "MoldInspectionItem" (
    "id" TEXT NOT NULL,
    "categoryGroupId" TEXT NOT NULL,
    "typeItemId" TEXT,
    "inspectionCategory" VARCHAR(100) NOT NULL DEFAULT '',
    "itemCode" VARCHAR(50) NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "method" VARCHAR(200) NOT NULL DEFAULT '',
    "detail" VARCHAR(2000) NOT NULL DEFAULT '',
    "criteria" VARCHAR(2000) NOT NULL DEFAULT '',
    "cycle" VARCHAR(100) NOT NULL DEFAULT '',
    "remarks" VARCHAR(500) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoldInspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoldInspectionItem_categoryGroupId_typeItemId_sortOrder_idx" ON "MoldInspectionItem"("categoryGroupId", "typeItemId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MoldInspectionItem_categoryGroupId_itemCode_key" ON "MoldInspectionItem"("categoryGroupId", "itemCode");

-- AddForeignKey
ALTER TABLE "MoldInspectionItem" ADD CONSTRAINT "MoldInspectionItem_categoryGroupId_fkey" FOREIGN KEY ("categoryGroupId") REFERENCES "MoldCodeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoldInspectionItem" ADD CONSTRAINT "MoldInspectionItem_typeItemId_fkey" FOREIGN KEY ("typeItemId") REFERENCES "MoldCodeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
