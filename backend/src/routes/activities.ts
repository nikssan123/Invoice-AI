import { Router, Request, Response } from "express";
import prisma from "../db/index.js";

const router = Router();

/**
 * @openapi
 * /api/activities:
 *   get:
 *     summary: Get recent activities for the current organization
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: List of recent activities
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limitRaw = req.query.limit;
    let limit = 20;
    if (typeof limitRaw === "string") {
      const parsed = parseInt(limitRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

    const activities = await (prisma as any).activity.findMany({
      where: { organizationId: orgId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

