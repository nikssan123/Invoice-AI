import express, { Request, Response } from "express";
import Stripe from "stripe";
import prisma from "../db/index.js";
import { PLAN_CONFIG, STRIPE_CONFIG, type BillingPlanId } from "../config/billing.js";
import { mapStripeStatusToSubscriptionStatus } from "../services/stripeBilling.js";

const router = express.Router();

const stripe = new Stripe(STRIPE_CONFIG.secretKey || "", {
  apiVersion: "2024-06-20",
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string | undefined;

  let event: Stripe.Event;

  try {
    if (!sig || !STRIPE_CONFIG.webhookSecret) {
      throw new Error("Missing Stripe webhook configuration");
    }
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_CONFIG.webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId;
        const plan = session.metadata?.plan as BillingPlanId | undefined;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;

        if (!organizationId || !plan || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const status = mapStripeStatusToSubscriptionStatus(subscription.status);
        const currentPeriodStart = new Date(subscription.current_period_start * 1000);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

        const planConfig = PLAN_CONFIG[plan];

        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            subscriptionPlan: plan,
            subscriptionStatus: status,
            currentPeriodStart,
            currentPeriodEnd,
            monthlyInvoiceLimit: planConfig.monthlyInvoiceLimit,
            invoicesUsedThisPeriod: 0,
          },
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const org = await prisma.organization.findFirst({
          where: {
            OR: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }],
          },
        });
        if (!org) break;

        const status = mapStripeStatusToSubscriptionStatus(subscription.status);
        const startTs = subscription.current_period_start;
        const endTs = subscription.current_period_end;
        const currentPeriodStart =
          typeof startTs === "number" && !Number.isNaN(startTs)
            ? new Date(startTs * 1000)
            : org.currentPeriodStart ?? null;
        const currentPeriodEnd =
          typeof endTs === "number" && !Number.isNaN(endTs)
            ? new Date(endTs * 1000)
            : org.currentPeriodEnd ?? null;

        const previousStart = org.currentPeriodStart;
        const isNewPeriod =
          currentPeriodStart != null &&
          (!previousStart || previousStart.getTime() !== currentPeriodStart.getTime());

        const priceId =
          subscription.items.data[0]?.price?.id ?? null;
        let plan: BillingPlanId | undefined;
        if (priceId) {
          if (priceId === PLAN_CONFIG.starter.stripePriceId) plan = "starter";
          else if (priceId === PLAN_CONFIG.pro.stripePriceId) plan = "pro";
        }

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: status,
            ...(currentPeriodStart != null && { currentPeriodStart }),
            ...(currentPeriodEnd != null && { currentPeriodEnd }),
            ...(plan && {
              subscriptionPlan: plan,
              monthlyInvoiceLimit: PLAN_CONFIG[plan].monthlyInvoiceLimit,
            }),
            ...(isNewPeriod && { invoicesUsedThisPeriod: 0 }),
          },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.organization.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            subscriptionStatus: "canceled",
          },
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | undefined;
        if (!subscriptionId) break;
        await prisma.organization.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            subscriptionStatus: "past_due",
          },
        });
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Error handling Stripe webhook event", event.type, err);
    // Still return 200 so Stripe doesn't retry indefinitely for transient issues
    res.json({ received: true });
  }
});

export default router;

