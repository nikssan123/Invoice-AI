import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { Prisma } from "@prisma/client";
import prisma from "../db/index.js";
import { upload, getUploadPath } from "../middleware/upload.js";
import { extractInvoice, invoiceChat, type InvoiceChatHistoryItem } from "../services/extractionService.js";
import { logActivity } from "../services/activityLogger.js";
import { sendInvoiceApprovedNotification } from "../services/email.js";
import { assertCanProcessInvoices, incrementInvoicesUsed, UsageLimitError } from "../services/usageLimits.js";
import { config } from "../config.js";
import ExcelJS from "exceljs";
import {
  EXPORT_COLUMNS,
  mergeExportColumnLabels,
  type ExportColumnKey,
  type ExportColumnLabelsOverride,
} from "../services/exportColumns.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const uploadDir = path.join(path.dirname(__dirname), "..", config.uploadDir);

export type ApproveBody = { approvedBy: string; action: "approved" | "needs_review" };
export type FieldsBody = Partial<{
  supplierName: string;
  supplierVatNumber: string;
  supplierAddress: string;
  supplierEIK: string;
  clientName: string;
  clientEIK: string;
  clientVatNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  serviceDescription: string;
  quantity: string;
  unitPrice: number;
  serviceTotal: number;
  accountingAccount: string;
  currency: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}>;

type FieldsRow = {
  supplierName?: string | null;
  supplierVatNumber?: string | null;
  supplierAddress?: string | null;
  supplierEIK?: string | null;
  clientName?: string | null;
  clientEIK?: string | null;
  clientVatNumber?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  serviceDescription?: string | null;
  quantity?: string | null;
  unitPrice?: unknown;
  serviceTotal?: unknown;
  accountingAccount?: string | null;
  currency?: string | null;
  netAmount?: unknown;
  vatAmount?: unknown;
  totalAmount?: unknown;
  confidenceScores?: unknown;
  extractedAt?: Date | null;
};

function buildFieldsResponse(f: FieldsRow | null): Record<string, unknown> | null {
  if (!f) return null;
  const num = (v: unknown): number | null => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null);
  return {
    invoiceNumber: f.invoiceNumber ?? null,
    invoiceDate: f.invoiceDate ?? null,
    supplier: {
      name: f.supplierName ?? null,
      address: f.supplierAddress ?? null,
      eik: f.supplierEIK ?? null,
      vatNumber: f.supplierVatNumber ?? null,
    },
    client: {
      name: f.clientName ?? null,
      eik: f.clientEIK ?? null,
      vatNumber: f.clientVatNumber ?? null,
    },
    service: {
      description: f.serviceDescription ?? null,
      quantity: f.quantity ?? null,
      unitPrice: num(f.unitPrice),
      total: num(f.serviceTotal),
    },
    accountingAccount: f.accountingAccount ?? null,
    amounts: {
      netAmount: num(f.netAmount),
      vatAmount: num(f.vatAmount),
      totalAmount: num(f.totalAmount),
      currency: f.currency ?? null,
    },
    confidenceScores: f.confidenceScores ?? null,
    extractedAt: f.extractedAt ? f.extractedAt.toISOString() : null,
    supplierName: f.supplierName ?? null,
    supplierVatNumber: f.supplierVatNumber ?? null,
    currency: f.currency ?? null,
    netAmount: num(f.netAmount),
    vatAmount: num(f.vatAmount),
    totalAmount: num(f.totalAmount),
  };
}

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
    const organizationId = req.user?.organizationId ?? null;
    const userName = req.user?.email ?? null;
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Enforce subscription and monthly invoice limits
    try {
      await assertCanProcessInvoices(organizationId, files.length);
    } catch (err) {
      if (err instanceof UsageLimitError) {
        if (err.code === "SUBSCRIPTION_INACTIVE") {
          return res.status(402).json({
            error:
              "Your subscription is not active. Please update your plan to continue processing invoices.",
            code: err.code,
          });
        }
        if (err.code === "MONTHLY_LIMIT_REACHED") {
          return res.status(402).json({
            error: "The monthly invoice limit has been reached for your plan.",
            code: err.code,
          });
        }
        if (err.code === "TRIAL_EXPIRED") {
          return res.status(402).json({
            error: "Trial has ended. Subscribe to continue using the app.",
            code: err.code,
          });
        }
      }
      throw err;
    }
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

      if (organizationId && userId) {
        logActivity({
          organizationId,
          userId,
          userName,
          actionType: "INVOICE_UPLOADED",
          entityType: "INVOICE",
          entityId: invoice.id,
          entityName: invoice.filename,
          metadata: { mimeType: invoice.mimeType },
        });
      }

      // Fire-and-forget extraction; do not block upload response
      Promise.resolve().then(async () => {
        try {
          await extractAndPersistInvoiceForUser(invoice.id, req);
        } catch (err) {
          console.error("Auto-extract failed for invoice", invoice.id, err);
        }
      });
    }

    await incrementInvoicesUsed(organizationId, files.length);

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

