export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
  invoiceIds: string[];
  createdAt: string;
}

export interface FolderInvoice {
  id: string;
  fileName: string;
  supplierName: string;
  vatNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  status: 'pending' | 'needs_review' | 'approved';
  uploadedAt: string;
  folderId: string;
  confidenceScores: {
    supplierName: number;
    vatNumber: number;
    invoiceNumber: number;
    invoiceDate: number;
    currency: number;
    netAmount: number;
    vatAmount: number;
    totalAmount: number;
  };
}

export const mockFolders: Record<string, Folder> = {
  'root': {
    id: 'root',
    name: 'All Clients',
    parentId: null,
    children: ['client-acme', 'client-globex', 'client-techsol', 'client-office'],
    invoiceIds: [],
    createdAt: '2024-01-01T00:00:00Z',
  },
  'client-acme': {
    id: 'client-acme',
    name: 'Acme Corporation',
    parentId: 'root',
    children: ['acme-2024', 'acme-2023'],
    invoiceIds: [],
    createdAt: '2024-01-05T00:00:00Z',
  },
  'acme-2024': {
    id: 'acme-2024',
    name: '2024',
    parentId: 'client-acme',
    children: ['acme-2024-q1'],
    invoiceIds: ['inv-001'],
    createdAt: '2024-01-10T00:00:00Z',
  },
  'acme-2024-q1': {
    id: 'acme-2024-q1',
    name: 'Q1',
    parentId: 'acme-2024',
    children: [],
    invoiceIds: [],
    createdAt: '2024-01-15T00:00:00Z',
  },
  'acme-2023': {
    id: 'acme-2023',
    name: '2023',
    parentId: 'client-acme',
    children: [],
    invoiceIds: [],
    createdAt: '2023-01-10T00:00:00Z',
  },
  'client-globex': {
    id: 'client-globex',
    name: 'Globex Services Ltd',
    parentId: 'root',
    children: [],
    invoiceIds: ['inv-002'],
    createdAt: '2024-01-08T00:00:00Z',
  },
  'client-techsol': {
    id: 'client-techsol',
    name: 'TechSolutions Inc',
    parentId: 'root',
    children: ['techsol-2023'],
    invoiceIds: [],
    createdAt: '2024-01-03T00:00:00Z',
  },
  'techsol-2023': {
    id: 'techsol-2023',
    name: '2023',
    parentId: 'client-techsol',
    children: [],
    invoiceIds: ['inv-003'],
    createdAt: '2023-12-01T00:00:00Z',
  },
  'client-office': {
    id: 'client-office',
    name: 'Office Plus GmbH',
    parentId: 'root',
    children: [],
    invoiceIds: ['inv-004', 'inv-005'],
    createdAt: '2024-01-12T00:00:00Z',
  },
};

