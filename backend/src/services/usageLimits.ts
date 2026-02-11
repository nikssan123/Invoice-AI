import prisma from "../db/index.js";
import { TRIAL_DOCUMENT_LIMIT } from "../config/billing.js";

export class UsageLimitError extends Error {
  code: "SUBSCRIPTION_INACTIVE" | "MONTHLY_LIMIT_REACHED" | "TRIAL_EXPIRED";

  constructor(
    code: "SUBSCRIPTION_INACTIVE" | "MONTHLY_LIMIT_REACHED" | "TRIAL_EXPIRED",
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

export async function assertCanProcessInvoices(organizationId: string, count: number): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscriptionStatus: true,
      monthlyInvoiceLimit: true,
      invoicesUsedThisPeriod: true,
      trialEndsAt: true,
      stripeSubscriptionId: true,
    },
  });

  if (!org) {
    throw new UsageLimitError("SUBSCRIPTION_INACTIVE", "Organization not found");
  }

  const now = new Date();
  const isInTrial = org.trialEndsAt != null && now <= org.trialEndsAt;
  const trialExpired = org.trialEndsAt != null && now > org.trialEndsAt;

  if (isInTrial) {
    if (org.invoicesUsedThisPeriod + count > TRIAL_DOCUMENT_LIMIT) {
      throw new UsageLimitError(
        "MONTHLY_LIMIT_REACHED",
        `Trial limit reached (${TRIAL_DOCUMENT_LIMIT} documents). Subscribe to continue.`
      );
    }
    return;
  }

  if (trialExpired && !org.stripeSubscriptionId) {
    throw new UsageLimitError(
      "TRIAL_EXPIRED",
      "Trial has ended. Subscribe to continue using the app."
    );
  }

  if (org.subscriptionStatus !== "active") {
    throw new UsageLimitError("SUBSCRIPTION_INACTIVE", "Subscription is not active");
  }

  if (org.invoicesUsedThisPeriod + count > org.monthlyInvoiceLimit) {
    throw new UsageLimitError("MONTHLY_LIMIT_REACHED", "Monthly invoice limit reached");
  }
}

export async function incrementInvoicesUsed(organizationId: string, count: number): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      invoicesUsedThisPeriod: {
        increment: count,
      },
    },
  });
}

