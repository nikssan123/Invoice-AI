import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type UpdateEmailBody = { email: string; currentPassword: string };
type UpdatePasswordBody = { currentPassword: string; newPassword: string };

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

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      hasExportConfig,
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

export default router;