async function extractAndPersistInvoiceForUser(
  invoiceId: string,
  req: Request
): Promise<ReturnType<typeof extractInvoice>> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  if (!canAccessInvoice(invoice, req)) {
    throw new Error("Invoice not found");
  }

  const fullPath = getUploadPath(invoice.filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error("File not found");
  }

  const extracted = await extractInvoice(invoiceId, fullPath, invoice.mimeType);
  const now = new Date();

  const fieldsCreate = {
    invoiceId,
    supplierName: extracted.supplierName,
    supplierVatNumber: extracted.supplierVatNumber,
    supplierAddress: extracted.supplierAddress,
    supplierEIK: extracted.supplierEIK,
    clientName: extracted.clientName,
    clientEIK: extracted.clientEIK,
    clientVatNumber: extracted.clientVatNumber,
    invoiceNumber: extracted.invoiceNumber,
    invoiceDate: extracted.invoiceDate,
    serviceDescription: extracted.serviceDescription,
    quantity: extracted.quantity,
    unitPrice: extracted.unitPrice,
    serviceTotal: extracted.serviceTotal,
    accountingAccount: extracted.accountingAccount,
    currency: extracted.currency,
    netAmount: extracted.netAmount,
    vatAmount: extracted.vatAmount,
    totalAmount: extracted.totalAmount,
    confidenceScores: extracted.confidenceScores,
    extractedAt: now,
  };
  const fieldsUpdate = { ...fieldsCreate };
  delete (fieldsUpdate as Record<string, unknown>).invoiceId;

  await prisma.invoiceFields.upsert({
    where: { invoiceId },
    create: fieldsCreate as unknown as Prisma.InvoiceFieldsCreateInput,
    update: fieldsUpdate as unknown as Prisma.InvoiceFieldsUpdateInput,
  });
  // Auto-approve based on high confidence, if enabled at organization level
  try {
    const organizationId = req.user?.organizationId ?? null;
    const userId = req.user?.id ?? null;
    const userName = req.user?.email ?? null;

    if (organizationId && userId && invoice.status === "pending") {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      const autoApproveHighConfidence =
        (org as { autoApproveHighConfidence?: boolean } | null)?.autoApproveHighConfidence ?? false;

      if (autoApproveHighConfidence) {
        const scores = extracted.confidenceScores ?? {};
        const values = Object.values(scores).filter((v) => typeof v === "number" && !Number.isNaN(v));
        if (values.length > 0) {
          const minScore = Math.min(...values);
          // Support both 0-1 and 0-100 scales
          const normalized = minScore > 1 ? minScore : minScore * 100;

          if (normalized >= 95) {
            await prisma.$transaction(async (tx) => {
              await tx.invoice.update({
                where: { id: invoiceId },
                data: { status: "approved" },
              });

              await tx.approval.create({
                data: {
                  invoiceId,
                  approvedBy: userName ?? "system",
                  action: "approved",
                },
              });
            });

            logActivity({
              organizationId,
              userId,
              userName,
              actionType: "INVOICE_APPROVED",
              entityType: "INVOICE",
              entityId: invoiceId,
              entityName: invoice.filename,
              metadata: {
                autoApproved: true,
                confidenceScores: extracted.confidenceScores,
              },
            });
          }
        }
      }
    }
  } catch (autoErr) {
    // Do not fail extraction if auto-approval logic encounters an error
    console.error("Auto-approve high confidence failed for invoice", invoiceId, autoErr);
  }

  return extracted;
}

