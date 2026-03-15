DO $$
BEGIN
  CREATE TYPE "PromotionType" AS ENUM ('PERCENT_DISCOUNT', 'COMBO', 'BONUS', 'RECHARGE_ADDITIONAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PromotionScope" AS ENUM ('SALE', 'RECHARGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "Promotion" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "PromotionType" NOT NULL,
  "scope" "PromotionScope" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "startsAt" TIMESTAMPTZ(6),
  "endsAt" TIMESTAMPTZ(6),
  "percentValue" DECIMAL(8,4),
  "fixedValue" DECIMAL(18,2),
  "exactValues" JSONB,
  "dayRestrictions" JSONB,
  "productRestrictions" JSONB,
  "exceptions" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_siteId_code_key"
  ON "Promotion" ("siteId", "code");
CREATE INDEX IF NOT EXISTS "Promotion_siteId_scope_isActive_priority_idx"
  ON "Promotion" ("siteId", "scope", "isActive", "priority");

DO $$
BEGIN
  ALTER TABLE "Promotion"
    ADD CONSTRAINT "Promotion_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
