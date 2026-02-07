import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
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
  Info as InfoIcon,
  Warning as WarningIcon,
  SmartToy as AIIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { mockInvoices, mockChatHistory, Invoice, ChatMessage } from '@/data/mockData';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index} style={{ height: '100%' }}>
    {value === index && <Box sx={{ height: '100%', overflow: 'auto' }}>{children}</Box>}
  </div>
);

const ConfidenceIndicator: React.FC<{ score: number }> = ({ score }) => {
  const getColor = () => {
    if (score >= 0.9) return 'success';
    if (score >= 0.75) return 'warning';
    return 'error';
  };

  const getLabel = () => {
    if (score >= 0.9) return 'High';
    if (score >= 0.75) return 'Medium';
    return 'Low';
  };

  return (
    <Tooltip title={`${(score * 100).toFixed(0)}% confidence`}>
      <Chip
        label={getLabel()}
        color={getColor()}
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 20 }}
      />
    </Tooltip>
  );
};

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Form state
  const [formData, setFormData] = useState({
    supplierName: '',
    vatNumber: '',
    invoiceNumber: '',
    invoiceDate: '',
    currency: '',
    netAmount: 0,
    vatAmount: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    const foundInvoice = mockInvoices.find(inv => inv.id === id);
    if (foundInvoice) {
      setInvoice(foundInvoice);
      setFormData({
        supplierName: foundInvoice.supplierName,
        vatNumber: foundInvoice.vatNumber,
        invoiceNumber: foundInvoice.invoiceNumber,
        invoiceDate: foundInvoice.invoiceDate,
        currency: foundInvoice.currency,
        netAmount: foundInvoice.netAmount,
        vatAmount: foundInvoice.vatAmount,
        totalAmount: foundInvoice.totalAmount,
      });
      setChatMessages(mockChatHistory[foundInvoice.id] || []);
    }
  }, [id]);

  const handleApprove = () => {
    if (invoice) {
      setInvoice({ ...invoice, status: 'approved' });
      setIsEditing(false);
      setSnackbar({ open: true, message: 'Invoice approved successfully!', severity: 'success' });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsSending(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: getAIResponse(chatInput),
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, aiResponse]);
      setIsSending(false);
    }, 1500);
  };

  const getAIResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('vat') && q.includes('amount')) {
      return `The VAT amount on this invoice is ${formData.currency} ${formData.vatAmount.toFixed(2)}. This represents the tax charged on the net amount of ${formData.currency} ${formData.netAmount.toFixed(2)}.`;
    }
    if (q.includes('total')) {
      return `The total amount is ${formData.currency} ${formData.totalAmount.toFixed(2)}, which includes the net amount (${formData.currency} ${formData.netAmount.toFixed(2)}) plus VAT (${formData.currency} ${formData.vatAmount.toFixed(2)}).`;
    }
    if (q.includes('supplier')) {
      return `The supplier for this invoice is ${formData.supplierName} with VAT number ${formData.vatNumber}.`;
    }
    if (q.includes('missing') || q.includes('field')) {
      return 'All required fields have been extracted. I recommend reviewing the VAT number as it has a lower confidence score.';
    }
    return 'I understand your question. Based on the extracted data from this invoice, I can help verify amounts, check calculations, or identify any potential issues. What specific information would you like me to analyze?';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!invoice) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const isApproved = invoice.status === 'approved';

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
              {invoice.invoiceNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invoice.fileName}
            </Typography>
          </Box>
          <Chip
            label={invoice.status === 'approved' ? 'Approved' : invoice.status === 'needs_review' ? 'Needs Review' : 'Pending'}
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
                {isEditing ? 'Cancel Edit' : 'Edit'}
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={handleApprove}
              >
                Approve Invoice
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Main Content - Split View */}
      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100% - 80px)' }}>
        {/* Left: Document Viewer */}
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
              Document Preview
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: '80%',
                maxWidth: 400,
                aspectRatio: '8.5/11',
                bgcolor: 'white',
                borderRadius: 1,
                boxShadow: 3,
                p: 4,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ mb: 4, pb: 2, borderBottom: '2px solid', borderColor: 'primary.main' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formData.supplierName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  VAT: {formData.vatNumber}
                </Typography>
              </Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">Invoice Number</Typography>
                <Typography variant="body2" fontWeight={600}>{formData.invoiceNumber}</Typography>
              </Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="body2">{formData.invoiceDate}</Typography>
              </Box>
              <Box sx={{ mt: 'auto', pt: 3, borderTop: '1px solid', borderColor: 'grey.200' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Net Amount:</Typography>
                  <Typography variant="body2">{formData.currency} {formData.netAmount.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">VAT:</Typography>
                  <Typography variant="body2">{formData.currency} {formData.vatAmount.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid', borderColor: 'grey.200' }}>
                  <Typography variant="subtitle2" fontWeight={700}>Total:</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{formData.currency} {formData.totalAmount.toFixed(2)}</Typography>
                </Box>
              </Box>
            </Box>
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
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Extracted Data" />
            <Tab label="Chat with Document" />
          </Tabs>

          {/* Extracted Data Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
              {isApproved && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  This invoice has been approved and is now locked for editing.
                </Alert>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Supplier Name</Typography>
                    <ConfidenceIndicator score={invoice.confidenceScores.supplierName} />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    disabled={!isEditing || isApproved}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">VAT Number</Typography>
                    <ConfidenceIndicator score={invoice.confidenceScores.vatNumber} />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    disabled={!isEditing || isApproved}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Invoice Number</Typography>
                    <ConfidenceIndicator score={invoice.confidenceScores.invoiceNumber} />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    disabled={!isEditing || isApproved}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Invoice Date</Typography>
                      <ConfidenceIndicator score={invoice.confidenceScores.invoiceDate} />
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      disabled={!isEditing || isApproved}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Currency</Typography>
                      <ConfidenceIndicator score={invoice.confidenceScores.currency} />
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      disabled={!isEditing || isApproved}
                    />
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Net Amount</Typography>
                    <ConfidenceIndicator score={invoice.confidenceScores.netAmount} />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={formData.netAmount}
                    onChange={(e) => setFormData({ ...formData, netAmount: parseFloat(e.target.value) || 0 })}
                    disabled={!isEditing || isApproved}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment>,
                    }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">VAT Amount</Typography>
                    <ConfidenceIndicator score={invoice.confidenceScores.vatAmount} />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={formData.vatAmount}
                    onChange={(e) => setFormData({ ...formData, vatAmount: parseFloat(e.target.value) || 0 })}
                    disabled={!isEditing || isApproved}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment>,
                    }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                    <ConfidenceIndicator score={invoice.confidenceScores.totalAmount} />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                    disabled={!isEditing || isApproved}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment>,
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </TabPanel>

          {/* Chat Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Chat Messages */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {chatMessages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <AIIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Ask questions about this invoice
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      I can help you verify amounts, check calculations, or identify issues.
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                      {['What is the VAT amount?', 'Check if totals are correct', 'Are there missing fields?'].map((q) => (
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
              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  placeholder="Ask a question about this invoice..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isSending}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleSendMessage}
                          disabled={!chatInput.trim() || isSending}
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
