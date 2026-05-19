-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "toolSeq" INTEGER NOT NULL,
    "toolName" VARCHAR(50) NOT NULL,
    "toolNo" VARCHAR(30) NOT NULL,
    "spec" VARCHAR(60),
    "smStatus" INTEGER,
    "smStatusNm" VARCHAR(200),
    "umToolKind" INTEGER,
    "umToolKindName" VARCHAR(40),
    "assetSeq" INTEGER,
    "asstName" VARCHAR(100),
    "asstNo" VARCHAR(30),
    "deptSeq" INTEGER,
    "deptName" VARCHAR(200),
    "empSeq" INTEGER,
    "empName" VARCHAR(200),
    "empid" VARCHAR(40),
    "lastUserName" VARCHAR(200),
    "lastDateTime" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tool_toolSeq_key" ON "Tool"("toolSeq");

-- CreateIndex
CREATE INDEX "Tool_isActive_sortOrder_idx" ON "Tool"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Tool_umToolKind_idx" ON "Tool"("umToolKind");

-- CreateIndex
CREATE INDEX "Tool_toolName_idx" ON "Tool"("toolName");

-- AlterTable
ALTER TABLE "SparePartMaster" ADD COLUMN "toolId" TEXT;

-- CreateIndex
CREATE INDEX "SparePartMaster_toolId_idx" ON "SparePartMaster"("toolId");

-- AddForeignKey
ALTER TABLE "SparePartMaster" ADD CONSTRAINT "SparePartMaster_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "SparePartLedgerEntry" ADD COLUMN "toolId" TEXT,
ADD COLUMN "toolNameSnapshot" VARCHAR(50);

-- CreateIndex
CREATE INDEX "SparePartLedgerEntry_toolId_idx" ON "SparePartLedgerEntry"("toolId");

-- AddForeignKey
ALTER TABLE "SparePartLedgerEntry" ADD CONSTRAINT "SparePartLedgerEntry_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
