import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../db/index.js";
import { config } from "../config.js";
import { sendInvitationEmail } from "../services/email.js";

const router = Router();
const INVITATION_EXPIRY_DAYS = 7;

type CreateInvitationBody = { email: string; role?: string };

/**
 * @openapi
 * /api/organizations/invitations:
 *   post:
 *     summary: Create an invitation (admin only)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, default: member }
 *     responses:
 *       201:
 *         description: Invitation created and email sent
 *       403:
 *         description: Only organization admins can invite
 *       409:
 *         description: User already in organization or invitation already pending
 *       500:
 *         description: Server error
 */
router.post("/invitations", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    if (!userId || !organizationId) return res.status(401).json({ error: "Unauthorized" });
    if (role !== "admin") {
      return res.status(403).json({ error: "Only organization admins can invite users" });
    }

    const { email, role: inviteRole } = req.body as CreateInvitationBody;
    const emailTrimmed = email?.trim().toLowerCase();
    if (!emailTrimmed) {
      return res.status(400).json({ error: "Email is required" });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: emailTrimmed, organizationId },
    });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email is already in your organization" });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email: emailTrimmed,
        status: "pending",
      },
    });
    if (existingInvitation) {
      return res.status(409).json({ error: "An invitation for this email is already pending" });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        email: emailTrimmed,
        invitedById: userId,
        role: inviteRole === "admin" ? "admin" : "member",
        token,
        expiresAt,
        status: "pending",
      },
      include: { invitedBy: { select: { name: true } } },
    });

    const acceptUrl = `${config.appUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
    const inviterName = invitation.invitedBy.name ?? "A team member";
    await sendInvitationEmail(emailTrimmed, organization.name, inviterName, acceptUrl).catch((err) =>
      console.error("Invitation email failed:", err)
    );

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/organizations/invitations:
 *   get:
 *     summary: List invitations for the organization
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending (and optionally all) invitations
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/invitations", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const invitations = await prisma.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true, email: true } },
      },
    });

    res.json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
