import { Router, Request, Response } from "express";
import fs from "fs";
import prisma from "../db/index.js";
import { getUploadPath } from "../middleware/upload.js";
import { logActivity } from "../services/activityLogger.js";

const router = Router();

/**
 * @openapi
 * /api/folders:
 *   post:
 *     summary: Create a new folder
 *     tags:
 *       - Folders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               parentId: { type: string, nullable: true, description: "Use null or 'root' for top-level" }
 *     responses:
 *       200:
 *         description: Created folder
 *       400:
 *         description: Missing name or invalid parent
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as { name?: string; parentId?: string | null };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const rawParentId = body.parentId;
    const parentId =
      rawParentId === "root" || rawParentId === undefined || rawParentId === null
        ? null
        : rawParentId;

    if (parentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: parentId },
      });
      if (!parent || parent.organizationId !== orgId) {
        return res.status(400).json({ error: "Invalid parent folder" });
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        organizationId: orgId,
        parentId,
      },
    });

    if (req.user?.id) {
      logActivity({
        organizationId: orgId,
        userId: req.user.id,
        userName: req.user.email,
        actionType: "FOLDER_CREATED",
        entityType: "FOLDER",
        entityId: folder.id,
        entityName: folder.name,
      });
    }

    res.status(201).json({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId ?? "root",
      children: [],
      invoiceIds: [],
      createdAt: folder.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/folders/{id}:
 *   patch:
 *     summary: Rename a folder
 *     tags:
 *       - Folders
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Updated folder
 *       400:
 *         description: Missing name
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const body = req.body as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const folder = await prisma.folder.findUnique({
      where: { id },
    });
    if (!folder || folder.organizationId !== orgId) {
      return res.status(404).json({ error: "Folder not found" });
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { name },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId ?? "root",
      children: [],
      invoiceIds: [],
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @openapi
 * /api/folders/{id}:
 *   delete:
 *     summary: Delete a folder and all invoices within it (including subfolders)
 *     tags:
 *       - Folders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Folder and its invoices deleted
 *       400:
 *         description: Invalid folder
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    // Root is synthetic and cannot be deleted
    if (id === "root") {
      return res.status(400).json({ error: "Cannot delete root folder" });
    }

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.organizationId !== orgId) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Fetch all folders in the organization to compute the subtree
    const allFolders = await prisma.folder.findMany({
      where: { organizationId: orgId },
    });

    const childrenByParent: Record<string, string[]> = {};
    for (const f of allFolders) {
      const parentId = f.parentId ?? "root_internal_null";
      if (!childrenByParent[parentId]) {
        childrenByParent[parentId] = [];
      }
      childrenByParent[parentId].push(f.id);
    }

    const subtreeIds = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (subtreeIds.has(current)) continue;
      subtreeIds.add(current);
      const children = childrenByParent[current] || [];
      for (const childId of children) {
        if (!subtreeIds.has(childId)) {
          stack.push(childId);
        }
      }
    }

    const folderIds = Array.from(subtreeIds);

    // Find all invoices in these folders (org-level visibility)
    const invoices = await prisma.invoice.findMany({
      where: {
        folderId: { in: folderIds },
        organizationId: orgId,
      },
    });

    const invoiceIds = invoices.map((inv) => inv.id);

    // Delete related DB records in a transaction
    await prisma.$transaction([
      prisma.invoiceChatMessage.deleteMany({ where: { invoiceId: { in: invoiceIds } } }),
      prisma.invoiceFields.deleteMany({ where: { invoiceId: { in: invoiceIds } } }),
      prisma.approval.deleteMany({ where: { invoiceId: { in: invoiceIds } } }),
      prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } }),
      prisma.folder.deleteMany({ where: { id: { in: folderIds } } }),
    ]);

    // Delete files from disk (best-effort)
    for (const inv of invoices) {
      const fullPath = getUploadPath(inv.filePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.error("Failed to delete invoice file", fullPath, err);
        }
      }
    }

    const userId = req.user?.id ?? "";
    const userName = req.user?.email ?? null;
    if (orgId && userId) {
      logActivity({
        organizationId: orgId,
        userId,
        userName,
        actionType: "FOLDER_DELETED",
        entityType: "FOLDER",
        entityId: id,
        entityName: folder.name,
        metadata: { deletedFolderIds: folderIds, deletedInvoiceIds: invoiceIds },
      });
    }

    res.json({
      deletedFolderIds: folderIds,
      deletedInvoiceIds: invoiceIds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
