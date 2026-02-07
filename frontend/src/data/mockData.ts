export interface Invoice {
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  avatar?: string;
}

export const mockInvoices: Invoice[] = [
  {
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
  {
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
  {
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
  {
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
  {
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
];

export const mockChatHistory: Record<string, ChatMessage[]> = {
  'inv-001': [
    {
      id: 'msg-1',
      role: 'user',
      content: 'What is the VAT amount on this invoice?',
      timestamp: '2024-01-20T10:35:00Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'The VAT amount on this invoice is €855.00. This is calculated at 19% of the net amount of €4,500.00.',
      timestamp: '2024-01-20T10:35:05Z',
    },
  ],
  'inv-002': [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Check if the totals are correct',
      timestamp: '2024-01-19T14:20:00Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I\'ve verified the totals: Net Amount (£2,800.00) + VAT (£560.00 at 20%) = Total (£3,360.00). The calculation is correct.',
      timestamp: '2024-01-19T14:20:08Z',
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'Are there any missing fields?',
      timestamp: '2024-01-19T14:22:00Z',
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'I noticed the VAT number has a low confidence score (72%). The extracted value "GB987654321" may need verification. All other required fields are present.',
      timestamp: '2024-01-19T14:22:12Z',
    },
  ],
};

export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'John Smith',
    email: 'john.smith@company.com',
    role: 'admin',
  },
  {
    id: 'user-2',
    name: 'Sarah Johnson',
    email: 'sarah.j@company.com',
    role: 'user',
  },
  {
    id: 'user-3',
    name: 'Michael Chen',
    email: 'm.chen@company.com',
    role: 'user',
  },
];

export const mockDashboardStats = {
  invoicesProcessed: 247,
  pendingApprovals: 12,
  approvedInvoices: 235,
  subscriptionPlan: 'Pro',
};

export const mockRecentActivity = [
  {
    id: 'act-1',
    action: 'Invoice uploaded',
    description: 'invoice_acme_corp_2024.pdf was uploaded',
    timestamp: '2024-01-22T16:45:00Z',
    user: 'John Smith',
  },
  {
    id: 'act-2',
    action: 'Invoice approved',
    description: 'TS-2023-4521 was approved',
    timestamp: '2024-01-22T15:30:00Z',
    user: 'Sarah Johnson',
  },
  {
    id: 'act-3',
    action: 'Data updated',
    description: 'VAT number corrected on GS-2024-0156',
    timestamp: '2024-01-22T14:15:00Z',
    user: 'John Smith',
  },
  {
    id: 'act-4',
    action: 'Invoice uploaded',
    description: 'cloud_hosting_jan.pdf was uploaded',
    timestamp: '2024-01-22T08:00:00Z',
    user: 'Michael Chen',
  },
  {
    id: 'act-5',
    action: 'Chat query',
    description: 'Question asked on invoice INV-2024-0892',
    timestamp: '2024-01-21T10:35:00Z',
    user: 'John Smith',
  },
];

export const mockUsageData = {
  currentPlan: 'Pro',
  documentsProcessed: 247,
  documentsLimit: 500,
  billingCycle: 'Monthly',
  nextBillingDate: '2024-02-15',
  monthlyPrice: 99,
};

export const pricingPlans = [
  {
    name: 'Starter',
    price: 29,
    period: 'month',
    description: 'Perfect for small businesses getting started',
    features: [
      '100 invoices/month',
      'AI data extraction',
      'Basic chat assistance',
      'Email support',
      '1 user',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 99,
    period: 'month',
    description: 'For growing teams with higher volume',
    features: [
      '500 invoices/month',
      'Advanced AI extraction',
      'Full chat capabilities',
      'Priority support',
      '5 users',
      'Audit trail',
      'API access',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: null,
    period: null,
    description: 'Custom solutions for large organizations',
    features: [
      'Unlimited invoices',
      'Custom AI training',
      'Dedicated account manager',
      '24/7 phone support',
      'Unlimited users',
      'SSO & advanced security',
      'Custom integrations',
      'SLA guarantee',
    ],
    highlighted: false,
  },
];
