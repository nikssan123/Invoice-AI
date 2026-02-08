import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { Prisma } from "@prisma/client";
import prisma from "../db/index.js";
import { upload, getUploadPath } from "../middleware/upload.js";
import { extractInvoice } from "../services/extractionService.js";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const uploadDir = path.join(path.dirname(__dirname), "..", config.uploadDir);

export type ApproveBody = { approvedBy: string; action: "approved" | "needs_review" };
export type FieldsBody = Partial<{
  supplierName: string;
  supplierVatNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}>;

/**
 * @openapi
 * /api/invoices/upload:
 *   post:
 *     summary: Upload invoice files
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Returns created invoice ids and filenames
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ids: { type: array, items: { type: string } }
 *                 files: { type: array, items: { type: object, properties: { id: { type: string }, filename: { type: string } } } }
 *       400:
 *         description: No files uploaded
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/upload", upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const userId = req.user?.id ?? null;
    const created: { id: string; filename: string }[] = [];
    for (const f of files) {
      const invoice = await prisma.invoice.create({
        data: {
          filename: f.originalname,
          filePath: f.filename,
          mimeType: f.mimetype,
          status: "pending",
          ...(userId && { userId }),
        } as never,
      });
      created.push({ id: invoice.id, filename: invoice.filename });
    }
    res.json({ ids: created.map((c) => c.id), files: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

function canAccessInvoice(invoice: unknown, req: Request): boolean {
  const uid = (invoice as { userId?: string | null }).userId;
  if (uid == null) return true;
  return req.user?.id === uid;
}

/**
 * @openapi
 * /api/invoices/{id}/extract:
 *   post:
 *     summary: Extract data from an invoice file
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Extracted invoice fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supplierName: { type: string, nullable: true }
 *                 supplierVatNumber: { type: string, nullable: true }
 *                 invoiceNumber: { type: string, nullable: true }
 *                 invoiceDate: { type: string, nullable: true }
 *                 currency: { type: string, nullable: true }
 *                 netAmount: { type: number, nullable: true }
 *                 vatAmount: { type: number, nullable: true }
 *                 totalAmount: { type: number, nullable: true }
 *                 confidenceScores: {}
 *       404:
 *         description: Invoice or file not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/:id/extract", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });

    const fullPath = getUploadPath(invoice.filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File not found" });

    const extracted = await extractInvoice(id, invoice.filePath, invoice.mimeType);
    const now = new Date();

    await prisma.invoiceFields.upsert({
      where: { invoiceId: id },
      create: {
        invoiceId: id,
        supplierName: extracted.supplierName,
        supplierVatNumber: extracted.supplierVatNumber,
        invoiceNumber: extracted.invoiceNumber,
        invoiceDate: extracted.invoiceDate,
        currency: extracted.currency,
        netAmount: extracted.netAmount,
        vatAmount: extracted.vatAmount,
        totalAmount: extracted.totalAmount,
        confidenceScores: extracted.confidenceScores,
        extractedAt: now,
      },
      update: {
        supplierName: extracted.supplierName,
        supplierVatNumber: extracted.supplierVatNumber,
        invoiceNumber: extracted.invoiceNumber,
        invoiceDate: extracted.invoiceDate,
        currency: extracted.currency,
        netAmount: extracted.netAmount,
        vatAmount: extracted.vatAmount,
        totalAmount: extracted.totalAmount,
        confidenceScores: extracted.confidenceScores,
        extractedAt: now,
      },
    });

    res.json(extracted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/stats:
 *   get:
 *     summary: Get invoice counts by status
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Counts for total, pending, approved, needs_review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 pending: { type: integer }
 *                 approved: { type: integer }
 *                 needs_review: { type: integer }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const baseWhere = (req.user ? { userId: req.user.id } : {}) as Prisma.InvoiceWhereInput;
    const [total, pending, approved, needsReview] = await Promise.all([
      prisma.invoice.count({ where: baseWhere }),
      prisma.invoice.count({ where: { ...baseWhere, status: "pending" } }),
      prisma.invoice.count({ where: { ...baseWhere, status: "approved" } }),
      prisma.invoice.count({ where: { ...baseWhere, status: "needs_review" } }),
    ]);
    res.json({ total, pending, approved, needs_review: needsReview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices:
 *   get:
 *     summary: List invoices
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of invoices (id, filename, status, createdAt, hasFields)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   filename: { type: string }
 *                   status: { type: string }
 *                   createdAt: { type: string, format: date-time }
 *                   hasFields: { type: boolean }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where = (
      status && typeof status === "string"
        ? { status, ...(req.user && { userId: req.user.id }) }
        : { ...(req.user && { userId: req.user.id }) }
    ) as Prisma.InvoiceWhereInput;
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { fields: true },
    }); 
    res.json(
      invoices.map((inv) => ({
        id: inv.id,
        filename: inv.filename,
        status: inv.status,
        createdAt: inv.createdAt,
        hasFields: !!inv.fields,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/{id}/file:
 *   get:
 *     summary: Download invoice file
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice file (PDF or image)
 *       404:
 *         description: Invoice or file not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id/file", async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });
    const fullPath = getUploadPath(invoice.filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File not found" });
    res.sendFile(path.resolve(fullPath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID with fields and approvals
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice detail with fileUrl, fields, approvals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 filename: { type: string }
 *                 status: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *                 fileUrl: { type: string }
 *                 fields: { type: object, nullable: true }
 *                 approvals: { type: array, items: { type: object } }
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { fields: true, approvals: { orderBy: { approvedAt: "desc" }, take: 10 } },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });

    const fileUrl = `/api/invoices/${invoice.id}/file`;
    const fields = invoice.fields
      ? {
          supplierName: invoice.fields.supplierName,
          supplierVatNumber: invoice.fields.supplierVatNumber,
          invoiceNumber: invoice.fields.invoiceNumber,
          invoiceDate: invoice.fields.invoiceDate,
          currency: invoice.fields.currency,
          netAmount: invoice.fields.netAmount != null ? Number(invoice.fields.netAmount) : null,
          vatAmount: invoice.fields.vatAmount != null ? Number(invoice.fields.vatAmount) : null,
          totalAmount: invoice.fields.totalAmount != null ? Number(invoice.fields.totalAmount) : null,
          confidenceScores: invoice.fields.confidenceScores,
        }
      : null;

    res.json({
      id: invoice.id,
      filename: invoice.filename,
      status: invoice.status,
      createdAt: invoice.createdAt,
      fileUrl,
      fields,
      approvals: invoice.approvals.map((a) => ({
        approvedBy: a.approvedBy,
        approvedAt: a.approvedAt,
        action: a.action,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/{id}/fields:
 *   patch:
 *     summary: Update extracted invoice fields
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supplierName: { type: string }
 *               supplierVatNumber: { type: string }
 *               invoiceNumber: { type: string }
 *               invoiceDate: { type: string }
 *               currency: { type: string }
 *               netAmount: { type: number }
 *               vatAmount: { type: number }
 *               totalAmount: { type: number }
 *     responses:
 *       200:
 *         description: Updated fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supplierName: { type: string, nullable: true }
 *                 supplierVatNumber: { type: string, nullable: true }
 *                 invoiceNumber: { type: string, nullable: true }
 *                 invoiceDate: { type: string, nullable: true }
 *                 currency: { type: string, nullable: true }
 *                 netAmount: { type: number, nullable: true }
 *                 vatAmount: { type: number, nullable: true }
 *                 totalAmount: { type: number, nullable: true }
 *                 confidenceScores: {}
 *       400:
 *         description: Cannot edit approved invoice
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/:id/fields", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "approved")
      return res.status(400).json({ error: "Cannot edit approved invoice" });

    const body = req.body as FieldsBody;
    const data: FieldsBody = {};
    if (body.supplierName !== undefined) data.supplierName = body.supplierName;
    if (body.supplierVatNumber !== undefined) data.supplierVatNumber = body.supplierVatNumber;
    if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber;
    if (body.invoiceDate !== undefined) data.invoiceDate = body.invoiceDate;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.netAmount !== undefined) data.netAmount = body.netAmount;
    if (body.vatAmount !== undefined) data.vatAmount = body.vatAmount;
    if (body.totalAmount !== undefined) data.totalAmount = body.totalAmount;

    const updated = await prisma.invoiceFields.upsert({
      where: { invoiceId: id },
      create: { invoiceId: id, ...data },
      update: data,
    });

    res.json({
      supplierName: updated.supplierName,
      supplierVatNumber: updated.supplierVatNumber,
      invoiceNumber: updated.invoiceNumber,
      invoiceDate: updated.invoiceDate,
      currency: updated.currency,
      netAmount: updated.netAmount != null ? Number(updated.netAmount) : null,
      vatAmount: updated.vatAmount != null ? Number(updated.vatAmount) : null,
      totalAmount: updated.totalAmount != null ? Number(updated.totalAmount) : null,
      confidenceScores: updated.confidenceScores,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/{id}/approve:
 *   post:
 *     summary: Approve or flag invoice for review
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, enum: [approved, needs_review] }
 *               approvedBy: { type: string }
 *     responses:
 *       200:
 *         description: Invoice status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 status: { type: string }
 *                 message: { type: string }
 *       400:
 *         description: action or approvedBy required
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as ApproveBody;
    const action = body.action;
    if (!action || !["approved", "needs_review"].includes(action)) {
      return res.status(400).json({ error: "action (approved|needs_review) required" });
    }
    const approvedBy = req.user?.email ?? body.approvedBy ?? "";
    if (!approvedBy) {
      return res.status(400).json({ error: "approvedBy required" });
    }
    const invoiceForCheck = await prisma.invoice.findUnique({ where: { id } });
    if (!invoiceForCheck) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoiceForCheck, req)) return res.status(404).json({ error: "Invoice not found" });

    const [invoice] = await prisma.$transaction([
      prisma.invoice.update({
        where: { id },
        data: { status: action },
      }),
      prisma.approval.create({
        data: { invoiceId: id, approvedBy, action },
      }),
    ]);

    res.json({
      id: invoice.id,
      status: invoice.status,
      message: action === "approved" ? "Invoice approved" : "Flagged for review",
    });
  } catch (err) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2025") return res.status(404).json({ error: "Invoice not found" });
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
