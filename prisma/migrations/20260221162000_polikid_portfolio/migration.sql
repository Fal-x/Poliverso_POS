DO $$
BEGIN
  CREATE TYPE "PolikidStudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "PolikidStudent" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "documentType" "CustomerDocumentType" NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "birthDate" DATE NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "guardianName" TEXT,
  "guardianPhone" TEXT,
  "status" "PolikidStudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolikidStudent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PolikidStudent_siteId_documentType_documentNumber_key"
  ON "PolikidStudent" ("siteId", "documentType", "documentNumber");
CREATE INDEX IF NOT EXISTS "PolikidStudent_siteId_status_idx"
  ON "PolikidStudent" ("siteId", "status");

CREATE TABLE IF NOT EXISTS "ProgramEnrollment" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "programName" TEXT NOT NULL,
  "groupName" TEXT,
  "startsAt" DATE,
  "endsAt" DATE,
  "dueDate" DATE,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "finalAmount" DECIMAL(18,2) NOT NULL,
  "status" "ServiceStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramEnrollment_siteId_status_createdAt_idx"
  ON "ProgramEnrollment" ("siteId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProgramEnrollment_siteId_programName_groupName_idx"
  ON "ProgramEnrollment" ("siteId", "programName", "groupName");

CREATE TABLE IF NOT EXISTS "EnrollmentPayment" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnrollmentPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EnrollmentPayment_siteId_createdAt_idx"
  ON "EnrollmentPayment" ("siteId", "createdAt");
CREATE INDEX IF NOT EXISTS "EnrollmentPayment_enrollmentId_createdAt_idx"
  ON "EnrollmentPayment" ("enrollmentId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "PolikidStudent"
    ADD CONSTRAINT "PolikidStudent_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "ProgramEnrollment"
    ADD CONSTRAINT "ProgramEnrollment_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "ProgramEnrollment"
    ADD CONSTRAINT "ProgramEnrollment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "PolikidStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EnrollmentPayment"
    ADD CONSTRAINT "EnrollmentPayment_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EnrollmentPayment"
    ADD CONSTRAINT "EnrollmentPayment_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "EnrollmentPayment"
    ADD CONSTRAINT "EnrollmentPayment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
