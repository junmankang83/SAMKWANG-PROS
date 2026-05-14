-- CreateEnum
CREATE TYPE "SparePartLedgerEntryType" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "SparePartItem" (
    "id" TEXT NOT NULL,
    "machineBrand" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "spec" TEXT,
    "optimalQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "currentQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartLedgerEntry" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "SparePartLedgerEntryType" NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparePartLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartLedgerPeriod" (
    "id" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "preparedBy" TEXT,
    "preparedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "teamLeadBy" TEXT,
    "teamLeadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartLedgerPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SparePartItem_machineBrand_productName_idx" ON "SparePartItem"("machineBrand", "productName");

-- CreateIndex
CREATE INDEX "SparePartLedgerEntry_itemId_occurredAt_idx" ON "SparePartLedgerEntry"("itemId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SparePartLedgerPeriod_periodMonth_key" ON "SparePartLedgerPeriod"("periodMonth");

-- AddForeignKey
ALTER TABLE "SparePartLedgerEntry" ADD CONSTRAINT "SparePartLedgerEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SparePartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
