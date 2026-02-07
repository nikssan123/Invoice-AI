import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
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

// POST /api/invoices/upload - multiple files
router.post("/upload", upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const created: { id: string; filename: string }[] = [];
    for (const f of files) {
      const invoice = await prisma.invoice.create({
        data: {
          filename: f.originalname,
          filePath: f.filename,
          mimeType: f.mimetype,
          status: "pending",
        },
      });
      created.push({ id: invoice.id, filename: invoice.filename });
    }
    res.json({ ids: created.map((c) => c.id), files: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/invoices/:id/extract
router.post("/:id/extract", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

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

// GET /api/invoices/stats - must be before /:id
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [total, pending, approved, needsReview] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: "pending" } }),
      prisma.invoice.count({ where: { status: "approved" } }),
      prisma.invoice.count({ where: { status: "needs_review" } }),
    ]);
    res.json({ total, pending, approved, needs_review: needsReview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/invoices - list
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where = status && typeof status === "string" ? { status } : {};
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

// GET /api/invoices/:id/file - serve file
router.get("/:id/file", async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const fullPath = getUploadPath(invoice.filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File not found" });
    res.sendFile(path.resolve(fullPath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/invoices/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { fields: true, approvals: { orderBy: { approvedAt: "desc" }, take: 10 } },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

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

// PATCH /api/invoices/:id/fields - update extracted fields (user edits)
router.patch("/:id/fields", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
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

// POST /api/invoices/:id/approve
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvedBy, action } = req.body as ApproveBody;
    if (!approvedBy || !action || !["approved", "needs_review"].includes(action)) {
      return res.status(400).json({ error: "approvedBy and action (approved|needs_review) required" });
    }

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
