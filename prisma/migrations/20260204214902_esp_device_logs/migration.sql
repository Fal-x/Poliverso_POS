-- AlterTable
ALTER TABLE "Attraction" ADD COLUMN     "costPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Reader" ADD COLUMN     "apiTokenHash" TEXT,
ADD COLUMN     "hmacSecret" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "DeviceLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "cardId" TEXT,
    "activityId" TEXT,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "allowed" BOOLEAN,
    "reason" TEXT,
    "pointsBefore" INTEGER,
    "pointsAfter" INTEGER,
    "creditBefore" DECIMAL(18,2),
    "creditAfter" DECIMAL(18,2),
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceLog_siteId_createdAt_idx" ON "DeviceLog"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLog_readerId_requestId_key" ON "DeviceLog"("readerId", "requestId");

-- AddForeignKey
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
