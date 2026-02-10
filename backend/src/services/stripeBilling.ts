import Stripe from "stripe";
import prisma from "../db/index.js";
import { PLAN_CONFIG, STRIPE_CONFIG, type BillingPlanId } from "../config/billing.js";

const stripe = new Stripe(STRIPE_CONFIG.secretKey || "", {
  apiVersion: "2024-06-20",
});

export function getPlanConfig(plan: BillingPlanId) {
  return PLAN_CONFIG[plan];
}

export async function getOrCreateCustomer(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error("Organization not found");

  if (org.stripeCustomerId) {
    const customer = await stripe.customers.retrieve(org.stripeCustomerId);
    return customer;
  }

  const customer = await stripe.customers.create({
    metadata: {
      organizationId,
      name: org.name,
    },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { stripeCustomerId: customer.id },
  });

  return customer;
}

export async function createCheckoutSession(params: {
  organizationId: string;
  plan: Exclude<BillingPlanId, "enterprise">;
  successUrl: string;
  cancelUrl: string;
}) {
  const { organizationId, plan, successUrl, cancelUrl } = params;
  const planConfig = PLAN_CONFIG[plan];
  if (!planConfig?.stripePriceId) {
    throw new Error(
      "Stripe price is not configured for this plan."
    );
  }
  const priceId = planConfig.stripePriceId;
  if (!priceId.startsWith("price_")) {
    throw new Error(
      "Payment not configured correctly."
    );
  }

  const customer = await getOrCreateCustomer(organizationId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: typeof customer === "string" ? customer : customer.id,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organizationId,
      plan,
    },
  });

  return session;
}

export function mapStripeStatusToSubscriptionStatus(
  status: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  return "canceled";
}

export type BillingInvoiceItem = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
};

export async function listInvoicesForOrganization(organizationId: string): Promise<BillingInvoiceItem[]> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { stripeCustomerId: true } });
  if (!org?.stripeCustomerId) return [];

  const invoices = await stripe.invoices.list({
    customer: org.stripeCustomerId,
    limit: 30,
    status: "paid",
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    date: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString(),
    amount: (inv.amount_paid ?? 0) / 100,
    currency: (inv.currency ?? "usd").toUpperCase(),
    status: inv.status ?? "paid",
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
  }));
}

export type DefaultPaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null;

