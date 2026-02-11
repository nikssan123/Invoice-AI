import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../db/index.js";
import { config } from "../config.js";
import { sendInvitationEmail } from "../services/email.js";
import { PLAN_CONFIG } from "../config/billing.js";

const router = Router();
const INVITATION_EXPIRY_DAYS = 7;

type CreateInvitationBody = { email: string; role?: string };
type UpdateOrganizationBody = { name?: string; address?: string; billingEmail?: string };
type UpdatePreferencesBody = { autoApproveHighConfidence?: boolean; emailNotificationsOnApproval?: boolean };
type UpdateEnterpriseBillingBody = {
  monthlyInvoiceLimit?: number;
  subscriptionStatus?: "active" | "past_due" | "canceled";
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  enterpriseChatEnabled?: boolean;
};

/**
 * @openapi
 * /api/organizations/me:
 *   get:
 *     summary: Get current user's organization
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, address: true, billingEmail: true, ownerId: true },
    });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    res.json(organization);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/organizations/preferences:
 *   get:
 *     summary: Get organization-level processing preferences
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences for the current user's organization
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/preferences", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    res.json({
      autoApproveHighConfidence:
        (organization as { autoApproveHighConfidence?: boolean } | null)?.autoApproveHighConfidence ?? false,
      emailNotificationsOnApproval:
        (organization as { emailNotificationsOnApproval?: boolean } | null)?.emailNotificationsOnApproval ?? true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/organizations/preferences:
 *   patch:
 *     summary: Update organization-level processing preferences (admin only)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autoApproveHighConfidence:
 *                 type: boolean
 *                 description: "If true, invoices with very high extraction confidence will be auto-approved."
 *               emailNotificationsOnApproval:
 *                 type: boolean
 *                 description: "If true, email notifications will be sent when invoices are approved."
 *     responses:
 *       200:
 *         description: Updated preferences
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only organization admins can update preferences
 *       500:
 *         description: Server error
 */
router.patch("/preferences", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    if (role !== "admin") {
      return res.status(403).json({ error: "Only organization admins can update preferences" });
    }

    const body = req.body as UpdatePreferencesBody;
    const data: { autoApproveHighConfidence?: boolean; emailNotificationsOnApproval?: boolean } = {};

    if (typeof body.autoApproveHighConfidence === "boolean") {
      data.autoApproveHighConfidence = body.autoApproveHighConfidence;
    }
    if (typeof body.emailNotificationsOnApproval === "boolean") {
      data.emailNotificationsOnApproval = body.emailNotificationsOnApproval;
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data,
    });

    res.json({
      autoApproveHighConfidence:
        (organization as { autoApproveHighConfidence?: boolean } | null)?.autoApproveHighConfidence ?? false,
      emailNotificationsOnApproval:
        (organization as { emailNotificationsOnApproval?: boolean } | null)?.emailNotificationsOnApproval ?? true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/organizations/me:
 *   patch:
 *     summary: Update current user's organization (admin only)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               billingEmail: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Updated organization
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only organization admins can update
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.patch("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    if (!userId || !organizationId) return res.status(401).json({ error: "Unauthorized" });
    if (role !== "admin") {
      return res.status(403).json({ error: "Only organization admins can update organization" });
    }

    const body = req.body as UpdateOrganizationBody;
    const data: { name?: string; address?: string | null; billingEmail?: string | null } = {};
    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (trimmed) data.name = trimmed;
    }
    if (typeof body.address === "string") data.address = body.address.trim() || null;
    if (typeof body.billingEmail === "string") data.billingEmail = body.billingEmail.trim() || null;

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data,
      select: { id: true, name: true, address: true, billingEmail: true },
    });

    res.json(organization);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/organizations/me/billing:
 *   patch:
 *     summary: Update enterprise billing settings for current organization (admin only)
 *     description: |
 *       Only allowed when subscriptionPlan is enterprise. Used to manually configure
 *       monthly invoice limits, subscription status, and billing period dates.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monthlyInvoiceLimit: { type: integer, minimum: 1 }
 *               subscriptionStatus:
 *                 type: string
 *                 enum: [active, past_due, canceled]
 *               currentPeriodStart:
 *                 type: string
 *                 format: date-time
 *               currentPeriodEnd:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated enterprise billing settings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only admins on an enterprise plan can update billing
 *       500:
 *         description: Server error
 */