/**
 * @openapi
 * /api/invoices/{id}/extract:
 *   post:
 *     summary: Extract data from an invoice file
 *     description: |
 *       Sends the invoice file to the external OCR service to extract text, then parses
 *       the text into structured fields (supplier, amounts, date, etc.). If the OCR
 *       service is unavailable, a fallback is used so the endpoint still returns data.
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
    const extracted = await extractAndPersistInvoiceForUser(id, req);
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
 *                 avgProcessingTimeSeconds: { type: number, nullable: true, description: 'Average seconds from invoice creation to extraction' }
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const baseWhere = (req.user ? { userId: req.user.id } : {}) as Prisma.InvoiceWhereInput;
    const [total, pending, approved, needsReview, invoicesWithExtraction] = await Promise.all([
      prisma.invoice.count({ where: baseWhere }),
      prisma.invoice.count({ where: { ...baseWhere, status: "pending" } }),
      prisma.invoice.count({ where: { ...baseWhere, status: "approved" } }),
      prisma.invoice.count({ where: { ...baseWhere, status: "needs_review" } }),
      prisma.invoice.findMany({
        where: { ...baseWhere, fields: { extractedAt: { not: null } } },
        select: { createdAt: true, fields: { select: { extractedAt: true } } },
      }),
    ]);

    let avgProcessingTimeSeconds: number | null = null;
    if (invoicesWithExtraction.length > 0) {
      const totalSeconds = invoicesWithExtraction.reduce((sum, inv) => {
        const ext = inv.fields?.extractedAt;
        if (!ext) return sum;
        return sum + (new Date(ext).getTime() - new Date(inv.createdAt).getTime()) / 1000;
      }, 0);
      avgProcessingTimeSeconds = totalSeconds / invoicesWithExtraction.length;
    }

    res.json({
      total,
      pending,
      approved,
      needs_review: needsReview,
      avgProcessingTimeSeconds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/tree:
 *   get:
 *     summary: Get folder tree and invoices for the current user
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Folder structure and invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 folders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       parentId: { type: string, nullable: true }
 *                       children: { type: array, items: { type: string } }
 *                       invoiceIds: { type: array, items: { type: string } }
 *                       createdAt: { type: string, format: date-time }
 *                 invoices:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/tree", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const dbFolders = await prisma.folder.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });

    const dbInvoices = await prisma.invoice.findMany({
      where: { ...(req.user && { userId: req.user.id }) },
      include: { fields: true, folder: true },
      orderBy: { createdAt: "asc" },
    });

    type FolderResponse = {
      id: string;
      name: string;
      parentId: string | null;
      children: string[];
      invoiceIds: string[];
      createdAt: string;
    };

    const foldersById: Record<string, FolderResponse> = {};

    // Synthetic root
    foldersById["root"] = {
      id: "root",
      name: "All Clients",
      parentId: null,
      children: [],
      invoiceIds: [],
      createdAt: new Date().toISOString(),
    };

    // Map DB folders
    for (const f of dbFolders) {
      foldersById[f.id] = {
        id: f.id,
        name: f.name,
        parentId: f.parentId ?? "root",
        children: [],
        invoiceIds: [],
        createdAt: f.createdAt.toISOString(),
      };
    }

    // Build children arrays
    for (const f of Object.values(foldersById)) {
      if (f.parentId && foldersById[f.parentId]) {
        foldersById[f.parentId].children.push(f.id);
      }
    }

    const invoicesResponse: Record<string, unknown> = {};

    const zeroScores = {
      supplierName: 0,
      vatNumber: 0,
      invoiceNumber: 0,
      invoiceDate: 0,
      currency: 0,
      netAmount: 0,
      vatAmount: 0,
      totalAmount: 0,
    };

    for (const inv of dbInvoices) {
      const fields = inv.fields;
      const folderId = inv.folderId ?? "root";

      const currency =
        fields?.currency && fields.currency.trim().length > 0 ? fields.currency : null;

      invoicesResponse[inv.id] = {
        id: inv.id,
        fileName: inv.filename,
        supplierName: fields?.supplierName ?? "",
        vatNumber: fields?.supplierVatNumber ?? "",
        invoiceNumber: fields?.invoiceNumber ?? "",
        invoiceDate: fields?.invoiceDate ?? "",
        currency,
        netAmount: fields?.netAmount != null ? Number(fields.netAmount) : 0,
        vatAmount: fields?.vatAmount != null ? Number(fields.vatAmount) : 0,
        totalAmount: fields?.totalAmount != null ? Number(fields.totalAmount) : 0,
        status: inv.status,
        uploadedAt: inv.createdAt.toISOString(),
        folderId,
        confidenceScores: (fields?.confidenceScores as Record<string, number> | null) ?? zeroScores,
        extractedAt: fields?.extractedAt ? fields.extractedAt.toISOString() : null,
      };

      if (foldersById[folderId]) {
        foldersById[folderId].invoiceIds.push(inv.id);
      } else {
        // Folder might not exist if folderId was cleared; attach to root
        foldersById["root"].invoiceIds.push(inv.id);
      }
    }

    // Sort invoiceIds in each folder by invoiceDate
    for (const folder of Object.values(foldersById)) {
      folder.invoiceIds.sort((a, b) => {
        const ia = invoicesResponse[a] as { invoiceDate?: string };
        const ib = invoicesResponse[b] as { invoiceDate?: string };
        const da = ia?.invoiceDate || "";
        const db = ib?.invoiceDate || "";
        return da.localeCompare(db);
      });
    }

    res.json({
      folders: Object.values(foldersById),
      invoices: invoicesResponse,
    });
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
 * /api/invoices/bulk-move:
 *   post:
 *     summary: Move multiple invoices to a folder
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceIds, targetFolderId]
 *             properties:
 *               invoiceIds:
 *                 type: array
 *                 items: { type: string }
 *               targetFolderId:
 *                 type: string
 *                 description: Folder id or 'root' for no folder
 *     responses:
 *       200:
 *         description: Invoices moved
 *       400:
 *         description: Invalid input or target folder
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/bulk-move", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as { invoiceIds?: string[]; targetFolderId?: string };
    const invoiceIds = Array.isArray(body.invoiceIds) ? body.invoiceIds.filter(Boolean) : [];
    if (invoiceIds.length === 0) {
      return res.status(400).json({ error: "invoiceIds must be a non-empty array" });
    }

    const rawTargetFolderId = body.targetFolderId;
    const newFolderId =
      rawTargetFolderId === "root" || rawTargetFolderId === undefined || rawTargetFolderId === null
        ? null
        : rawTargetFolderId;

    if (newFolderId) {
      const folder = await prisma.folder.findUnique({ where: { id: newFolderId } });
      if (!folder || folder.organizationId !== orgId) {
        return res.status(400).json({ error: "Invalid target folder" });
      }
    }

    // Only move invoices the current user can access
    const accessibleInvoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        ...(req.user && { userId: req.user.id }),
      } as Prisma.InvoiceWhereInput,
    });

    const accessibleIds = Array.from(new Set(accessibleInvoices.map((inv) => inv.id)));
    const accessibleSet = new Set(accessibleIds);
    const skippedIds = invoiceIds.filter((id) => !accessibleSet.has(id));

    if (accessibleIds.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: accessibleIds } },
        data: { folderId: newFolderId },
      });

      const organizationId = req.user?.organizationId ?? null;
      const userId = req.user?.id ?? "";
      const userName = req.user?.email ?? null;
      if (organizationId && userId) {
        const targetId = newFolderId ?? "root";
        for (const inv of accessibleInvoices) {
          logActivity({
            organizationId,
            userId,
            userName,
            actionType: "INVOICE_MOVED",
            entityType: "INVOICE",
            entityId: inv.id,
            entityName: inv.filename,
            metadata: { targetFolderId: targetId },
          });
        }
      }
    }

    res.json({
      targetFolderId: newFolderId ?? "root",
      movedIds: accessibleIds,
      skippedIds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/{id}/move:
 *   post:
 *     summary: Move an invoice to a folder
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
 *             required: [targetFolderId]
 *             properties:
 *               targetFolderId: { type: string, description: "Folder id or 'root' for no folder" }
 *     responses:
 *       200:
 *         description: Invoice moved
 *       400:
 *         description: Invalid target folder
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
router.post("/:id/move", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });

    const body = req.body as { targetFolderId?: string };
    const targetFolderId = body.targetFolderId;
    const orgId = req.user?.organizationId;

    const newFolderId =
      targetFolderId === "root" || targetFolderId === undefined || targetFolderId === null
        ? null
        : targetFolderId;

    if (newFolderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: newFolderId },
      });
      if (!folder || (orgId && folder.organizationId !== orgId)) {
        return res.status(400).json({ error: "Invalid target folder" });
      }
    }

    await prisma.invoice.update({
      where: { id },
      data: { folderId: newFolderId } as Prisma.InvoiceUpdateInput,
    });

    const organizationId = req.user?.organizationId ?? null;
    const userId = req.user?.id ?? "";
    const userName = req.user?.email ?? null;
    if (organizationId && userId) {
      logActivity({
        organizationId,
        userId,
        userName,
        actionType: "INVOICE_MOVED",
        entityType: "INVOICE",
        entityId: id,
        entityName: invoice.filename,
        metadata: { targetFolderId: newFolderId ?? "root" },
      });
    }

    res.json({ id, folderId: newFolderId ?? "root" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/{id}:
 *   delete:
 *     summary: Delete an invoice and its file
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
 *         description: Invoice deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invoice not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { fields: true, approvals: true },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });

    await prisma.$transaction([
      prisma.invoiceChatMessage.deleteMany({ where: { invoiceId: id } }),
      prisma.invoiceFields.deleteMany({ where: { invoiceId: id } }),
      prisma.approval.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.delete({ where: { id } }),
    ]);

    const fullPath = getUploadPath(invoice.filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (fileErr) {
        console.error("Failed to delete invoice file", fullPath, fileErr);
      }
    }

    const organizationId = req.user?.organizationId ?? null;
    const userId = req.user?.id ?? "";
    const userName = req.user?.email ?? null;
    if (organizationId && userId) {
      logActivity({
        organizationId,
        userId,
        userName,
        actionType: "INVOICE_DELETED",
        entityType: "INVOICE",
        entityId: id,
        entityName: invoice.filename,
      });
    }

    res.json({ id, deleted: true });
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

type ChatBody = { message: string; history?: InvoiceChatHistoryItem[] };

/**
 * @openapi
 * /api/invoices/{id}/chat:
 *   post:
 *     summary: Send a chat message about the invoice (PRO or enterprise with chat enabled)
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
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               history: { type: array, items: { type: object, properties: { role: { type: string }, content: { type: string } } } }
 *     responses:
 *       200:
 *         description: Assistant reply
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content: { type: string }
 *       404:
 *         description: Invoice not found
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Chat service unavailable
 *       500:
 *         description: Server error
 */
