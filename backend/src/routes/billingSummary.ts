import { Router, Request, Response } from "express";
import prisma from "../db/index.js";
import { getScheduledDowngrade, getCancelAtPeriodEnd } from "../services/stripeBilling.js";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        monthlyInvoiceLimit: true,
        invoicesUsedThisPeriod: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        enterpriseChatEnabled: true,
        stripeSubscriptionId: true,
      },
    });

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const now = new Date();
    const isTrial =
      org.trialEndsAt != null && now <= org.trialEndsAt && org.stripeSubscriptionId == null;

    const [scheduled, cancelAtPeriodEnd] = await Promise.all([
      getScheduledDowngrade(organizationId),
      getCancelAtPeriodEnd(organizationId),
    ]);

    const enterpriseChatEnabled = org.enterpriseChatEnabled ?? false;
    const chatAvailable =
      org.subscriptionPlan === "starter" ||
      org.subscriptionPlan === "pro" ||
      (org.subscriptionPlan === "enterprise" && enterpriseChatEnabled);

    res.json({
      plan: org.subscriptionPlan,
      subscriptionStatus: org.subscriptionStatus,
      monthlyInvoiceLimit: org.monthlyInvoiceLimit,
      invoicesUsedThisPeriod: org.invoicesUsedThisPeriod,
      currentPeriodStart: org.currentPeriodStart,
      currentPeriodEnd: org.currentPeriodEnd,
      trialEndsAt: org.trialEndsAt,
      isTrial,
      scheduledDowngradeTo: scheduled.scheduledDowngradeTo,
      scheduledDowngradeAt: scheduled.scheduledDowngradeAt,
      cancelAtPeriodEnd,
      enterpriseChatEnabled,
      chatAvailable,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

