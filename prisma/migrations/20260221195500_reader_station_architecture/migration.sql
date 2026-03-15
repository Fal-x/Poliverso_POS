DO $$
BEGIN
  CREATE TYPE "AttractionStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Attraction"
  ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status" "AttractionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "readerId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Attraction'
      AND column_name = 'isActive'
  ) THEN
    UPDATE "Attraction"
    SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"AttractionStatus" ELSE 'INACTIVE'::"AttractionStatus" END
    WHERE "status" IS NULL OR "status" = 'ACTIVE'::"AttractionStatus";
  END IF;
END
$$;

WITH first_reader AS (
  SELECT DISTINCT ON ("attractionId")
    id,
    "attractionId"
  FROM "Reader"
  ORDER BY "attractionId", "createdAt" ASC
)
UPDATE "Attraction" a
SET "readerId" = fr.id
FROM first_reader fr
WHERE a.id = fr."attractionId"
  AND a."readerId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Attraction_readerId_key" ON "Attraction" ("readerId");

DO $$
BEGIN
  ALTER TABLE "Attraction"
    ADD CONSTRAINT "Attraction_readerId_fkey"
    FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Attraction"
  DROP COLUMN IF EXISTS "isActive";
