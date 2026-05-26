-- CreateTable
CREATE TABLE "StandardWorkTimeMaster" (
    "id" TEXT NOT NULL,
    "workCenter" VARCHAR(100) NOT NULL,
    "workerCount" INTEGER NOT NULL DEFAULT 0,
    "workStartTime" VARCHAR(8) NOT NULL DEFAULT '00:00',
    "workEndTime" VARCHAR(8) NOT NULL DEFAULT '00:00',
    "idleMinutes" INTEGER NOT NULL DEFAULT 0,
    "workMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardWorkTimeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardIdleTimeDetail" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "startTime" VARCHAR(8) NOT NULL DEFAULT '00:00',
    "endTime" VARCHAR(8) NOT NULL DEFAULT '00:00',
    "idleMinutes" INTEGER NOT NULL DEFAULT 0,
    "remarks" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardIdleTimeDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandardWorkTimeMaster_workCenter_idx" ON "StandardWorkTimeMaster"("workCenter");

-- CreateIndex
CREATE INDEX "StandardWorkTimeMaster_sortOrder_idx" ON "StandardWorkTimeMaster"("sortOrder");

-- CreateIndex
CREATE INDEX "StandardIdleTimeDetail_masterId_sortOrder_idx" ON "StandardIdleTimeDetail"("masterId", "sortOrder");

-- AddForeignKey
ALTER TABLE "StandardIdleTimeDetail" ADD CONSTRAINT "StandardIdleTimeDetail_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "StandardWorkTimeMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