export async function getDefaultPaymentMethod(organizationId: string): Promise<DefaultPaymentMethod> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) return null;
  try {
    const customer = await stripe.customers.retrieve(org.stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) return null;
    const defaultPmId =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : (customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod)?.id;
    if (defaultPmId) {
      const pm =
        typeof customer.invoice_settings?.default_payment_method === "object" &&
        customer.invoice_settings?.default_payment_method?.object === "payment_method"
          ? (customer.invoice_settings.default_payment_method as Stripe.PaymentMethod)
          : await stripe.paymentMethods.retrieve(defaultPmId as string);
      const card = pm.card;
      if (card && "last4" in card) {
        return {
          brand: (card.brand ?? "card").toUpperCase(),
          last4: card.last4 ?? "",
          expMonth: card.exp_month ?? 0,
          expYear: card.exp_year ?? 0,
        };
      }
    }
    const list = await stripe.paymentMethods.list({
      customer: org.stripeCustomerId,
      type: "card",
    });
    const first = list.data[0];
    const card = first?.card;
    if (first && card && "last4" in card) {
      return {
        brand: (card.brand ?? "card").toUpperCase(),
        last4: card.last4 ?? "",
        expMonth: card.exp_month ?? 0,
        expYear: card.exp_year ?? 0,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function createBillingPortalSession(
  organizationId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) {
    throw new Error("NO_CUSTOMER");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

export async function cancelSubscriptionForOrganization(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });

  if (!org?.stripeSubscriptionId) {
    throw new Error("NO_ACTIVE_SUBSCRIPTION");
  }

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    throw new Error("NO_ACTIVE_SUBSCRIPTION");
  }

  await stripe.subscriptions.update(org.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function getCancelAtPeriodEnd(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) return false;
  try {
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    return subscription.cancel_at_period_end === true;
  } catch {
    return false;
  }
}

export async function reactivateSubscription(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) {
    throw new Error("NO_ACTIVE_SUBSCRIPTION");
  }
  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  if (!subscription.cancel_at_period_end) {
    return;
  }
  await stripe.subscriptions.update(org.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

function getCurrentPlanFromPriceId(priceId: string | null): BillingPlanId | null {
  if (!priceId) return null;
  if (priceId === PLAN_CONFIG.starter.stripePriceId) return "starter";
  if (priceId === PLAN_CONFIG.pro.stripePriceId) return "pro";
  return null;
}

export async function getUpgradePreview(organizationId: string): Promise<{
  amountCents: number;
  currency: string;
} | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!org?.stripeSubscriptionId || !org?.stripeCustomerId) return null;

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item?.id) return null;
  const currentPlan = getCurrentPlanFromPriceId(item.price?.id ?? null);
  if (currentPlan === "pro") return null;

  const proPriceId = PLAN_CONFIG.pro.stripePriceId;
  if (!proPriceId?.startsWith("price_")) return null;

  try {
    const upcoming = await stripe.invoices.retrieveUpcoming({
      customer: org.stripeCustomerId,
      subscription: org.stripeSubscriptionId,
      subscription_details: {
        items: [{ id: item.id, price: proPriceId }],
      },
    });
    return {
      amountCents: upcoming.amount_due ?? 0,
      currency: (upcoming.currency ?? "usd").toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function getDowngradePreview(organizationId: string): Promise<{
  nextAmountCents: number;
  currency: string;
} | null> {
  const starterPriceId = PLAN_CONFIG.starter.stripePriceId;
  if (!starterPriceId?.startsWith("price_")) return null;
  try {
    const price = await stripe.prices.retrieve(starterPriceId);
    const unitAmount = price.unit_amount ?? 0;
    return {
      nextAmountCents: unitAmount,
      currency: (price.currency ?? "usd").toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function getScheduledDowngrade(organizationId: string): Promise<{
  scheduledDowngradeTo: "starter" | null;
  scheduledDowngradeAt: string | null;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) return { scheduledDowngradeTo: null, scheduledDowngradeAt: null };

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
    expand: ["schedule"],
  });
  const scheduleId =
    typeof subscription.schedule === "object" && subscription.schedule?.id
      ? subscription.schedule.id
      : typeof subscription.schedule === "string"
        ? subscription.schedule
        : null;
  if (!scheduleId) return { scheduledDowngradeTo: null, scheduledDowngradeAt: null };

  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  const phases = schedule.phases ?? [];
  if (phases.length < 2) return { scheduledDowngradeTo: null, scheduledDowngradeAt: null };

  const nextPhase = phases[1];
  const nextPriceId = nextPhase?.items?.[0]?.price;
  const priceId = typeof nextPriceId === "string" ? nextPriceId : nextPriceId?.id ?? null;
  if (priceId !== PLAN_CONFIG.starter.stripePriceId) return { scheduledDowngradeTo: null, scheduledDowngradeAt: null };

  const startDate = nextPhase?.start_date;
  const at =
    typeof startDate === "number"
      ? new Date(startDate * 1000).toISOString()
      : startDate
        ? new Date(startDate * 1000).toISOString()
        : null;
  return { scheduledDowngradeTo: "starter", scheduledDowngradeAt: at };
}

export async function upgradeSubscription(
  organizationId: string,
  targetPlan: "pro"
): Promise<{ url?: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) throw new Error("NO_ACTIVE_SUBSCRIPTION");

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
    expand: ["latest_invoice", "schedule"],
  });
  const item = subscription.items.data[0];
  if (!item?.id) throw new Error("Invalid subscription");

  const currentPlan = getCurrentPlanFromPriceId(item.price?.id ?? null);
  if (targetPlan !== "pro") throw new Error("INVALID_UPGRADE_TARGET");

  const scheduleId =
    typeof subscription.schedule === "object" && subscription.schedule?.id
      ? subscription.schedule.id
      : typeof subscription.schedule === "string"
        ? subscription.schedule
        : null;

  if (scheduleId) {
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const phases = schedule.phases ?? [];
    if (phases.length >= 2) {
      const nextPhase = phases[1];
      const nextPriceId = nextPhase?.items?.[0]?.price;
      const pid = typeof nextPriceId === "string" ? nextPriceId : nextPriceId?.id ?? null;
      if (pid === PLAN_CONFIG.starter.stripePriceId) {
        const proPriceId = PLAN_CONFIG.pro.stripePriceId;
        if (!proPriceId?.startsWith("price_")) throw new Error("Stripe price is not configured for Pro.");
        await stripe.subscriptionSchedules.update(scheduleId, {
          phases: [
            {
              items: [{ price: proPriceId, quantity: 1 }],
              start_date: subscription.current_period_start,
            },
          ],
        });
        return {};
      }
    }
  }

  if (currentPlan === "pro") throw new Error("ALREADY_ON_PLAN");

  const newPriceId = PLAN_CONFIG.pro.stripePriceId;
  if (!newPriceId?.startsWith("price_")) throw new Error("Stripe price is not configured for Pro.");

  const updated = await stripe.subscriptions.update(org.stripeSubscriptionId, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: "always_invoice",
    expand: ["latest_invoice"],
  });

  const latestInvoice = updated.latest_invoice;
  const invoice =
    typeof latestInvoice === "object" && latestInvoice?.object === "invoice"
      ? latestInvoice
      : typeof latestInvoice === "string"
        ? await stripe.invoices.retrieve(latestInvoice)
        : null;
  const url = invoice?.hosted_invoice_url ?? undefined;
  return { url };
}

