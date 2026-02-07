import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Paper,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Description as DocIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { mockInvoices, Invoice } from '@/data/mockData';

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: Invoice) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedInvoice(invoice);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedInvoice(null);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    navigate(`/invoices/${invoice.id}`);
  };

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    // Simulate upload
    setTimeout(() => {
      const newInvoices: Invoice[] = Array.from(files).map((file, index) => ({
        id: `inv-new-${Date.now()}-${index}`,
        fileName: file.name,
        supplierName: 'Processing...',
        vatNumber: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        currency: 'EUR',
        netAmount: 0,
        vatAmount: 0,
        totalAmount: 0,
        status: 'pending' as const,
        uploadedAt: new Date().toISOString(),
        confidenceScores: {
          supplierName: 0,
          vatNumber: 0,
          invoiceNumber: 0,
          invoiceDate: 0,
          currency: 0,
          netAmount: 0,
          vatAmount: 0,
          totalAmount: 0,
        },
      }));
      
      setInvoices(prev => [...newInvoices, ...prev]);
      setUploading(false);
      setUploadDialogOpen(false);
    }, 2000);
  }, []);

  const getStatusChip = (status: Invoice['status']) => {
    const config = {
      pending: { label: 'Pending', color: 'warning' as const },
      needs_review: { label: 'Needs Review', color: 'error' as const },
      approved: { label: 'Approved', color: 'success' as const },
    };
    
    return (
      <Chip
        label={config[status].label}
        color={config[status].color}
        size="small"
        variant="outlined"
      />
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const filteredInvoices = invoices.filter(
    invoice =>
      invoice.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Invoices
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and review your uploaded invoices
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload Invoice
        </Button>
      </Box>

      {/* Search and Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search invoices..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1, maxWidth: 400 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              color="inherit"
            >
              Filter
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleViewInvoice(invoice)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <DocIcon color="action" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">
                          {invoice.invoiceNumber || 'Processing...'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {invoice.fileName}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{invoice.supplierName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {invoice.vatNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(invoice.invoiceDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={600}>
                      {formatCurrency(invoice.totalAmount, invoice.currency)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(invoice.status)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, invoice)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedInvoice) handleViewInvoice(selectedInvoice);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <ApproveIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>Approve</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !uploading && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Invoices</DialogTitle>
        <DialogContent>
          {uploading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>Processing your invoices...</Typography>
            </Box>
          ) : (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
                bgcolor: dragOver ? 'primary.50' : 'grey.50',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleUpload(e.dataTransfer.files);
              }}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={(e) => handleUpload(e.target.files)}
              />
              <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Drop files here or click to upload
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports PDF, PNG, JPG (Max 10MB per file)
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Invoices;
