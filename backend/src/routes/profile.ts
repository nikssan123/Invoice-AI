import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  cancelSubscriptionImmediatelyForOrganization,
  deleteCustomerForOrganization,
} from "../services/stripeBilling.js";

const router = Router();

type UpdateEmailBody = { email: string; currentPassword: string };
type UpdatePasswordBody = { currentPassword: string; newPassword: string };
type DeleteAccountBody = { newOwnerId?: string; password?: string };

/**
 * @openapi
 * /api/profile/me:
 *   get:
 *     summary: Get current user profile
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
        excelExportColumnLabels: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const hasExportConfig =
      user.excelExportColumnLabels != null &&
      typeof user.excelExportColumnLabels === "object" &&
      Object.keys(user.excelExportColumnLabels as Record<string, unknown>).length > 0;

    let isOwner = false;
    if (user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { ownerId: true },
      });
      isOwner = org?.ownerId === user.id;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      hasExportConfig,
      isOwner,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/profile/email:
 *   put:
 *     summary: Change email for current user
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               currentPassword: { type: string }
 *     responses:
 *       200:
 *         description: Email updated
 *       400:
 *         description: Invalid input or password
 *       409:
 *         description: Email already in use
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/email", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { email, currentPassword } = req.body as UpdateEmailBody;
    if (!email || !currentPassword) {
      return res.status(400).json({ error: "email and currentPassword are required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "Invalid current password" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email },
      select: { id: true, email: true, name: true },
    });

    res.json({ user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/profile/password:
 *   put:
 *     summary: Change password for current user
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Invalid input or password
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/password", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { currentPassword, newPassword } = req.body as UpdatePasswordBody;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "Invalid current password" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/profile/delete-account:
 *   post:
 *     summary: Delete current user account (owner must transfer ownership or delete org if only member)
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newOwnerId: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Account deleted
 *       400:
 *         description: Transfer ownership first or invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/delete-account", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = (req.body as DeleteAccountBody) || {};
    const { newOwnerId } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, ownerId: true },
    });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    const isOwner = organization.ownerId === userId;
    const memberCount = await prisma.user.count({
      where: { organizationId: user.organizationId },
    });

    if (!isOwner) {
      await prisma.user.delete({ where: { id: userId } });
      return res.status(200).json({ success: true });
    }

    if (memberCount > 1) {
      if (newOwnerId && newOwnerId !== userId) {
        const newOwner = await prisma.user.findUnique({
          where: { id: newOwnerId },
          select: { id: true, organizationId: true },
        });
        if (!newOwner || newOwner.organizationId !== user.organizationId) {
          return res.status(400).json({
            error: "New owner must be another member of this organization",
          });
        }
        await prisma.$transaction([
          prisma.organization.update({
            where: { id: user.organizationId },
            data: { ownerId: newOwnerId },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { role: "admin" },
          }),
        ]);
        await prisma.user.delete({ where: { id: userId } });
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({
        error:
          "Transfer ownership to another member first (provide newOwnerId) or delete the organization when you are the only member",
      });
    }

    await cancelSubscriptionImmediatelyForOrganization(user.organizationId);
    await deleteCustomerForOrganization(user.organizationId);

    const folderIds = await prisma.folder.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    const ids = folderIds.map((f) => f.id);
    if (ids.length > 0) {
      await prisma.invoice.deleteMany({ where: { folderId: { in: ids } } });
    }

    await prisma.organization.delete({
      where: { id: user.organizationId },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

