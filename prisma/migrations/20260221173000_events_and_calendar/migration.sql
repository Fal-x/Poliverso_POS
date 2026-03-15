DO $$
BEGIN
  CREATE TYPE "EventBookingType" AS ENUM ('PREDEFINED_PLAN', 'CUSTOM_EVENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "EventBasePlan" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultValue" DECIMAL(18,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventBasePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventBasePlan_siteId_name_key"
  ON "EventBasePlan" ("siteId", "name");
CREATE INDEX IF NOT EXISTS "EventBasePlan_siteId_isActive_idx"
  ON "EventBasePlan" ("siteId", "isActive");

CREATE TABLE IF NOT EXISTS "EventBooking" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "basePlanId" TEXT,
  "bookingType" "EventBookingType" NOT NULL,
  "customPlanName" TEXT,
  "eventDate" DATE NOT NULL,
  "status" "ServiceStatus" NOT NULL DEFAULT 'OPEN',
  "totalValue" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventBooking_siteId_eventDate_status_idx"
  ON "EventBooking" ("siteId", "eventDate", "status");
CREATE INDEX IF NOT EXISTS "EventBooking_siteId_bookingType_createdAt_idx"
  ON "EventBooking" ("siteId", "bookingType", "createdAt");
CREATE INDEX IF NOT EXISTS "EventBooking_customerId_eventDate_idx"
  ON "EventBooking" ("customerId", "eventDate");

CREATE TABLE IF NOT EXISTS "EventBookingPayment" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventBookingPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventBookingPayment_siteId_createdAt_idx"
  ON "EventBookingPayment" ("siteId", "createdAt");
CREATE INDEX IF NOT EXISTS "EventBookingPayment_bookingId_createdAt_idx"
  ON "EventBookingPayment" ("bookingId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "EventBasePlan"
    ADD CONSTRAINT "EventBasePlan_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EventBooking"
    ADD CONSTRAINT "EventBooking_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EventBooking"
    ADD CONSTRAINT "EventBooking_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EventBooking"
    ADD CONSTRAINT "EventBooking_basePlanId_fkey"
    FOREIGN KEY ("basePlanId") REFERENCES "EventBasePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EventBookingPayment"
    ADD CONSTRAINT "EventBookingPayment_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EventBookingPayment"
    ADD CONSTRAINT "EventBookingPayment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "EventBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EventBookingPayment"
    ADD CONSTRAINT "EventBookingPayment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
