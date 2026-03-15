ALTER TABLE "DeviceLog"
  ADD COLUMN IF NOT EXISTS "uid" TEXT,
  ADD COLUMN IF NOT EXISTS "latency" INTEGER;

CREATE INDEX IF NOT EXISTS "DeviceLog_uid_idx" ON "DeviceLog" ("uid");
CREATE INDEX IF NOT EXISTS "DeviceLog_readerId_idx" ON "DeviceLog" ("readerId");