export async function scheduleDowngrade(
  organizationId: string,
  targetPlan: "starter"
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true },
  });
  if (!org?.stripeSubscriptionId) throw new Error("NO_ACTIVE_SUBSCRIPTION");

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item?.id) throw new Error("Invalid subscription");

  const currentPlan = getCurrentPlanFromPriceId(item.price?.id ?? null);
  if (currentPlan === "starter") throw new Error("ALREADY_ON_PLAN");
  if (targetPlan !== "starter") throw new Error("INVALID_DOWNGRADE_TARGET");

  const proPriceId = item.price?.id ?? null;
  const starterPriceId = PLAN_CONFIG.starter.stripePriceId;
  if (!starterPriceId?.startsWith("price_"))
    throw new Error("Stripe price is not configured for Starter.");
  if (!proPriceId) throw new Error("Invalid subscription price.");

  const periodEnd = subscription.current_period_end;
  const periodStart = subscription.current_period_start;

  if (subscription.schedule) {
    const scheduleId =
      typeof subscription.schedule === "object" && subscription.schedule?.id
        ? subscription.schedule.id
        : (subscription.schedule as string);
    await stripe.subscriptionSchedules.update(scheduleId, {
      phases: [
        {
          items: [{ price: proPriceId, quantity: 1 }],
          start_date: periodStart,
          end_date: periodEnd,
        },
        {
          items: [{ price: starterPriceId, quantity: 1 }],
          start_date: periodEnd,
        },
      ],
    });
    return;
  }

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: org.stripeSubscriptionId,
  });
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: [{ price: proPriceId, quantity: 1 }],
        start_date: periodStart,
        end_date: periodEnd,
      },
      {
        items: [{ price: starterPriceId, quantity: 1 }],
        start_date: periodEnd,
      },
    ],
  });
}
