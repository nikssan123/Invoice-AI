-- Add subscription-related enums and columns to Organization and set correct limits

-- 1) Create enums used by Organization
CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'pro', 'enterprise');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled');

-- 2) Add columns to Organization
ALTER TABLE "Organization"
  ADD COLUMN "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'starter',
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "monthlyInvoiceLimit" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "invoicesUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active';

-- 3) Update monthly invoice limits for existing organizations based on subscription plan
UPDATE "Organization"
SET "monthlyInvoiceLimit" = 500
WHERE "subscriptionPlan" = 'starter';

UPDATE "Organization"
SET "monthlyInvoiceLimit" = 1500
WHERE "subscriptionPlan" = 'pro';

