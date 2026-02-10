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
      },
    });

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const [scheduled, cancelAtPeriodEnd] = await Promise.all([
      getScheduledDowngrade(organizationId),
      getCancelAtPeriodEnd(organizationId),
    ]);

    res.json({
      plan: org.subscriptionPlan,
      subscriptionStatus: org.subscriptionStatus,
      monthlyInvoiceLimit: org.monthlyInvoiceLimit,
      invoicesUsedThisPeriod: org.invoicesUsedThisPeriod,
      currentPeriodStart: org.currentPeriodStart,
      currentPeriodEnd: org.currentPeriodEnd,
      scheduledDowngradeTo: scheduled.scheduledDowngradeTo,
      scheduledDowngradeAt: scheduled.scheduledDowngradeAt,
      cancelAtPeriodEnd,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

