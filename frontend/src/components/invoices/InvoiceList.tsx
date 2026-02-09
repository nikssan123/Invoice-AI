import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Description as DocIcon,
  FolderOpen as EmptyFolderIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderInvoice, Folder } from '@/data/folderData';

interface InvoiceListProps {
  invoices: FolderInvoice[];
  folders: Folder[];
  selectedInvoices: Set<string>;
  onSelectInvoice: (invoiceId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onMoveInvoice: (invoiceId: string) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  folders,
  selectedInvoices,
  onSelectInvoice,
  onSelectAll,
  onDeleteInvoice,
  onMoveInvoice,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuInvoiceId, setMenuInvoiceId] = useState<string | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoiceId: string) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setMenuInvoiceId(invoiceId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuInvoiceId(null);
  };

  const handleViewInvoice = (invoiceId: string) => {
    navigate(`/invoices/${invoiceId}`);
  };

  const getStatusChip = (status: FolderInvoice['status']) => {
    const config = {
      pending: { label: t('invoiceList.pending'), color: 'warning' as const },
      needs_review: { label: t('invoiceList.needsReview'), color: 'error' as const },
      approved: { label: t('invoiceList.approved'), color: 'success' as const },
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

  const formatCurrency = (amount?: number | null, currency?: string | null) => {
    if (amount == null) return '';

    const safeCurrency = (currency && currency.trim()) || 'EUR';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurrency,
      }).format(amount);
    } catch {
      // Fallback in case the currency code is still invalid for any reason
      return amount.toFixed(2);
    }
  };

  const allSelected = invoices.length > 0 && invoices.every((inv) => selectedInvoices.has(inv.id));
  const someSelected = invoices.some((inv) => selectedInvoices.has(inv.id)) && !allSelected;

  if (invoices.length === 0 && folders.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          color: 'text.secondary',
        }}
      >
        <EmptyFolderIcon sx={{ fontSize: 64, mb: 2, color: 'grey.300' }} />
        <Typography variant="h6" color="text.secondary">
          {t('invoiceList.noInvoicesInFolder')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('invoiceList.uploadOrMove')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Subfolder cards */}
      {folders.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, px: 1 }}>
            {t('invoiceList.subfolders')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {folders.map((folder) => (
              <Paper
                key={folder.id}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                  minWidth: 180,
                  '&:hover': {
                    bgcolor: 'grey.50',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <EmptyFolderIcon sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {folder.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {folder.invoiceIds.length} invoices
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Invoice table */}
      {invoices.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleViewInvoice(invoice.id)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onChange={(e) => onSelectInvoice(invoice.id, e.target.checked)}
                    />
                  </TableCell>
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
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, invoice.id)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (menuInvoiceId) handleViewInvoice(menuInvoiceId);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuInvoiceId) onMoveInvoice(menuInvoiceId);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <MoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move to...</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuInvoiceId) onDeleteInvoice(menuInvoiceId);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default InvoiceList;
