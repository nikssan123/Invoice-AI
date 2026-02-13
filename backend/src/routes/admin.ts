import crypto from "crypto";
import { Router, Request, Response } from "express";
import prisma from "../db/index.js";
import { config } from "../config.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";

const router = Router();
const BASE = "/api/admin";

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

// GET /api/admin/login — login page
router.get("/login", (req: Request, res: Response) => {
  if (req.session?.admin === true) {
    return res.redirect(BASE);
  }
  res.render("admin/login", { error: null, base: BASE });
});

// POST /api/admin/login — validate credentials
router.post("/login", (req: Request, res: Response) => {
  if (req.session?.admin === true) {
    return res.redirect(BASE);
  }
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const ok =
    config.adminUsername !== "" &&
    config.adminPassword !== "" &&
    constantTimeCompare(username, config.adminUsername) &&
    constantTimeCompare(password, config.adminPassword);
  if (!ok) {
    return res.render("admin/login", { error: "Invalid credentials.", base: BASE });
  }
  req.session.admin = true;
  req.session.save((err) => {
    if (err) {
      console.error("Admin session save error:", err);
      return res.status(500).send("Session error. Please try again.");
    }
    res.redirect(BASE);
  });
});

// POST /api/admin/logout
router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect(BASE + "/login");
  });
});

// GET /api/admin — dashboard (tables count + row counts)
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
    res.render("admin/dashboard", {
      base: BASE,
      tables,
      totalTables: tables.length,
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).send("Failed to load dashboard.");
  }
});

// GET /api/admin/:tableName — read-only table view (max 100 rows)
router.get("/:tableName", requireAdminAuth, async (req: Request, res: Response) => {
  const raw = typeof req.params.tableName === "string" ? req.params.tableName.trim() : "";
  if (!raw) return res.status(400).send("Bad request");
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) return res.status(404).send("Not found");
  try {
    const allowed = await getPublicTableNames();
    if (!allowed.includes(raw)) return res.status(404).send("Not found");
    const safe = raw.replace(/"/g, '""');
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${safe}" LIMIT 100`
    );
    const columns =
      rows.length > 0 ? (Object.keys(rows[0] as object) as string[]) : [];
    res.render("admin/table", {
      base: BASE,
      tableName: raw,
      columns,
      rows,
    });
  } catch (err) {
    console.error("Admin table error:", err);
    res.status(500).send("Error loading table.");
  }
});

export default router;
