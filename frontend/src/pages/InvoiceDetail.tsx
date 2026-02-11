import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  TextField,
  Chip,
  Paper,
  Divider,
  Avatar,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as ApproveIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Save as SaveIcon,
  SmartToy as AIIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/api/client';

/** GET /api/invoices/:id response shape (expanded + flat for backward compat) */
export interface InvoiceDetailApi {
  id: string;
  filename: string;
  mimeType?: string;
  status: string;
  createdAt: string;
  fileUrl: string;
  fields: {
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    supplier?: { name?: string | null; address?: string | null; eik?: string | null; vatNumber?: string | null } | null;
    client?: { name?: string | null; eik?: string | null; vatNumber?: string | null } | null;
    service?: { description?: string | null; quantity?: string | null; unitPrice?: number | null; total?: number | null } | null;
    accountingAccount?: string | null;
    amounts?: { netAmount?: number | null; vatAmount?: number | null; totalAmount?: number | null; currency?: string | null } | null;
    confidenceScores?: Record<string, number> | null;
    extractedAt?: string | null;
    supplierName?: string | null;
    supplierVatNumber?: string | null;
    currency?: string | null;
    netAmount?: number | null;
    vatAmount?: number | null;
    totalAmount?: number | null;
  } | null;
  approvals: { approvedBy: string; approvedAt: string; action: string }[];
  chatMessages?: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }[];
}

/** Normalize confidence score to 0-1 (API may return 0-100) */
function normalizeScore(v: number | undefined | null): number {
  if (v == null || Number.isNaN(v)) return 0;
  return v > 1 ? v / 100 : v;
}

/** Get confidence score; supports flat (supplierName) and dotted (supplier.name) keys */
function getScore(scores: Record<string, number>, flatKey: string, dottedKey?: string): number {
  const v = scores[flatKey] ?? (dottedKey ? scores[dottedKey] : undefined);
  return normalizeScore(v);
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index} style={{ flex: 1, minHeight: 0, display: value === index ? 'flex' : 'none', flexDirection: 'column' }}>
    {value === index && (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </Box>
    )}
  </div>
);

const LOW_CONFIDENCE_THRESHOLD = 0.7;

const ConfidenceIndicator: React.FC<{ score: number; lowHighlight?: boolean }> = ({ score, lowHighlight }) => {
  const { t } = useTranslation();
  const getColor = () => {
    if (score >= 0.9) return 'success';
    if (score >= LOW_CONFIDENCE_THRESHOLD) return 'warning';
    return 'error';
  };

  const getLabel = () => {
    if (score >= 0.9) return t('invoiceDetail.confidenceHigh');
    if (score >= LOW_CONFIDENCE_THRESHOLD) return t('invoiceDetail.confidenceMedium');
    return t('invoiceDetail.confidenceLow');
  };

  const isLow = score < LOW_CONFIDENCE_THRESHOLD;

  return (
    <Tooltip title={t('invoiceDetail.confidencePct', { pct: (score * 100).toFixed(0) })}>
      <Chip
        label={getLabel()}
        color={getColor()}
        size="small"
        variant="outlined"
        sx={{
          fontSize: '0.7rem',
          height: 20,
          ...(lowHighlight && isLow && { borderWidth: 2, borderColor: 'error.main' }),
        }}
      />
    </Tooltip>
  );
};

const defaultFormData = {
  supplierName: '',
  supplierAddress: '',
  supplierEIK: '',
  vatNumber: '',
  clientName: '',
  clientEIK: '',
  clientVatNumber: '',
  invoiceNumber: '',
  invoiceDate: '',
  serviceDescription: '',
  quantity: '',
  unitPrice: 0,
  serviceTotal: 0,
  currency: '',
  netAmount: 0,
  vatAmount: 0,
  totalAmount: 0,
};

const defaultScores: Record<string, number> = {
  supplierName: 0,
  supplierAddress: 0,
  supplierEIK: 0,
  vatNumber: 0,
  clientName: 0,
  clientEIK: 0,
  clientVatNumber: 0,
  invoiceNumber: 0,
  invoiceDate: 0,
  serviceDescription: 0,
  quantity: 0,
  unitPrice: 0,
  serviceTotal: 0,
  currency: 0,
  netAmount: 0,
  vatAmount: 0,
  totalAmount: 0,
};

const InvoiceDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceDetailApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState(defaultFormData);
  const [confidenceScores, setConfidenceScores] = useState<Record<string, number>>(defaultScores);
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [chatAvailable, setChatAvailable] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);

  // Scroll chat to bottom when a new message is sent or received
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [chatMessages, isSending]);

  // Billing summary: chat tab only for PRO or enterprise with chat enabled
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ chatAvailable?: boolean }>('/api/billing/summary')
      .then((res) => {
        if (!cancelled) setChatAvailable(res.data.chatAvailable ?? false);
      })
      .catch(() => {
        if (!cancelled) setChatAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch invoice by id
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setInvoice(null);
    setChatMessages([]);
    setFormData(defaultFormData);
    setConfidenceScores(defaultScores);
    setFileObjectUrl(null);
    setFileLoadError(null);
    fileUrlRef.current = null;

    apiClient
      .get<InvoiceDetailApi>('/api/invoices/' + id)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setInvoice(data);
        const savedChat = data.chatMessages ?? [];
        setChatMessages(
          savedChat.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }))
        );
        const f = data.fields;
        if (f) {
          setFormData({
            supplierName: f.supplier?.name ?? f.supplierName ?? '',
            supplierAddress: f.supplier?.address ?? '',
            supplierEIK: f.supplier?.eik ?? '',
            vatNumber: f.supplier?.vatNumber ?? f.supplierVatNumber ?? '',
            clientName: f.client?.name ?? '',
            clientEIK: f.client?.eik ?? '',
            clientVatNumber: f.client?.vatNumber ?? '',
            invoiceNumber: f.invoiceNumber ?? '',
            invoiceDate: f.invoiceDate ?? '',
            serviceDescription: f.service?.description ?? '',
            quantity: f.service?.quantity ?? '',
            unitPrice: f.service?.unitPrice ?? 0,
            serviceTotal: f.service?.total ?? 0,
            currency: f.amounts?.currency ?? f.currency ?? '',
            netAmount: f.amounts?.netAmount ?? f.netAmount ?? 0,
            vatAmount: f.amounts?.vatAmount ?? f.vatAmount ?? 0,
            totalAmount: f.amounts?.totalAmount ?? f.totalAmount ?? 0,
          });
          const scores = f.confidenceScores ?? {};
          setConfidenceScores({ ...defaultScores, ...scores });
        }
        setLoading(false);
      })
      .catch((err: { response?: { status: number; data?: { error?: string } }; message?: string }) => {
        if (cancelled) return;
        setLoading(false);
        setInvoice(null);
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(err.response?.data?.error ?? err.message ?? 'Failed to load invoice');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch file as blob and create object URL (auth required)
  useEffect(() => {
    if (!invoice?.fileUrl) return;
    const url = invoice.fileUrl;
    fileUrlRef.current = url;
    setFileLoadError(null);

    apiClient
      .get(url, { responseType: 'blob' })
      .then((res) => {
        if (fileUrlRef.current !== url) return;
        const blob = res.data as Blob;
        const objectUrl = URL.createObjectURL(blob);
        setFileObjectUrl(objectUrl);
      })
      .catch(() => {
        if (fileUrlRef.current === url) {
          setFileLoadError('Unable to load file');
        }
      });

    return () => {
      fileUrlRef.current = null;
      setFileObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [invoice?.id, invoice?.fileUrl]);

  const handleApprove = async () => {
    if (!invoice || !id) return;
    setApproving(true);
    try {
      await apiClient.post('/api/invoices/' + id + '/approve', {
        action: 'approved',
        approvedBy: user?.email ?? '',
      });
      setInvoice({ ...invoice, status: 'approved' });
      setIsEditing(false);
      setSnackbar({ open: true, message: t('invoiceDetail.approvedSuccess'), severity: 'success' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to approve';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setApproving(false);
    }
  };

  const handleSaveFields = async () => {
    if (!id || invoice?.status === 'approved') return;
    setSavingFields(true);
    try {
      await apiClient.patch('/api/invoices/' + id + '/fields', {
        supplierName: formData.supplierName,
        supplierAddress: formData.supplierAddress,
        supplierEIK: formData.supplierEIK,
        supplierVatNumber: formData.vatNumber,
        clientName: formData.clientName,
        clientEIK: formData.clientEIK,
        clientVatNumber: formData.clientVatNumber,
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        serviceDescription: formData.serviceDescription,
        quantity: formData.quantity,
        unitPrice: formData.unitPrice,
        serviceTotal: formData.serviceTotal,
        currency: formData.currency,
        netAmount: formData.netAmount,
        vatAmount: formData.vatAmount,
        totalAmount: formData.totalAmount,
      });
      setIsEditing(false);
      setSnackbar({ open: true, message: t('common.save') + ' succeeded', severity: 'success' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to save';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSavingFields(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !id || chatDisabled) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsSending(true);

    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await apiClient.post<{ content: string }>('/api/invoices/' + id + '/chat', {
        message: userMessage.content,
        history,
      });
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: res.data.content,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, aiResponse]);
    } catch (err: unknown) {
      const raw =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ??
        (err as Error)?.message ??
        t('invoiceDetail.chatError');
      const isStarterLimit = typeof raw === 'string' && raw.startsWith('Starter plan limit reached');
      const isProLimit = typeof raw === 'string' && raw.startsWith('Pro plan limit reached');
      if (isStarterLimit || isProLimit) {
        setChatDisabled(true);
      }
      setSnackbar({ open: true, message: raw, severity: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Invoice not found
        </Typography>
        <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/invoices')}>
          Back to Invoices
        </Button>
      </Box>
    );
  }

  if (error || !invoice) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error ?? 'Failed to load invoice'}
        </Alert>
        <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate('/invoices')}>
          Back to Invoices
        </Button>
      </Box>
    );
  }

  const isApproved = invoice.status === 'approved';
  const isPdf =
    invoice.mimeType === 'application/pdf' ||
    invoice.filename.toLowerCase().endsWith('.pdf');

  return (
    <Box sx={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/invoices')}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formData.invoiceNumber || invoice.filename}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invoice.filename}
            </Typography>
          </Box>
          <Chip
            label={invoice.status === 'approved' ? t('invoiceDetail.approved') : invoice.status === 'needs_review' ? t('invoiceDetail.needsReview') : t('invoiceDetail.pending')}
            color={invoice.status === 'approved' ? 'success' : invoice.status === 'needs_review' ? 'error' : 'warning'}
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {!isApproved && (
            <>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? t('invoiceDetail.cancelEdit') : t('invoiceDetail.edit')}
              </Button>
              {isEditing && (
                <Button
                  variant="outlined"
                  startIcon={savingFields ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveFields}
                  disabled={savingFields}
                >
                  {savingFields ? t('invoiceDetail.saving') : t('common.save')}
                </Button>
              )}
              <Button
                variant="contained"
                color="success"
                startIcon={approving ? <CircularProgress size={18} color="inherit" /> : <ApproveIcon />}
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? t('invoiceDetail.approving') : t('invoiceDetail.approveInvoice')}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Main Content - Split View */}
      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100% - 80px)' }}>
        {/* Left: Document Viewer - PDF or image */}
        <Paper
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('invoiceDetail.documentPreview')}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            {fileLoadError && (
              <Typography color="text.secondary">{fileLoadError}</Typography>
            )}
            {!fileLoadError && !fileObjectUrl && (
              <CircularProgress />
            )}
            {!fileLoadError && fileObjectUrl && isPdf && (
              <iframe
                src={fileObjectUrl}
                title="PDF"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 0,
                }}
              />
            )}
            {!fileLoadError && fileObjectUrl && !isPdf && (
              <Box
                component="img"
                src={fileObjectUrl}
                alt={invoice.filename}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            )}
          </Box>
        </Paper>

        {/* Right: Tabs */}
        <Paper
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={chatAvailable ? tabValue : 0}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2, flexShrink: 0 }}
          >
            <Tab label={t('invoiceDetail.extractedData')} />
            {chatAvailable && <Tab label={t('invoiceDetail.chatWithDocument')} />}
          </Tabs>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Extracted Data Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 3, pb: 10, flex: 1, minHeight: 0, overflow: 'auto' }}>
              {isApproved && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  {t('invoiceDetail.approvedLocked')}
                </Alert>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Supplier */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>{t('invoiceDetail.supplier')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                  <Box sx={{ borderLeft: 2, borderColor: getScore(confidenceScores, 'supplierName', 'supplier.name') < LOW_CONFIDENCE_THRESHOLD ? 'error.main' : 'transparent', pl: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.supplierName')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'supplierName', 'supplier.name')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.supplierName} onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.supplierAddress')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'supplierAddress', 'supplier.address')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.supplierAddress} onChange={(e) => setFormData({ ...formData, supplierAddress: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.supplierEIK')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'supplierEIK', 'supplier.eik')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.supplierEIK} onChange={(e) => setFormData({ ...formData, supplierEIK: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.vatNumber')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'vatNumber', 'supplier.vat')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.vatNumber} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Client */}
                <Typography variant="subtitle2" color="text.secondary">{t('invoiceDetail.client')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.clientName')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'clientName', 'client.name')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.clientEIK')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'clientEIK', 'client.eik')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.clientEIK} onChange={(e) => setFormData({ ...formData, clientEIK: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.clientVatNumber')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'clientVatNumber', 'client.vat')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.clientVatNumber} onChange={(e) => setFormData({ ...formData, clientVatNumber: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Invoice info */}
                <Typography variant="subtitle2" color="text.secondary">{t('invoiceDetail.invoiceInfo')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.invoiceNumber')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'invoiceNumber')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.invoiceDate')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'invoiceDate')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" type="date" value={formData.invoiceDate} onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Service */}
                <Typography variant="subtitle2" color="text.secondary">{t('invoiceDetail.service')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.serviceDescription')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'serviceDescription', 'service.description')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.serviceDescription} onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{t('invoiceDetail.quantity')}</Typography>
                        <ConfidenceIndicator score={getScore(confidenceScores, 'quantity', 'service.quantity')} lowHighlight />
                      </Box>
                      <TextField fullWidth size="small" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} disabled={!isEditing || isApproved} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{t('invoiceDetail.unitPrice')}</Typography>
                        <ConfidenceIndicator score={getScore(confidenceScores, 'unitPrice', 'service.unitPrice')} lowHighlight />
                      </Box>
                      <TextField fullWidth size="small" type="number" value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })} disabled={!isEditing || isApproved} InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }} />
                    </Box>
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.serviceTotal')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'serviceTotal', 'service.total')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" type="number" value={formData.serviceTotal} onChange={(e) => setFormData({ ...formData, serviceTotal: parseFloat(e.target.value) || 0 })} disabled={!isEditing || isApproved} InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }} />
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Amounts */}
                <Typography variant="subtitle2" color="text.secondary">{t('invoiceDetail.amounts')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.currency')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'currency', 'amounts.currency')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} disabled={!isEditing || isApproved} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.netAmount')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'netAmount', 'amounts.subtotal')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" type="number" value={formData.netAmount} onChange={(e) => setFormData({ ...formData, netAmount: parseFloat(e.target.value) || 0 })} disabled={!isEditing || isApproved} InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.vatAmount')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'vatAmount', 'amounts.vat')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" type="number" value={formData.vatAmount} onChange={(e) => setFormData({ ...formData, vatAmount: parseFloat(e.target.value) || 0 })} disabled={!isEditing || isApproved} InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t('invoiceDetail.totalAmount')}</Typography>
                      <ConfidenceIndicator score={getScore(confidenceScores, 'totalAmount', 'amounts.total')} lowHighlight />
                    </Box>
                    <TextField fullWidth size="small" type="number" value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })} disabled={!isEditing || isApproved} InputProps={{ startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment> }} />
                  </Box>
                </Box>
              </Box>
            </Box>
          </TabPanel>

          {/* Chat Tab (PRO or enterprise with chat enabled) */}
          {chatAvailable && (
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, px: 2, pt: 2, pb: 1 }}>
              {/* Chat Messages */}
              <Box ref={chatScrollRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto', mb: 2 }}>
                {chatMessages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <AIIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {t('invoiceDetail.askQuestions')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {t('invoiceDetail.chatHelp')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                      {[t('invoiceDetail.suggestedVat'), t('invoiceDetail.suggestedCheck'), t('invoiceDetail.suggestedMissing')].map((q) => (
                        <Chip
                          key={q}
                          label={q}
                          variant="outlined"
                          onClick={() => {
                            setChatInput(q);
                          }}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {chatMessages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                          }}
                        >
                          {message.role === 'user' ? <PersonIcon fontSize="small" /> : <AIIcon fontSize="small" />}
                        </Avatar>
                        <Box
                          sx={{
                            maxWidth: '80%',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                            color: message.role === 'user' ? 'white' : 'text.primary',
                          }}
                        >
                          <Typography variant="body2">{message.content}</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              mt: 0.5,
                              opacity: 0.7,
                              textAlign: message.role === 'user' ? 'right' : 'left',
                            }}
                          >
                            {formatTime(message.timestamp)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    {isSending && (
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                          <AIIcon fontSize="small" />
                        </Avatar>
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.100' }}>
                          <CircularProgress size={16} />
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              {/* Chat Input */}
              <Box sx={{ pt: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <TextField
                  fullWidth
                  placeholder={t('invoiceDetail.chatPlaceholder')}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isSending || chatDisabled}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleSendMessage}
                          disabled={!chatInput.trim() || isSending || chatDisabled}
                          color="primary"
                        >
                          <SendIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </TabPanel>
          )}
          </Box>
        </Paper>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InvoiceDetail;
