-- Enable uuid generation for backfills
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE "SalePaymentType" AS ENUM ('PAYMENT', 'DEPOSIT', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerDocumentType" AS ENUM ('CC', 'CE', 'NIT', 'TI', 'PAS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AdminActionType" AS ENUM ('SALE_VOID', 'SALE_CORRECTION', 'SALE_ADJUSTMENT', 'CASH_WITHDRAWAL', 'CASH_ADJUSTMENT', 'BALANCE_ADJUSTMENT', 'INVENTORY_ADJUSTMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend enums
DO $$ BEGIN
  ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'ADMIN_ACTION';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Organization fields
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "nit" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "city" TEXT;

UPDATE "Organization"
SET "legalName" = COALESCE("legalName", "name"),
    "nit" = COALESCE("nit", '901234567-8'),
    "phone" = COALESCE("phone", '6041234567'),
    "address" = COALESCE("address", 'Cra 1 # 2-03'),
    "city" = COALESCE("city", 'Montelíbano')
WHERE "legalName" IS NULL OR "nit" IS NULL;

ALTER TABLE "Organization" ALTER COLUMN "legalName" SET NOT NULL;
ALTER TABLE "Organization" ALTER COLUMN "nit" SET NOT NULL;

-- Site fields
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "defaultCustomerId" TEXT;

UPDATE "Site"
SET "address" = COALESCE("address", 'Centro Comercial MallBP'),
    "city" = COALESCE("city", 'Montelíbano'),
    "phone" = COALESCE("phone", '6041234567');

-- Customer fields
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "documentType" "CustomerDocumentType";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "documentNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "Customer"
SET "siteId" = (SELECT id FROM "Site" LIMIT 1)
WHERE "siteId" IS NULL;

UPDATE "Customer"
SET "documentType" = COALESCE("documentType", 'CC'),
    "documentNumber" = COALESCE("documentNumber", id::text),
    "city" = COALESCE("city", 'Montelíbano'),
    "phone" = COALESCE("phone", '0000000000');

-- Default customer per site
INSERT INTO "Customer" ("id", "siteId", "documentType", "documentNumber", "fullName", "phone", "email", "city", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s.id, 'NIT', '222222222', 'CONSUMIDOR FINAL', '0000000000', NULL, COALESCE(s."city", 'Montelíbano'), 'Cliente genérico para ventas rápidas.', NOW(), NOW()
FROM "Site" s
WHERE NOT EXISTS (
  SELECT 1 FROM "Customer" c
  WHERE c."siteId" = s.id AND c."documentType" = 'NIT' AND c."documentNumber" = '222222222'
);

UPDATE "Site" s
SET "defaultCustomerId" = c.id
FROM "Customer" c
WHERE c."siteId" = s.id AND c."documentType" = 'NIT' AND c."documentNumber" = '222222222';

ALTER TABLE "Customer" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "documentType" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "documentNumber" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "phone" SET NOT NULL;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Site" ADD CONSTRAINT "Site_defaultCustomerId_fkey" FOREIGN KEY ("defaultCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_siteId_documentType_documentNumber_key" ON "Customer"("siteId", "documentType", "documentNumber");

-- Sale fields
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "totalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "balanceDue" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "bonusTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "receiptText" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ(6);

UPDATE "Sale" s
SET "customerId" = COALESCE("customerId", site."defaultCustomerId")
FROM "Site" site
WHERE s."siteId" = site.id;

ALTER TABLE "Sale" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX IF NOT EXISTS "Sale_receiptNumber_idx" ON "Sale"("receiptNumber");

-- SalePayment fields
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "type" "SalePaymentType" NOT NULL DEFAULT 'PAYMENT';
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS "SalePayment_createdAt_idx" ON "SalePayment"("createdAt");

-- AdminAction table
CREATE TABLE IF NOT EXISTS "AdminAction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "siteId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" "RoleName" NOT NULL,
  "actionType" "AdminActionType" NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "approvalId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminAction_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "SupervisorApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AdminAction_siteId_createdAt_idx" ON "AdminAction"("siteId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAction_actorId_createdAt_idx" ON "AdminAction"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAction_entityType_entityId_idx" ON "AdminAction"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AdminAction_actionType_idx" ON "AdminAction"("actionType");
