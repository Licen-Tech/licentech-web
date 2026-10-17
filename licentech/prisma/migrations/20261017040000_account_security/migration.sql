ALTER TABLE "User"
    ADD COLUMN "totpSecretEnc" TEXT,
    ADD COLUMN "totpSetupSecretEnc" TEXT,
    ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
    ADD COLUMN "totpLastUsedStep" BIGINT,
    ADD COLUMN "totpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "totpLockedUntil" TIMESTAMP(3);

CREATE TABLE "TotpRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TotpRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TotpRecoveryCode_codeHash_key" ON "TotpRecoveryCode"("codeHash");
CREATE INDEX "TotpRecoveryCode_userId_usedAt_idx" ON "TotpRecoveryCode"("userId", "usedAt");
ALTER TABLE "TotpRecoveryCode" ADD CONSTRAINT "TotpRecoveryCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletTopUp" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "WalletTopUp" DROP CONSTRAINT "WalletTopUp_userId_fkey";
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_userId_fkey";
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
