import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../db/index.js";
import { config } from "../config.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/email.js";

const router = Router();
const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

type RegisterBody = { email: string; password: string; name?: string };
type LoginBody = { email: string; password: string };
type ForgotPasswordBody = { email: string };
type ResetPasswordBody = { token: string; password: string };

function signToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );
}

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
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               name: { type: string }
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
    const { email, password, name } = req.body as RegisterBody;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "User already exists with this email" });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name ?? null },
    });
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error("Welcome email failed:", err)
    );
    const token = signToken(user.id, user.email);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
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
    const token = signToken(user.id, user.email);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
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

export default router;
