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
  Tooltip,
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
  onFolderClick?: (folderId: string) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  folders,
  selectedInvoices,
  onSelectInvoice,
  onSelectAll,
  onDeleteInvoice,
  onMoveInvoice,
  onFolderClick,
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

  const handleViewInvoice = (invoice: FolderInvoice) => {
    if (invoice.extractedAt == null) return;
    navigate(`/invoices/${invoice.id}`);
  };

  const menuInvoice = menuInvoiceId ? invoices.find((inv) => inv.id === menuInvoiceId) : null;
  const canOpenMenuInvoice = menuInvoice != null && menuInvoice.extractedAt != null;

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

  /** Compute average confidence 0–100 from per-field scores (API may use 0–1 or 0–100). */
  const getConfidencePercent = (scores: FolderInvoice['confidenceScores'] | undefined): number | null => {
    if (!scores || typeof scores !== 'object') return null;
    const values = Object.values(scores).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (values.length === 0) return null;
    const normalized = values.map((v) => (v > 1 ? v : v * 100));
    const avg = normalized.reduce((a, b) => a + b, 0) / normalized.length;
    return Math.round(avg);
  };

  const getConfidenceColor = (pct: number): 'success' | 'warning' | 'error' => {
    if (pct >= 90) return 'success';
    if (pct >= 70) return 'warning';
    return 'error';
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
                onClick={() => onFolderClick?.(folder.id)}
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
                <TableCell>{t('invoiceList.invoice')}</TableCell>
                <TableCell>{t('invoiceList.supplier')}</TableCell>
                <TableCell>{t('invoiceList.date')}</TableCell>
                <TableCell align="right">{t('invoiceList.amount')}</TableCell>
                <TableCell>{t('invoiceList.status')} / {t('invoiceList.confidence')}</TableCell>
                <TableCell align="right">{t('invoiceList.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => {
                const canOpen = invoice.extractedAt != null;
                const extractingLabel = (
                  <Tooltip title={t('invoiceList.extractionInProgress')} placement="top">
                    <span>{t('invoiceList.extracting')}</span>
                  </Tooltip>
                );
                return (
                  <TableRow
                    key={invoice.id}
                    hover={canOpen}
                    sx={{
                      cursor: canOpen ? 'pointer' : 'not-allowed',
                      opacity: canOpen ? 1 : 0.85,
                    }}
                    onClick={() => handleViewInvoice(invoice)}
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
                            {invoice.extractedAt != null
                              ? (invoice.invoiceNumber || '—')
                              : extractingLabel}
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {getStatusChip(invoice.status)}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          •
                        </Typography>
                        {(() => {
                          const pct = getConfidencePercent(invoice.confidenceScores);
                          if (pct == null || (invoice.extractedAt == null && pct === 0)) {
                            return (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            );
                          }
                          const color = getConfidenceColor(pct);
                          return (
                            <Tooltip title={t('invoiceDetail.confidencePct', { pct })}>
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ fontWeight: 600, color: `${color}.main`, whiteSpace: 'nowrap' }}
                              >
                                {pct}%
                              </Typography>
                            </Tooltip>
                          );
                        })()}
                      </Box>
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
                );
              })}
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
          disabled={!canOpenMenuInvoice}
          onClick={() => {
            if (menuInvoice) handleViewInvoice(menuInvoice);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Open"
            secondary={!canOpenMenuInvoice ? t('invoiceList.openAvailableAfterExtraction') : undefined}
          />
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
