/*
  Manual migration: backfill Sale.cashSessionId based on existing Shift records.
*/

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CashCountType" AS ENUM ('OPENING', 'CLOSING');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('WITHDRAWAL', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'CASH_SESSION';

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "shiftId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCashAmount" DECIMAL(18,2) NOT NULL,
    "expectedCashAmount" DECIMAL(18,2) NOT NULL,
    "closedAt" TIMESTAMPTZ(6),
    "closingCashAmount" DECIMAL(18,2),
    "cashDifference" DECIMAL(18,2),
    "closeReason" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedApprovalId" TEXT,
    "closedApprovalId" TEXT,
    "closedById" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "CashCountType" NOT NULL,
    "denominations" JSONB NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "countedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "authorizedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalId" TEXT,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- Add nullable column first
ALTER TABLE "Sale" ADD COLUMN "cashSessionId" TEXT;

-- Backfill cash sessions for existing shifts that have sales.
-- Use Shift.id as CashSession.id to avoid UUID extensions.
INSERT INTO "CashSession" (
  "id",
  "siteId",
  "terminalId",
  "cashRegisterId",
  "shiftId",
  "openedByUserId",
  "openedAt",
  "openingCashAmount",
  "expectedCashAmount",
  "closedAt",
  "closingCashAmount",
  "cashDifference",
  "status",
  "closedById"
)
SELECT
  s."id",
  s."siteId",
  s."terminalId",
  s."cashRegisterId",
  s."id",
  s."openedById",
  s."openedAt",
  COALESCE(s."openingCash", 0),
  COALESCE(s."expectedCash", COALESCE(s."openingCash", 0)),
  s."closedAt",
  s."countedCash",
  s."cashDiscrepancy",
  (CASE WHEN s."status" = 'OPEN' THEN 'OPEN' ELSE 'CLOSED' END)::"CashSessionStatus",
  s."closedById"
FROM "Shift" s
WHERE EXISTS (
  SELECT 1 FROM "Sale" sa WHERE sa."shiftId" = s."id"
);

-- Assign cashSessionId to existing sales based on shift.
UPDATE "Sale" AS sa
SET "cashSessionId" = sa."shiftId"
WHERE sa."cashSessionId" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "Sale" ALTER COLUMN "cashSessionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CashSession_siteId_openedAt_idx" ON "CashSession"("siteId", "openedAt");

-- CreateIndex
CREATE INDEX "CashSession_terminalId_status_idx" ON "CashSession"("terminalId", "status");

-- CreateIndex
CREATE INDEX "CashSession_cashRegisterId_status_idx" ON "CashSession"("cashRegisterId", "status");

-- CreateIndex
CREATE INDEX "CashCount_cashSessionId_type_idx" ON "CashCount"("cashSessionId", "type");

-- CreateIndex
CREATE INDEX "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CashMovement_type_createdAt_idx" ON "CashMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_cashSessionId_createdAt_idx" ON "Sale"("cashSessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedApprovalId_fkey" FOREIGN KEY ("openedApprovalId") REFERENCES "SupervisorApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedApprovalId_fkey" FOREIGN KEY ("closedApprovalId") REFERENCES "SupervisorApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_countedByUserId_fkey" FOREIGN KEY ("countedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "SupervisorApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
