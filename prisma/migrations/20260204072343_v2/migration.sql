-- AlterTable
ALTER TABLE "AdminAction" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Customer_siteId_idx" ON "Customer"("siteId");

-- CreateIndex
CREATE INDEX "Site_defaultCustomerId_idx" ON "Site"("defaultCustomerId");