export const mockFolderInvoices: Record<string, FolderInvoice> = {
  'inv-001': {
    id: 'inv-001',
    fileName: 'invoice_acme_corp_2024.pdf',
    supplierName: 'Acme Corporation',
    vatNumber: 'DE123456789',
    invoiceNumber: 'INV-2024-0892',
    invoiceDate: '2024-01-15',
    currency: 'EUR',
    netAmount: 4500.00,
    vatAmount: 855.00,
    totalAmount: 5355.00,
    status: 'pending',
    uploadedAt: '2024-01-20T10:30:00Z',
    folderId: 'acme-2024',
    confidenceScores: {
      supplierName: 0.98,
      vatNumber: 0.95,
      invoiceNumber: 0.99,
      invoiceDate: 0.97,
      currency: 1.0,
      netAmount: 0.92,
      vatAmount: 0.88,
      totalAmount: 0.94,
    },
  },
  'inv-002': {
    id: 'inv-002',
    fileName: 'globex_services_jan.pdf',
    supplierName: 'Globex Services Ltd',
    vatNumber: 'GB987654321',
    invoiceNumber: 'GS-2024-0156',
    invoiceDate: '2024-01-18',
    currency: 'GBP',
    netAmount: 2800.00,
    vatAmount: 560.00,
    totalAmount: 3360.00,
    status: 'needs_review',
    uploadedAt: '2024-01-19T14:15:00Z',
    folderId: 'client-globex',
    confidenceScores: {
      supplierName: 0.85,
      vatNumber: 0.72,
      invoiceNumber: 0.96,
      invoiceDate: 0.91,
      currency: 0.99,
      netAmount: 0.78,
      vatAmount: 0.65,
      totalAmount: 0.82,
    },
  },
  'inv-003': {
    id: 'inv-003',
    fileName: 'tech_solutions_december.pdf',
    supplierName: 'TechSolutions Inc',
    vatNumber: 'US12-3456789',
    invoiceNumber: 'TS-2023-4521',
    invoiceDate: '2023-12-28',
    currency: 'USD',
    netAmount: 12500.00,
    vatAmount: 0,
    totalAmount: 12500.00,
    status: 'approved',
    uploadedAt: '2024-01-05T09:00:00Z',
    folderId: 'techsol-2023',
    confidenceScores: {
      supplierName: 0.99,
      vatNumber: 0.97,
      invoiceNumber: 0.98,
      invoiceDate: 0.99,
      currency: 1.0,
      netAmount: 0.99,
      vatAmount: 1.0,
      totalAmount: 0.99,
    },
  },
  'inv-004': {
    id: 'inv-004',
    fileName: 'office_supplies_q1.pdf',
    supplierName: 'Office Plus GmbH',
    vatNumber: 'DE567890123',
    invoiceNumber: 'OP-2024-0034',
    invoiceDate: '2024-01-22',
    currency: 'EUR',
    netAmount: 890.50,
    vatAmount: 169.20,
    totalAmount: 1059.70,
    status: 'pending',
    uploadedAt: '2024-01-22T16:45:00Z',
    folderId: 'client-office',
    confidenceScores: {
      supplierName: 0.94,
      vatNumber: 0.91,
      invoiceNumber: 0.97,
      invoiceDate: 0.96,
      currency: 1.0,
      netAmount: 0.89,
      vatAmount: 0.87,
      totalAmount: 0.93,
    },
  },
  'inv-005': {
    id: 'inv-005',
    fileName: 'cloud_hosting_jan.pdf',
    supplierName: 'CloudHost Pro',
    vatNumber: 'IE1234567T',
    invoiceNumber: 'CHP-2024-789',
    invoiceDate: '2024-01-01',
    currency: 'EUR',
    netAmount: 1200.00,
    vatAmount: 276.00,
    totalAmount: 1476.00,
    status: 'approved',
    uploadedAt: '2024-01-02T08:00:00Z',
    folderId: 'client-office',
    confidenceScores: {
      supplierName: 0.99,
      vatNumber: 0.98,
      invoiceNumber: 0.99,
      invoiceDate: 1.0,
      currency: 1.0,
      netAmount: 0.99,
      vatAmount: 0.98,
      totalAmount: 0.99,
    },
  },
};

// Helper function to get folder path (for breadcrumbs)
export const getFolderPath = (folderId: string, folders: Record<string, Folder>): Folder[] => {
  const path: Folder[] = [];
  let currentId: string | null = folderId;
  
  while (currentId) {
    const folder = folders[currentId];
    if (folder) {
      path.unshift(folder);
      currentId = folder.parentId;
    } else {
      break;
    }
  }
  
  return path;
};

// Helper function to count invoices recursively
export const countInvoicesInFolder = (
  folderId: string,
  folders: Record<string, Folder>
): number => {
  const folder = folders[folderId];
  if (!folder) return 0;
  
  let count = folder.invoiceIds.length;
  
  for (const childId of folder.children) {
    count += countInvoicesInFolder(childId, folders);
  }
  
  return count;
};

// Helper function to get all invoices in folder and subfolders
export const getInvoicesInFolder = (
  folderId: string,
  folders: Record<string, Folder>,
  invoices: Record<string, FolderInvoice>,
  includeSubfolders: boolean = false
): FolderInvoice[] => {
  const folder = folders[folderId];
  if (!folder) return [];
  
  const result: FolderInvoice[] = folder.invoiceIds
    .map(id => invoices[id])
    .filter(Boolean);
  
  if (includeSubfolders) {
    for (const childId of folder.children) {
      result.push(...getInvoicesInFolder(childId, folders, invoices, true));
    }
  }
  
  return result;
};
