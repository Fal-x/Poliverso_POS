DO $$
BEGIN
  CREATE TYPE "AttractionMachineType" AS ENUM ('TIME', 'SKILL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Attraction"
  ADD COLUMN IF NOT EXISTS "machineType" "AttractionMachineType" NOT NULL DEFAULT 'SKILL',
  ADD COLUMN IF NOT EXISTS "location" TEXT;
