import { Router, Request, Response } from "express";
import prisma from "../db/index.js";
import { config } from "../config.js";
import {
  createCheckoutSession,
  listInvoicesForOrganization,
  cancelSubscriptionForOrganization,
  reactivateSubscription,
  upgradeSubscription,
  scheduleDowngrade,
  getUpgradePreview,
  getDowngradePreview,
  getDefaultPaymentMethod,
  createBillingPortalSession,
} from "../services/stripeBilling.js";

const router = Router();

router.get("/upgrade-preview", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    const preview = await getUpgradePreview(organizationId);
    if (!preview) return res.status(200).json({ amountCents: 0, currency: "usd" });
    return res.json(preview);
  } catch (err) {
    console.error("Upgrade preview failed", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/downgrade-preview", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    const preview = await getDowngradePreview(organizationId);
    if (!preview) return res.status(200).json({ nextAmountCents: 0, currency: "usd" });
    return res.json(preview);
  } catch (err) {
    console.error("Downgrade preview failed", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/invoices", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const items = await listInvoicesForOrganization(organizationId);
    return res.json(items);
  } catch (err) {
    console.error("Failed to list billing invoices", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/payment-method", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    const pm = await getDefaultPaymentMethod(organizationId);
    return res.json(pm);
  } catch (err) {
    console.error("Failed to get payment method", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/customer-portal", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    const returnUrl = (req.body as { returnUrl?: string })?.returnUrl ?? `${config.appUrl.replace(/\/$/, "")}/usage`;
    const session = await createBillingPortalSession(organizationId, returnUrl);
    return res.json(session);
  } catch (err) {
    const message = (err as Error).message;
    if (message === "NO_CUSTOMER") {
      return res.status(400).json({ error: "No billing customer found." });
    }
    console.error("Failed to create customer portal session", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/cancel-subscription", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await cancelSubscriptionForOrganization(organizationId);
    } catch (err) {
      const message = (err as Error).message;
      if (message === "NO_ACTIVE_SUBSCRIPTION") {
        return res.status(400).json({ error: "No active subscription to cancel." });
      }
      throw err;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to cancel subscription", err);
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

router.post("/reactivate-subscription", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    try {
      await reactivateSubscription(organizationId);
      return res.json({ success: true });
    } catch (err) {
      const message = (err as Error).message;
      if (message === "NO_ACTIVE_SUBSCRIPTION") {
        return res.status(400).json({ error: "No subscription to reactivate." });
      }
      throw err;
    }
  } catch (err) {
    console.error("Failed to reactivate subscription", err);
    return res.status(500).json({ error: "Failed to reactivate subscription" });
  }
});

type UpgradeBody = { plan: "pro" };
router.post("/upgrade", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body as UpgradeBody;
    if (body.plan !== "pro") return res.status(400).json({ error: "Invalid plan" });

    try {
      const result = await upgradeSubscription(organizationId, "pro");
      return res.json({ success: true, url: result.url });
    } catch (err) {
      const message = (err as Error).message;
      if (message === "NO_ACTIVE_SUBSCRIPTION") {
        return res.status(400).json({
          error: "No active subscription. Use the plan card to subscribe.",
        });
      }
      if (message === "ALREADY_ON_PLAN") {
        return res.status(400).json({ error: "Already on this plan." });
      }
      throw err;
    }
  } catch (err) {
    console.error("Failed to upgrade subscription", err);
    return res.status(500).json({ error: "Failed to upgrade subscription" });
  }
});

type ScheduleDowngradeBody = { plan: "starter" };
router.post("/schedule-downgrade", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body as ScheduleDowngradeBody;
    if (body.plan !== "starter") return res.status(400).json({ error: "Invalid plan" });

    try {
      await scheduleDowngrade(organizationId, "starter");
      return res.json({ success: true });
    } catch (err) {
      const message = (err as Error).message;
      if (message === "NO_ACTIVE_SUBSCRIPTION") {
        return res.status(400).json({ error: "No active subscription to downgrade." });
      }
      if (message === "ALREADY_ON_PLAN") {
        return res.status(400).json({ error: "Already on this plan." });
      }
      throw err;
    }
  } catch (err) {
    console.error("Failed to schedule downgrade", err);
    return res.status(500).json({ error: "Failed to schedule downgrade" });
  }
});

type CreateCheckoutSessionBody = {
  plan: "starter" | "pro";
};

router.post("/create-checkout-session", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as CreateCheckoutSessionBody;
    if (body.plan !== "starter" && body.plan !== "pro") {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const successUrl = `${config.appUrl.replace(/\/$/, "")}/usage?checkout=success`;
    const cancelUrl = `${config.appUrl.replace(/\/$/, "")}/usage?checkout=cancel`;

    const session = await createCheckoutSession({
      organizationId,
      plan: body.plan,
      successUrl,
      cancelUrl,
    });

    return res.json({ url: session.url });
  } catch (err) {
    const message = (err as Error).message;
    console.error("Failed to create checkout session", err);
    if (message.includes("Stripe price is not configured")) {
      return res.status(503).json({
        error:
          "Billing is not fully configured. Please ask your administrator to set up Stripe price IDs in the server environment.",
      });
    }
    if (message.includes("STRIPE_PRICE_* must be a Stripe Price ID")) {
      return res.status(503).json({
        error:
          "Stripe price IDs are misconfigured: they must be Price IDs from Stripe (e.g. price_xxx), not numbers. In Stripe Dashboard create a Product and Price, then set STRIPE_PRICE_STARTER_MONTHLY and STRIPE_PRICE_PRO_MONTHLY to those Price IDs in the server .env.",
      });
    }
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;

