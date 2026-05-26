-- CreateTable
CREATE TABLE "MoldCodeGroup" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT '',
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoldCodeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoldCodeItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT '',
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoldCodeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoldCodeGroup_code_key" ON "MoldCodeGroup"("code");

-- CreateIndex
CREATE INDEX "MoldCodeGroup_sortOrder_code_idx" ON "MoldCodeGroup"("sortOrder", "code");

-- CreateIndex
CREATE INDEX "MoldCodeItem_groupId_sortOrder_code_idx" ON "MoldCodeItem"("groupId", "sortOrder", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MoldCodeItem_groupId_code_key" ON "MoldCodeItem"("groupId", "code");

-- AddForeignKey
ALTER TABLE "MoldCodeItem" ADD CONSTRAINT "MoldCodeItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MoldCodeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
