-- Fix remaining drift: defaults and nullability

-- 1) BlogComment.isApproved default -> TRUE
ALTER TABLE "BlogComment"
  ALTER COLUMN "isApproved" SET DEFAULT true;

-- 2) SystemSetting.config required + default '{}'
-- First set a default
ALTER TABLE "SystemSetting"
  ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;

-- Ensure no NULLs exist before setting NOT NULL
UPDATE "SystemSetting"
SET "config" = '{}'::jsonb
WHERE "config" IS NULL;

-- Now enforce required
ALTER TABLE "SystemSetting"
  ALTER COLUMN "config" SET NOT NULL;
