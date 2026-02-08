import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../db/index.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/email.js";

const router = Router();
const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

type RegisterBody = { email: string; password: string; name?: string; organizationName?: string };
type LoginBody = { email: string; password: string };
type ForgotPasswordBody = { email: string };
type ResetPasswordBody = { token: string; password: string };
type AcceptInviteBody = { token: string; password: string; name?: string };

function signToken(userId: string, email: string, role: string, organizationId: string): string {
  return jwt.sign(
    { userId, email, role, organizationId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );
}

function normalizeOrgName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user (validate token)
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 email: { type: string }
 *                 name: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, organization]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               name: { type: string }
 *               organization: { type: string }
 *     responses:
 *       201:
 *         description: User created; returns token and user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { type: object, properties: { id: { type: string }, email: { type: string }, name: { type: string, nullable: true } } }
 *       400:
 *         description: Email and password are required
 *       409:
 *         description: User already exists with this email
 *       500:
 *         description: Server error
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, organizationName } = req.body as RegisterBody;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const orgName = organizationName?.trim();
    if (!orgName) {
      return res.status(400).json({ error: "Organization name is required" });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists with this email" });
    }
    const normalized = normalizeOrgName(orgName);
    const existingOrg = await prisma.organization.findFirst({
      where: { name: { equals: normalized, mode: "insensitive" } },
    });
    if (existingOrg) {
      return res.status(409).json({
        error: "Organization already exists. Ask your organization admin for an invitation.",
      });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const org = await prisma.organization.create({
      data: { name: orgName.trim() },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        organizationId: org.id,
        role: "admin",
      },
    });
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error("Welcome email failed:", err)
    );
    const token = signToken(user.id, user.email, user.role, user.organizationId);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in and get JWT
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Returns token and user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { type: object, properties: { id: { type: string }, email: { type: string }, name: { type: string, nullable: true } } }
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid email or password
 *       500:
 *         description: Server error
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginBody;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = signToken(user.id, user.email, user.role, user.organizationId);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: If an account exists, a reset email was sent (generic message)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Email is required
 *       500:
 *         description: Server error
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as ForgotPasswordBody;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const plainToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = await bcrypt.hash(plainToken, SALT_ROUNDS);
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpires: expires,
        },
      });
      await sendPasswordResetEmail(user.email, plainToken);
    }
    res.status(200).json({ message: "If an account exists, you will receive a password reset email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token from email
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Password has been reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Token and password required or invalid/expired token
 *       500:
 *         description: Server error
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as ResetPasswordBody;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }
    const now = new Date();
    const candidates = await prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpires: { gt: now },
      },
    });
    let user: (typeof candidates)[0] | null = null;
    for (const u of candidates) {
      if (u.passwordResetToken && (await bcrypt.compare(token, u.passwordResetToken))) {
        user = u;
        break;
      }
    }
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    res.status(200).json({ message: "Password has been reset. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/auth/accept-invite:
 *   post:
 *     summary: Accept an invitation (create account with token)
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string }
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Account created; returns token and user
 *       400:
 *         description: Invalid or expired invitation token
 *       500:
 *         description: Server error
 */
router.post("/accept-invite", async (req: Request, res: Response) => {
  try {
    const { token, password, name } = req.body as AcceptInviteBody;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }
    const now = new Date();
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt < now
    ) {
      return res.status(400).json({ error: "Invalid or expired invitation token" });
    }
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) {
      return res.status(400).json({ error: "A user with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        name: name ?? null,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error("Welcome email failed:", err)
    );
    const jwt = signToken(user.id, user.email, user.role, user.organizationId);
    res.status(201).json({
      token: jwt,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
