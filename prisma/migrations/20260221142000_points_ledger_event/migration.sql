CREATE TABLE IF NOT EXISTS "PointsLedgerEvent" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "saleId" TEXT,
  "ledgerEventId" TEXT,
  "pointsDelta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdById" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsLedgerEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PointsLedgerEvent_siteId_cardId_occurredAt_idx"
  ON "PointsLedgerEvent" ("siteId", "cardId", "occurredAt");

CREATE INDEX IF NOT EXISTS "PointsLedgerEvent_saleId_idx"
  ON "PointsLedgerEvent" ("saleId");

CREATE INDEX IF NOT EXISTS "PointsLedgerEvent_ledgerEventId_idx"
  ON "PointsLedgerEvent" ("ledgerEventId");

DO $$
BEGIN
  ALTER TABLE "PointsLedgerEvent"
    ADD CONSTRAINT "PointsLedgerEvent_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PointsLedgerEvent"
    ADD CONSTRAINT "PointsLedgerEvent_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PointsLedgerEvent"
    ADD CONSTRAINT "PointsLedgerEvent_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PointsLedgerEvent"
    ADD CONSTRAINT "PointsLedgerEvent_ledgerEventId_fkey"
    FOREIGN KEY ("ledgerEventId") REFERENCES "LedgerEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PointsLedgerEvent"
    ADD CONSTRAINT "PointsLedgerEvent_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
