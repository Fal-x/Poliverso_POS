DO $$
BEGIN
  ALTER TYPE "CardStatus" ADD VALUE IF NOT EXISTS 'REPLACED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE "CardStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "CardStatusHistory" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "fromStatus" "CardStatus",
  "toStatus" "CardStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CardStatusHistory_siteId_cardId_occurredAt_idx"
  ON "CardStatusHistory" ("siteId", "cardId", "occurredAt");

CREATE INDEX IF NOT EXISTS "CardStatusHistory_changedByUserId_occurredAt_idx"
  ON "CardStatusHistory" ("changedByUserId", "occurredAt");

DO $$
BEGIN
  ALTER TABLE "CardStatusHistory"
    ADD CONSTRAINT "CardStatusHistory_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "CardStatusHistory"
    ADD CONSTRAINT "CardStatusHistory_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "CardStatusHistory"
    ADD CONSTRAINT "CardStatusHistory_changedByUserId_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