router.post("/:id/chat", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as ChatBody;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "message is required" });

    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionPlan: true },
    });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const STARTER_CHAT_USER_MESSAGE_LIMIT = 10;
    const PRO_CHAT_USER_MESSAGE_LIMIT = 25;

    if (org.subscriptionPlan === "starter" || org.subscriptionPlan === "pro") {
      const userMessageCount = await prisma.invoiceChatMessage.count({
        where: { invoiceId: id, role: "user" },
      });

      if (org.subscriptionPlan === "starter" && userMessageCount >= STARTER_CHAT_USER_MESSAGE_LIMIT) {
        return res.status(403).json({
          error:
            "Starter plan limit reached (10 questions per invoice). Upgrade to Pro for more chat messages and generic accounting help.",
        });
      }

      if (org.subscriptionPlan === "pro" && userMessageCount >= PRO_CHAT_USER_MESSAGE_LIMIT) {
        return res.status(403).json({
          error: "Pro plan limit reached (25 questions per invoice).",
        });
      }
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { fields: true },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });

    const extraction = buildFieldsResponse(invoice.fields as FieldsRow | null) ?? {};
    const history: InvoiceChatHistoryItem[] = Array.isArray(body.history)
      ? body.history.filter(
          (h): h is InvoiceChatHistoryItem =>
            h && typeof h === "object" && (h.role === "user" || h.role === "assistant") && typeof (h as InvoiceChatHistoryItem).content === "string"
        )
      : [];

    const content = await invoiceChat(extraction, message, history, org.subscriptionPlan as "starter" | "pro" | "enterprise");

    await prisma.invoiceChatMessage.createMany({
      data: [
        { invoiceId: id, role: "user", content: message },
        { invoiceId: id, role: "assistant", content },
      ],
    });

    res.json({ content });
  } catch (err) {
    const status = (err as { response?: { status: number } })?.response?.status;
    if (status === 503) return res.status(503).json({ error: "Chat service is temporarily unavailable." });
    if (status === 404) {
      return res.status(503).json({
        error: "Invoice chat is not available. Restart the OCR service (uvicorn) to load the chat endpoint.",
      });
    }
    console.error("Invoice chat failed:", err);
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
      include: {
        fields: true,
        approvals: { orderBy: { approvedAt: "desc" }, take: 10 },
        chatMessages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!canAccessInvoice(invoice, req)) return res.status(404).json({ error: "Invoice not found" });

    const fileUrl = `/api/invoices/${invoice.id}/file`;
    const fields = buildFieldsResponse(invoice.fields as FieldsRow | null);

    res.json({
      id: invoice.id,
      filename: invoice.filename,
      mimeType: invoice.mimeType,
      status: invoice.status,
      createdAt: invoice.createdAt,
      fileUrl,
      fields,
      approvals: invoice.approvals.map((a) => ({
        approvedBy: a.approvedBy,
        approvedAt: a.approvedAt,
        action: a.action,
      })),
      chatMessages: invoice.chatMessages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: m.createdAt.toISOString(),
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
    if (body.supplierAddress !== undefined) data.supplierAddress = body.supplierAddress;
    if (body.supplierEIK !== undefined) data.supplierEIK = body.supplierEIK;
    if (body.clientName !== undefined) data.clientName = body.clientName;
    if (body.clientEIK !== undefined) data.clientEIK = body.clientEIK;
    if (body.clientVatNumber !== undefined) data.clientVatNumber = body.clientVatNumber;
    if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber;
    if (body.invoiceDate !== undefined) data.invoiceDate = body.invoiceDate;
    if (body.serviceDescription !== undefined) data.serviceDescription = body.serviceDescription;
    if (body.quantity !== undefined) data.quantity = body.quantity;
    if (body.unitPrice !== undefined) data.unitPrice = body.unitPrice;
    if (body.serviceTotal !== undefined) data.serviceTotal = body.serviceTotal;
    if (body.accountingAccount !== undefined) data.accountingAccount = body.accountingAccount;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.netAmount !== undefined) data.netAmount = body.netAmount;
    if (body.vatAmount !== undefined) data.vatAmount = body.vatAmount;
    if (body.totalAmount !== undefined) data.totalAmount = body.totalAmount;

    const updated = await prisma.invoiceFields.upsert({
      where: { invoiceId: id },
      create: { invoiceId: id, ...data },
      update: data,
    });

    const response = buildFieldsResponse(updated as FieldsRow);
    res.json(response ?? {});
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

    const organizationId = req.user?.organizationId ?? null;
    const userId = req.user?.id ?? "";
    const userName = req.user?.email ?? null;
    if (organizationId && userId && action === "approved") {
      logActivity({
        organizationId,
        userId,
        userName,
        actionType: "INVOICE_APPROVED",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityName: invoice.filename,
        metadata: { action },
      });
      // Send approval email notification if enabled (non-blocking)
      const approverEmail = req.user?.email;
      if (approverEmail) {
        const filename = invoice.filename;
        const approvedByStr = approvedBy;
        setImmediate(() => {
          prisma.organization
            .findUnique({
              where: { id: organizationId },
              select: { emailNotificationsOnApproval: true },
            })
            .then((org) => {
              const sendNotification =
                (org as { emailNotificationsOnApproval?: boolean } | null)?.emailNotificationsOnApproval ?? true;
              if (sendNotification) {
                return sendInvoiceApprovedNotification(approverEmail, filename, approvedByStr);
              }
            })
            .catch((err) => console.error("Approval notification email failed:", err));
        });
      }
    }

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

type ExportColumnConfigResponse = {
  key: ExportColumnKey;
  defaultLabel: string;
  currentLabel: string;
};

/**
 * @openapi
 * /api/invoices/config/export:
 *   get:
 *     summary: Get Excel export column configuration for the current user
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of columns with default and current labels
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/config/export", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = (await prisma.user.findUnique({
      where: { id: userId },
    })) as unknown as { excelExportColumnLabels?: unknown } | null;

    const overrides = (user?.excelExportColumnLabels ?? null) as ExportColumnLabelsOverride | null;
    const hasConfig =
      overrides != null &&
      typeof overrides === "object" &&
      Object.keys(overrides as Record<string, unknown>).length > 0;
    const labels: ExportColumnConfigResponse[] = EXPORT_COLUMNS.map((col) => {
      const raw = overrides?.[col.key];
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      return {
        key: col.key,
        defaultLabel: col.defaultLabel,
        currentLabel: trimmed.length > 0 ? trimmed : col.defaultLabel,
      };
    });

    res.json({ columns: labels, hasConfig });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/invoices/config/export:
 *   put:
 *     summary: Update Excel export column labels for the current user
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               labels:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Map of column key to label
 *     responses:
 *       200:
 *         description: Configuration saved
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/config/export", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as { labels?: Record<string, unknown> };
    const rawLabels = body.labels;
    if (!rawLabels || typeof rawLabels !== "object") {
      return res.status(400).json({ error: "labels object is required" });
    }

    const allowedKeys = new Set<ExportColumnKey>(EXPORT_COLUMNS.map((c) => c.key));
    const sanitized: ExportColumnLabelsOverride = {};

    for (const [key, value] of Object.entries(rawLabels)) {
      if (!allowedKeys.has(key as ExportColumnKey)) continue;
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      sanitized[key as ExportColumnKey] = trimmed;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        excelExportColumnLabels: sanitized as unknown as Prisma.JsonValue,
      } as Prisma.UserUpdateInput,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

type ExportScope = "selected" | "folder";

type ExportRequestBody =
  | {
      scope: "selected";
      invoiceIds: string[];
      onlyConfirmed?: boolean;
    }
  | {
      scope: "folder";
      folderIds: string[];
      includeSubfolders?: boolean;
      onlyConfirmed?: boolean;
    };

/**
 * @openapi
 * /api/invoices/export:
 *   post:
 *     summary: Export approved invoices with extracted data to Excel
 *     description: |
 *       Generates an Excel file (.xlsx) from confirmed invoices (status=approved) that have
 *       extracted fields. You can export either a specific selection of invoices or all
 *       invoices in one or more folders.
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   scope:
 *                     type: string
 *                     enum: [selected]
 *                   invoiceIds:
 *                     type: array
 *                     items: { type: string }
 *                   onlyConfirmed:
 *                     type: boolean
 *                     description: "When true, only approved invoices are exported (default: true)"
 *                 required: [scope, invoiceIds]
 *               - type: object
 *                 properties:
 *                   scope:
 *                     type: string
 *                     enum: [folder]
 *                   folderIds:
 *                     type: array
 *                     items: { type: string }
 *                   includeSubfolders:
 *                     type: boolean
 *                     description: Whether to include invoices from descendant folders
 *                   onlyConfirmed:
 *                     type: boolean
 *                     description: "When true, only approved invoices are exported (default: true)"
 *                 required: [scope, folderIds]
 *     responses:
 *       200:
 *         description: Excel file containing exported invoices
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid input or no invoices to export
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/export", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as ExportRequestBody;
    const scope = body.scope as ExportScope | undefined;

    if (!scope || (scope !== "selected" && scope !== "folder")) {
      return res.status(400).json({ error: "scope must be 'selected' or 'folder'" });
    }

    const onlyConfirmed = body.onlyConfirmed !== false;

    let candidateInvoiceIds: string[] = [];

    if (scope === "selected") {
      const selectedBody = body as Extract<ExportRequestBody, { scope: "selected" }>;
      const invoiceIds = Array.isArray(selectedBody.invoiceIds)
        ? selectedBody.invoiceIds.filter(Boolean)
        : [];
      if (invoiceIds.length === 0) {
        return res.status(400).json({ error: "invoiceIds must be a non-empty array" });
      }
      candidateInvoiceIds = Array.from(new Set(invoiceIds));
    } else {
      const folderBody = body as Extract<ExportRequestBody, { scope: "folder" }>;
      const folderIds = Array.isArray(folderBody.folderIds)
        ? folderBody.folderIds.filter(Boolean)
        : [];
      if (folderIds.length === 0) {
        return res.status(400).json({ error: "folderIds must be a non-empty array" });
      }

      const includeSubfolders = folderBody.includeSubfolders !== false;

      // Load all folders for the organization so we can resolve descendants
      const dbFolders = await prisma.folder.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "asc" },
      });

      const childrenByParent: Record<string, string[]> = {};
      for (const f of dbFolders) {
        const parentId = f.parentId ?? "root";
        if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
        childrenByParent[parentId].push(f.id);
      }

      const resolvedFolderIds = new Set<string>();
      let includeRootInvoices = false;

      const addFolderWithDescendants = (startId: string) => {
        if (startId === "root") {
          includeRootInvoices = true;
          if (!includeSubfolders) {
            return;
          }
          // For root + subfolders, include all real folders below root
          Object.assign(
            resolvedFolderIds,
            dbFolders.reduce((acc, f) => {
              acc[f.id] = true;
              return acc;
            }, {} as Record<string, boolean>)
          );
          return;
        }

        const stack: string[] = [startId];
        while (stack.length > 0) {
          const current = stack.pop() as string;
          if (resolvedFolderIds.has(current)) continue;
          resolvedFolderIds.add(current);
          if (includeSubfolders && childrenByParent[current]) {
            for (const childId of childrenByParent[current]) {
              if (!resolvedFolderIds.has(childId)) {
                stack.push(childId);
              }
            }
          }
        }
      };

      for (const id of folderIds) {
        addFolderWithDescendants(id);
      }

      const folderIdList = Array.from(resolvedFolderIds);

      const whereFolder: Prisma.InvoiceWhereInput = {
        ...(includeRootInvoices
          ? {
              OR: [
                { folderId: null },
                ...(folderIdList.length > 0 ? [{ folderId: { in: folderIdList } }] : []),
              ],
            }
          : folderIdList.length > 0
          ? { folderId: { in: folderIdList } }
          : { folderId: null }),
        userId,
      };

      const invoicesInFolders = await prisma.invoice.findMany({
        where: whereFolder,
        select: { id: true },
      });
      candidateInvoiceIds = invoicesInFolders.map((inv) => inv.id);
    }

    if (candidateInvoiceIds.length === 0) {
      return res.status(400).json({ error: "No invoices found for export" });
    }

    const where: Prisma.InvoiceWhereInput = {
      id: { in: candidateInvoiceIds },
      ...(onlyConfirmed ? { status: "approved" } : {}),
      userId,
    };

    const invoicesForExport = await prisma.invoice.findMany({
      where,
      include: { fields: true },
      orderBy: { createdAt: "asc" },
    });

    const filtered = invoicesForExport.filter((inv) => inv.fields && inv.fields.extractedAt);

    if (filtered.length === 0) {
      return res.status(400).json({
        error: "There are no invoices to export. Only approved invoices with completed data extraction can be exported.",
      });
    }

    const user = (await prisma.user.findUnique({
      where: { id: userId },
    })) as unknown as { excelExportColumnLabels?: unknown } | null;
    const overrides = (user?.excelExportColumnLabels ?? null) as ExportColumnLabelsOverride | null;
    const mergedColumns = mergeExportColumnLabels(overrides);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Invoices");

    worksheet.columns = mergedColumns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));

    worksheet.getRow(1).font = { bold: true };

    for (const inv of filtered) {
      const f = inv.fields as unknown as FieldsRow | null;
      worksheet.addRow({
        id: inv.id,
        fileName: inv.filename,
        invoiceNumber: f?.invoiceNumber ?? null,
        invoiceDate: f?.invoiceDate ?? null,
        supplierName: f?.supplierName ?? null,
        supplierVatNumber: f?.supplierVatNumber ?? null,
        supplierAddress: f?.supplierAddress ?? null,
        supplierEIK: f?.supplierEIK ?? null,
        clientName: f?.clientName ?? null,
        clientEIK: f?.clientEIK ?? null,
        clientVatNumber: f?.clientVatNumber ?? null,
        currency: f?.currency ?? null,
        netAmount: f?.netAmount != null ? Number(f.netAmount) : null,
        vatAmount: f?.vatAmount != null ? Number(f.vatAmount) : null,
        totalAmount: f?.totalAmount != null ? Number(f.totalAmount) : null,
        status: inv.status,
        extractedAt: f?.extractedAt ? f.extractedAt.toISOString() : null,
        uploadedAt: inv.createdAt.toISOString(),
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoices-${dateStr}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
