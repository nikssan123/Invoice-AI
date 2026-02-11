import { config } from "../config.js";

export type BillingPlanId = "starter" | "pro" | "enterprise";

export interface PlanConfig {
  id: BillingPlanId;
  stripePriceId?: string;
  monthlyInvoiceLimit: number;
}

export const PLAN_CONFIG: Record<Exclude<BillingPlanId, "enterprise">, PlanConfig> & {
  enterprise: PlanConfig;
} = {
  starter: {
    id: "starter",
    stripePriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    monthlyInvoiceLimit: 500,
  },
  pro: {
    id: "pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    monthlyInvoiceLimit: 1500,
  },
  enterprise: {
    id: "enterprise",
    monthlyInvoiceLimit: 100, // default; overridden manually per organization
  },
};

export const TRIAL_DAYS = 7;
export const TRIAL_DOCUMENT_LIMIT = 10;

export const STRIPE_CONFIG = {
  publishedKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  secretKey: process.env.STRIPE_SECRET_KEY ?? "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  appBaseUrl: config.appUrl.replace(/\/$/, ""),
};

