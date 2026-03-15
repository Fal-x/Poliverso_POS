ALTER TABLE "Card"
  ADD COLUMN IF NOT EXISTS "ownerCustomerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Card_ownerCustomerId_fkey'
  ) THEN
    ALTER TABLE "Card"
      ADD CONSTRAINT "Card_ownerCustomerId_fkey"
      FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Card_siteId_ownerCustomerId_idx"
  ON "Card" ("siteId", "ownerCustomerId");
