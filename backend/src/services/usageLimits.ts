import prisma from "../db/index.js";

export class UsageLimitError extends Error {
  code: "SUBSCRIPTION_INACTIVE" | "MONTHLY_LIMIT_REACHED";

  constructor(code: "SUBSCRIPTION_INACTIVE" | "MONTHLY_LIMIT_REACHED", message: string) {
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
    },
  });

  if (!org) {
    throw new UsageLimitError("SUBSCRIPTION_INACTIVE", "Organization not found");
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

