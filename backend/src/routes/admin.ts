import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Router, Request, Response } from "express";
import prisma from "../db/index.js";
import { config } from "../config.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";

const router = Router();
const BASE = "/api/admin";
const ADMIN_JWT_EXPIRES_IN = "7d";

function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function getPublicTableNames(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

// GET /api/admin/me — require admin JWT, return { admin: true } (must be before /:tableName)
router.get("/me", requireAdminAuth, (req: Request, res: Response) => {
  res.json({ admin: true });
});

// POST /api/admin/login — validate credentials, return JWT
router.post("/login", (req: Request, res: Response) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const ok =
    config.adminUsername !== "" &&
    config.adminPassword !== "" &&
    constantTimeCompare(username, config.adminUsername) &&
    constantTimeCompare(password, config.adminPassword);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = jwt.sign(
    { admin: true },
    config.jwtSecret,
    { expiresIn: ADMIN_JWT_EXPIRES_IN } as jwt.SignOptions
  );
  res.json({ ok: true, token });
});

// POST /api/admin/logout — no-op; frontend clears token
router.post("/logout", (req: Request, res: Response) => {
  res.json({ ok: true });
});

// GET /api/admin — dashboard (tables count + row counts), JSON
router.get("/", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const tableNames = await getPublicTableNames();
    const tables: { name: string; rowCount: number }[] = [];
    for (const name of tableNames) {
      const safe = name.replace(/"/g, '""');
      const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*)::bigint AS count FROM "${safe}"`
      );
      const rowCount = Number(rows[0]?.count ?? 0);
      tables.push({ name, rowCount });
    }
    res.json({ tables, totalTables: tables.length });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard." });
  }
});

// GET /api/admin/organizations — list orgs for limits panel (must be before /:tableName)
router.get("/organizations", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        monthlyInvoiceLimit: true,
        invoicesUsedThisPeriod: true,
        enterpriseChatEnabled: true,
        chatMessageLimitPerInvoice: true,
        currentPeriodEnd: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(orgs);
  } catch (err) {
    console.error("Admin organizations list error:", err);
    res.status(500).json({ error: "Failed to load organizations." });
  }
});

// PATCH /api/admin/organizations/:id/limits — set custom limits (admin only)
router.patch("/organizations/:id/limits", requireAdminAuth, async (req: Request, res: Response) => {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) return res.status(400).json({ error: "Bad request" });
  const body = req.body as {
    monthlyInvoiceLimit?: number;
    chatMessageLimitPerInvoice?: number | null;
    enterpriseChatEnabled?: boolean;
  };
  const updates: {
    monthlyInvoiceLimit?: number;
    chatMessageLimitPerInvoice?: number | null;
    enterpriseChatEnabled?: boolean;
  } = {};
  if (typeof body.monthlyInvoiceLimit === "number") {
    if (body.monthlyInvoiceLimit < 1 || body.monthlyInvoiceLimit > 1_000_000) {
      return res.status(400).json({ error: "monthlyInvoiceLimit must be between 1 and 1000000" });
    }
    updates.monthlyInvoiceLimit = body.monthlyInvoiceLimit;
  }
  if (body.chatMessageLimitPerInvoice !== undefined) {
    const v = body.chatMessageLimitPerInvoice;
    if (v !== null && (typeof v !== "number" || v < 0 || v > 10_000)) {
      return res.status(400).json({ error: "chatMessageLimitPerInvoice must be null or 0–10000" });
    }
    updates.chatMessageLimitPerInvoice = v;
  }
  if (typeof body.enterpriseChatEnabled === "boolean") {
    updates.enterpriseChatEnabled = body.enterpriseChatEnabled;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }
  try {
    const updated = await prisma.organization.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        monthlyInvoiceLimit: true,
        invoicesUsedThisPeriod: true,
        enterpriseChatEnabled: true,
        chatMessageLimitPerInvoice: true,
      },
    });
    res.json(updated);
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") {
      return res.status(404).json({ error: "Organization not found" });
    }
    console.error("Admin update limits error:", err);
    res.status(500).json({ error: "Failed to update limits." });
  }
});

// GET /api/admin/:tableName — read-only table data (max 100 rows), JSON
router.get("/:tableName", requireAdminAuth, async (req: Request, res: Response) => {
  const raw = typeof req.params.tableName === "string" ? req.params.tableName.trim() : "";
  if (!raw) return res.status(400).json({ error: "Bad request" });
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return res.status(404).json({ error: "Not found" });
  try {
    const allowed = await getPublicTableNames();
    if (!allowed.includes(raw)) return res.status(404).json({ error: "Not found" });
    const safe = raw.replace(/"/g, '""');
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${safe}" LIMIT 100`
    );
    const columns =
      rows.length > 0 ? (Object.keys(rows[0] as object) as string[]) : [];
    res.json({ tableName: raw, columns, rows });
  } catch (err) {
    console.error("Admin table error:", err);
    res.status(500).json({ error: "Error loading table." });
  }
});

export default router;
