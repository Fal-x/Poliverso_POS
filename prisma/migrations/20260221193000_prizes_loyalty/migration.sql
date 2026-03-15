ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "pointsCost" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PrizeRedemption" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "pointsUnitCost" INTEGER NOT NULL,
  "pointsTotal" INTEGER NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "receiptText" TEXT,
  "performedById" TEXT NOT NULL,
  "ledgerEventId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrizeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrizeRedemption_siteId_createdAt_idx"
  ON "PrizeRedemption" ("siteId", "createdAt");

CREATE INDEX IF NOT EXISTS "PrizeRedemption_cardId_createdAt_idx"
  ON "PrizeRedemption" ("cardId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "PrizeRedemption"
    ADD CONSTRAINT "PrizeRedemption_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PrizeRedemption"
    ADD CONSTRAINT "PrizeRedemption_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PrizeRedemption"
    ADD CONSTRAINT "PrizeRedemption_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PrizeRedemption"
    ADD CONSTRAINT "PrizeRedemption_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PrizeRedemption"
    ADD CONSTRAINT "PrizeRedemption_ledgerEventId_fkey"
    FOREIGN KEY ("ledgerEventId") REFERENCES "LedgerEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
