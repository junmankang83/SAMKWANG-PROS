-- CreateTable
CREATE TABLE "SparePartMaster" (
    "id" TEXT NOT NULL,
    "partCode" VARCHAR(50) NOT NULL,
    "machineBrand" VARCHAR(100) NOT NULL,
    "productName" VARCHAR(200) NOT NULL,
    "spec" VARCHAR(200),
    "unit" VARCHAR(20) NOT NULL DEFAULT 'EA',
    "optimalQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "manufacturer" VARCHAR(100),
    "storageLocation" VARCHAR(100),
    "leadTimeDays" INTEGER,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparePartMaster_partCode_key" ON "SparePartMaster"("partCode");

-- CreateIndex
CREATE INDEX "SparePartMaster_machineBrand_productName_idx" ON "SparePartMaster"("machineBrand", "productName");

-- CreateIndex
CREATE INDEX "SparePartMaster_isActive_sortOrder_idx" ON "SparePartMaster"("isActive", "sortOrder");

-- AlterTable
ALTER TABLE "SparePartItem" ADD COLUMN "masterId" TEXT;

-- CreateIndex
CREATE INDEX "SparePartItem_masterId_idx" ON "SparePartItem"("masterId");

-- AddForeignKey
ALTER TABLE "SparePartItem" ADD CONSTRAINT "SparePartItem_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "SparePartMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
