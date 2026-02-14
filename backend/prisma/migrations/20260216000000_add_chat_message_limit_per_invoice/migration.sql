-- Add optional per-organization override for chat messages per invoice (admin-set; null = use plan default)
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "chatMessageLimitPerInvoice" INTEGER;