router.patch("/me/billing", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
    if (role !== "admin") {
      return res.status(403).json({ error: "Only organization admins can update billing" });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    if (org.subscriptionPlan !== "enterprise") {
      return res.status(403).json({ error: "Enterprise billing can only be updated for enterprise plan" });
    }

    const body = req.body as UpdateEnterpriseBillingBody;
    const data: {
      monthlyInvoiceLimit?: number;
      subscriptionStatus?: "active" | "past_due" | "canceled";
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      enterpriseChatEnabled?: boolean;
    } = {};

    if (typeof body.monthlyInvoiceLimit === "number" && body.monthlyInvoiceLimit > 0) {
      data.monthlyInvoiceLimit = body.monthlyInvoiceLimit;
    }
    if (
      body.subscriptionStatus === "active" ||
      body.subscriptionStatus === "past_due" ||
      body.subscriptionStatus === "canceled"
    ) {
      data.subscriptionStatus = body.subscriptionStatus;
    }
    if (typeof body.currentPeriodStart === "string") {
      data.currentPeriodStart = new Date(body.currentPeriodStart);
    }
    if (typeof body.currentPeriodEnd === "string") {
      data.currentPeriodEnd = new Date(body.currentPeriodEnd);
    }
    if (typeof body.enterpriseChatEnabled === "boolean") {
      data.enterpriseChatEnabled = body.enterpriseChatEnabled;
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data,
    });

    res.json({
      id: updated.id,
      subscriptionPlan: updated.subscriptionPlan,
      subscriptionStatus: updated.subscriptionStatus,
      monthlyInvoiceLimit: updated.monthlyInvoiceLimit,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      invoicesUsedThisPeriod: updated.invoicesUsedThisPeriod,
      enterpriseChatEnabled: updated.enterpriseChatEnabled,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

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
 * /api/organizations/members:
 *   get:
 *     summary: List organization members (users in the same organization)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organization members
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/members", async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const [organization, members] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      }),
      prisma.user.findMany({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({ members, ownerId: organization?.ownerId ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

type UpdateMemberRoleBody = { role: "admin" | "member" };

/**
 * @openapi
 * /api/organizations/members/:userId/role:
 *   patch:
 *     summary: Update a member's role (admin or owner only; only owner can demote admin)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [admin, member] }
 *     responses:
 *       200:
 *         description: Role updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.patch("/members/:userId/role", async (req: Request, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const requesterRole = req.user?.role;
    if (!requesterId || !organizationId) return res.status(401).json({ error: "Unauthorized" });
    if (requesterRole !== "admin") {
      return res.status(403).json({ error: "Only admins can change member roles" });
    }

    const targetUserId = req.params.userId;
    const { role: newRole } = req.body as UpdateMemberRoleBody;
    if (newRole !== "admin" && newRole !== "member") {
      return res.status(400).json({ error: "role must be admin or member" });
    }

    const [organization, targetUser] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, organizationId: true, role: true },
      }),
    ]);

    if (!organization || !targetUser) return res.status(404).json({ error: "User not found" });
    if (targetUser.organizationId !== organizationId) return res.status(404).json({ error: "User not found" });

    const isOwner = organization.ownerId === requesterId;
    if (organization.ownerId === targetUserId) {
      return res.status(403).json({ error: "Cannot change the organization owner's role" });
    }
    if (targetUser.role === "admin" && newRole === "member" && !isOwner) {
      return res.status(403).json({ error: "Only the organization owner can demote administrators" });
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/organizations/members/:userId:
 *   delete:
 *     summary: Remove a member from the organization (admin or owner; only owner can remove admins)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member removed
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete("/members/:userId", async (req: Request, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const requesterRole = req.user?.role;
    if (!requesterId || !organizationId) return res.status(401).json({ error: "Unauthorized" });
    if (requesterRole !== "admin") {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    const targetUserId = req.params.userId;
    if (targetUserId === requesterId) {
      return res.status(400).json({ error: "Cannot remove yourself" });
    }

    const [organization, targetUser] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, organizationId: true, role: true },
      }),
    ]);

    if (!organization || !targetUser) return res.status(404).json({ error: "User not found" });
    if (targetUser.organizationId !== organizationId) return res.status(404).json({ error: "User not found" });

    const isOwner = organization.ownerId === requesterId;
    if (organization.ownerId === targetUserId) {
      return res.status(403).json({ error: "Cannot remove the organization owner" });
    }
    if (targetUser.role === "admin" && !isOwner) {
      return res.status(403).json({ error: "Only the organization owner can remove administrators" });
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

type TransferOwnershipBody = { newOwnerId: string };

/**
 * @openapi
 * /api/organizations/transfer-ownership:
 *   post:
 *     summary: Transfer organization ownership to another member (owner only)
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newOwnerId]
 *             properties:
 *               newOwnerId: { type: string }
 *     responses:
 *       200:
 *         description: Ownership transferred
 *       400:
 *         description: Invalid newOwnerId
 *       403:
 *         description: Only the organization owner can transfer ownership
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/transfer-ownership", async (req: Request, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!requesterId || !organizationId) return res.status(401).json({ error: "Unauthorized" });

    const { newOwnerId } = req.body as TransferOwnershipBody;
    if (!newOwnerId || typeof newOwnerId !== "string") {
      return res.status(400).json({ error: "newOwnerId is required" });
    }

    const [organization, newOwner] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      }),
      prisma.user.findUnique({
        where: { id: newOwnerId },
        select: { id: true, organizationId: true },
      }),
    ]);

    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (organization.ownerId !== requesterId) {
      return res.status(403).json({ error: "Only the organization owner can transfer ownership" });
    }
    if (!newOwner) return res.status(404).json({ error: "User not found" });
    if (newOwner.organizationId !== organizationId) {
      return res.status(400).json({ error: "New owner must be a member of this organization" });
    }
    if (newOwnerId === requesterId) {
      return res.status(400).json({ error: "New owner must be a different user" });
    }

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { ownerId: newOwnerId },
      }),
      prisma.user.update({
        where: { id: requesterId },
        data: { role: "admin" },
      }),
    ]);

    res.status(200).json({ ok: true });
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
      where: { organizationId, status: "pending" },
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
