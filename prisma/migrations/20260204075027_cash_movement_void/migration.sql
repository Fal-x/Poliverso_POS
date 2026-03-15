-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedApprovalId" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMPTZ(6),
ADD COLUMN     "voidedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "CashMovement_voidedAt_idx" ON "CashMovement"("voidedAt");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_voidedApprovalId_fkey" FOREIGN KEY ("voidedApprovalId") REFERENCES "SupervisorApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
