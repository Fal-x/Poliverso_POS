-- CreateTable
CREATE TABLE "UserAuthCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),

    CONSTRAINT "UserAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthCode_userId_key" ON "UserAuthCode"("userId");

-- CreateIndex
CREATE INDEX "UserAuthCode_expiresAt_idx" ON "UserAuthCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserAuthCode" ADD CONSTRAINT "UserAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
