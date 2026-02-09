import prisma from "../db/index.js";

/**
 * Ensure a folder exists for the given supplier and invoice date, and return its id.
 *
 * Rules:
 * - Top-level folder per supplierName (parentId = null, per organization).
 * - Optional year folder (e.g. "2025") under the supplier folder based on invoiceDate (YYYY-MM-DD).
 */
export async function ensureFolderForInvoice(params: {
  organizationId: string;
  supplierName: string | null;
  invoiceDate: string | null;
}): Promise<string | null> {
  const { organizationId, supplierName, invoiceDate } = params;

  if (!supplierName || !supplierName.trim()) {
    // If supplier is unknown, we currently don't group into folders.
    return null;
  }

  const cleanName = supplierName.trim();

  // 1) Supplier folder at top level for this organization
  let supplierFolder = await prisma.folder.findFirst({
    where: { organizationId, parentId: null, name: cleanName },
  });
  if (!supplierFolder) {
    supplierFolder = await prisma.folder.create({
      data: { organizationId, parentId: null, name: cleanName },
    });
  }

  // 2) Year folder under supplier, based on invoiceDate (YYYY-MM-DD)
  if (!invoiceDate) {
    return supplierFolder.id;
  }

  const year = invoiceDate.slice(0, 4);
  if (!/^\d{4}$/.test(year)) {
    return supplierFolder.id;
  }

  const yearFolder = await prisma.folder.upsert({
    where: {
      organizationId_parentId_name: {
        organizationId,
        parentId: supplierFolder.id,
        name: year,
      },
    },
    update: {},
    create: {
      organizationId,
      parentId: supplierFolder.id,
      name: year,
    },
  });

  return yearFolder.id;
}

