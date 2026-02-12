-- Reconciliation migration for prior `prisma db push` changes
-- This migration is intentionally idempotent

-- BlogComment
ALTER TABLE "BlogComment" DROP COLUMN IF EXISTS "approved";
ALTER TABLE "BlogComment" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "BlogComment" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "transactionCode" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_transactionCode_idx" ON "Payment"("transactionCode");

-- SystemSetting
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "config" JSONB;
