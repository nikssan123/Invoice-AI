import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  TextField,
  InputAdornment,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Toolbar,
  IconButton,
  Tooltip,
  Alert,
  Menu,
  MenuItem,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import FolderTree from '@/components/invoices/FolderTree';
import InvoiceList from '@/components/invoices/InvoiceList';
import Breadcrumbs from '@/components/invoices/Breadcrumbs';
import { FolderNameDialog, DeleteDialog, MoveDialog } from '@/components/invoices/FolderDialogs';
import ExportColumnsDialog from '@/components/invoices/ExportColumnsDialog';
import {
  Folder,
  FolderInvoice,
  mockFolders,
  mockFolderInvoices,
  getFolderPath,
} from '@/data/folderData';
import type { ExportColumnConfig } from '@/types/export';
import { apiClient } from '@/api/client';

const Invoices: React.FC = () => {
  const { t } = useTranslation();
  // State
  const [folders, setFolders] = useState<Record<string, Folder>>(mockFolders);
  const [invoices, setInvoices] = useState<Record<string, FolderInvoice>>(mockFolderInvoices);
  const [selectedFolderId, setSelectedFolderId] = useState('root');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | FolderInvoice['status']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  const filterMenuOpen = Boolean(filterAnchorEl);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Folder dialog state
  const [folderNameDialog, setFolderNameDialog] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    parentId?: string;
    folderId?: string;
  }>({ open: false, mode: 'create' });

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'folder' | 'invoice';
    id: string;
  } | null>(null);

  // Move dialog state
  const [moveDialog, setMoveDialog] = useState<{
    open: boolean;
    type: 'folder' | 'invoice';
    id: string;
  } | null>(null);

  // Error message for folder/invoice actions (create, move, delete)
  const [actionError, setActionError] = useState<string | null>(null);

  // Invoices we're waiting on for extraction; poll until extractedAt is set, then refresh
  const [pendingExtractionIds, setPendingExtractionIds] = useState<string[]>([]);
  const [extractionCompleteSnackbar, setExtractionCompleteSnackbar] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccessSnackbar, setExportSuccessSnackbar] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportColumnConfig[] | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'selected' | 'folder' | null>(null);
  const [hasExportConfig, setHasExportConfig] = useState<boolean | null>(null);

  const loadTree = useCallback(async (): Promise<
    { folders: Record<string, Folder>; invoices: Record<string, FolderInvoice> } | undefined
  > => {
    try {
      const res = await apiClient.get<{
        folders: Folder[];
        invoices: Record<string, FolderInvoice>;
      }>('/api/invoices/tree');

      const folderMap: Record<string, Folder> = {};
      res.data.folders.forEach((f) => {
        folderMap[f.id] = f;
      });

      setFolders(folderMap);
      setInvoices(res.data.invoices);
      setSelectedFolderId('root');
      return { folders: folderMap, invoices: res.data.invoices };
    } catch (err) {
      // Leave mock data in place if backend tree cannot be loaded
      console.error('Failed to load invoice tree', err);
      return undefined;
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // When invoices update, check if all pending extractions are complete
  useEffect(() => {
    if (pendingExtractionIds.length === 0) return;
    const allDone = pendingExtractionIds.every(
      (id) => invoices[id]?.extractedAt != null
    );
    if (allDone) {
      setPendingExtractionIds([]);
      setExtractionCompleteSnackbar(true);
    }
  }, [invoices, pendingExtractionIds]);

  // Poll only after a new upload: fetch tree until all uploaded invoices have extractedAt, or 90s
  useEffect(() => {
    if (pendingExtractionIds.length === 0) return;
    const POLL_MS = 2500;
    const TIMEOUT_MS = 90000;
    const startedAt = Date.now();
    const pending = pendingExtractionIds;
    const intervalId = setInterval(async () => {
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setPendingExtractionIds([]);
        return;
      }
      const data = await loadTree();
      if (data && pending.every((id) => data.invoices[id]?.extractedAt != null)) {
        setPendingExtractionIds([]);
        setExtractionCompleteSnackbar(true);
      }
    }, POLL_MS);
    return () => clearInterval(intervalId);
  }, [pendingExtractionIds, loadTree]);

  // Get current folder and its contents
  const currentFolder = folders[selectedFolderId];
  const folderPath = getFolderPath(selectedFolderId, folders);

  // Get subfolders
  const subfolders = currentFolder?.children
    .map((id) => folders[id])
    .filter(Boolean) || [];

  // Get invoices in current folder (with search and filter)
  const folderInvoices = currentFolder?.invoiceIds
    .map((id) => invoices[id])
    .filter(Boolean)
    // Search by supplier, invoice number, or file name
    .filter((invoice) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        invoice.supplierName.toLowerCase().includes(q) ||
        invoice.invoiceNumber.toLowerCase().includes(q) ||
        invoice.fileName.toLowerCase().includes(q)
      );
    })
    // Advanced filters: date, amount, status
    .filter((invoice) => {
      // Status filter
      if (statusFilter !== 'all' && invoice.status !== statusFilter) {
        return false;
      }

      // Date range filter (inclusive)
      if (dateFrom || dateTo) {
        const invDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : null;
        if (invDate && !Number.isNaN(invDate.getTime())) {
          if (dateFrom) {
            const from = new Date(dateFrom);
            if (!Number.isNaN(from.getTime()) && invDate < from) {
              return false;
            }
          }
          if (dateTo) {
            const to = new Date(dateTo);
            // Add one day to make the end date inclusive
            if (!Number.isNaN(to.getTime()) && invDate > new Date(to.getTime() + 24 * 60 * 60 * 1000)) {
              return false;
            }
          }
        }
      }

      // Amount range filter (on totalAmount)
      const total = invoice.totalAmount ?? 0;
      if (amountMin) {
        const min = Number.parseFloat(amountMin);
        if (!Number.isNaN(min) && total < min) {
          return false;
        }
      }
      if (amountMax) {
        const max = Number.parseFloat(amountMax);
        if (!Number.isNaN(max) && total > max) {
          return false;
        }
      }

      return true;
    }) || [];

  const handleOpenFilterMenu = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilterMenu = () => {
    setFilterAnchorEl(null);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
  };

  // Folder handlers
  const handleCreateFolder = (parentId: string) => {
    setFolderNameDialog({
      open: true,
      mode: 'create',
      parentId,
    });
  };

  const handleRenameFolder = (folderId: string) => {
    setFolderNameDialog({
      open: true,
      mode: 'rename',
      folderId,
    });
  };

  const handleFolderNameSubmit = async (name: string) => {
    setActionError(null);
    if (folderNameDialog.mode === 'create' && folderNameDialog.parentId !== undefined) {
      try {
        const parentId =
          folderNameDialog.parentId === 'root' ? null : folderNameDialog.parentId;
        await apiClient.post('/api/folders', { name: name.trim(), parentId });
        await loadTree();
        setFolderNameDialog({ open: false, mode: 'create' });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (err as Error)?.message ??
          'Failed to create folder';
        setActionError(message);
      }
    } else if (folderNameDialog.mode === 'rename' && folderNameDialog.folderId) {
      try {
        await apiClient.patch(`/api/folders/${folderNameDialog.folderId}`, {
          name: name.trim(),
        });
        await loadTree();
        setFolderNameDialog({ open: false, mode: 'create' });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (err as Error)?.message ??
          'Failed to rename folder';
        setActionError(message);
      }
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    setDeleteDialog({
      open: true,
      type: 'folder',
      id: folderId,
    });
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteDialog || deleteDialog.type !== 'folder') return;

    const folderId = deleteDialog.id;
    setActionError(null);

    try {
      await apiClient.delete(`/api/folders/${folderId}`);
      await loadTree();
      // After deletion, safest is to reset to root to avoid pointing at a deleted folder
      setSelectedFolderId('root');
      setDeleteDialog(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Failed to delete folder';
      setActionError(message);
    }
  };

  const handleMoveFolder = (folderId: string) => {
    setMoveDialog({
      open: true,
      type: 'folder',
      id: folderId,
    });
  };

  const handleConfirmMoveFolder = (targetFolderId: string) => {
    if (!moveDialog || moveDialog.type !== 'folder') return;

    const folderId = moveDialog.id;
    const folder = folders[folderId];
    if (!folder || !folder.parentId) return;

    setFolders((prev) => {
      const newFolders = { ...prev };
      const oldParent = newFolders[folder.parentId!];
      const newParent = newFolders[targetFolderId];

      if (oldParent && newParent) {
        // Remove from old parent
        newFolders[folder.parentId!] = {
          ...oldParent,
          children: oldParent.children.filter((id) => id !== folderId),
        };
        // Add to new parent
        newFolders[targetFolderId] = {
          ...newParent,
          children: [...newParent.children, folderId],
        };
        // Update folder's parentId
        newFolders[folderId] = {
          ...folder,
          parentId: targetFolderId,
        };
      }

      return newFolders;
    });

    setMoveDialog(null);
  };

  // Invoice handlers
  const handleSelectInvoice = (invoiceId: string, selected: boolean) => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(invoiceId);
      } else {
        next.delete(invoiceId);
      }
      return next;
    });
  };

  const handleSelectAllInvoices = (selected: boolean) => {
    if (selected) {
      setSelectedInvoices(new Set(folderInvoices.map((inv) => inv.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setDeleteDialog({
      open: true,
      type: 'invoice',
      id: invoiceId,
    });
  };

  const handleConfirmDeleteInvoice = async () => {
    if (!deleteDialog || deleteDialog.type !== 'invoice') return;

    setActionError(null);
    try {
      // Bulk delete
      if (deleteDialog.id === '__bulk__') {
        const ids = Array.from(selectedInvoices);
        if (ids.length === 0) {
          setDeleteDialog(null);
          return;
        }

        let failed = 0;
        await Promise.all(
          ids.map(async (invoiceId) => {
            try {
              await apiClient.delete(`/api/invoices/${invoiceId}`);
            } catch (err) {
              failed += 1;
              console.error('Failed to delete invoice', invoiceId, err);
            }
          })
        );

        await loadTree();
        setSelectedInvoices(new Set());
        setDeleteDialog(null);

        if (failed > 0) {
          setActionError(`Failed to delete ${failed} invoices`);
        }
      } else {
        const invoiceId = deleteDialog.id;
        await apiClient.delete(`/api/invoices/${invoiceId}`);
        await loadTree();
        setSelectedInvoices((prev) => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
        setDeleteDialog(null);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Failed to delete invoice';
      setActionError(message);
    }
  };

  const handleMoveInvoice = (invoiceId: string) => {
    setMoveDialog({
      open: true,
      type: 'invoice',
      id: invoiceId,
    });
  };

  const handleConfirmMoveInvoice = async (targetFolderId: string) => {
    if (!moveDialog || moveDialog.type !== 'invoice') return;

    setActionError(null);
    try {
      // Bulk mode: special marker id
      if (moveDialog.id === '__bulk__') {
        const ids = Array.from(selectedInvoices);
        if (ids.length === 0) {
          setMoveDialog(null);
          return;
        }

        await apiClient.post('/api/invoices/bulk-move', {
          invoiceIds: ids,
          targetFolderId,
        });
        await loadTree();
        setSelectedInvoices(new Set());
        setMoveDialog(null);
      } else {
        const invoiceId = moveDialog.id;
        await apiClient.post(`/api/invoices/${invoiceId}/move`, {
          targetFolderId,
        });
        await loadTree();
        setMoveDialog(null);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Failed to move invoice';
      setActionError(message);
    }
  };

  // Bulk actions
  const handleBulkMove = () => {
    if (selectedInvoices.size === 0) return;
    setMoveDialog({
      open: true,
      type: 'invoice',
      id: '__bulk__',
    });
  };

  const handleBulkDelete = () => {
    if (selectedInvoices.size === 0) return;
    setDeleteDialog({
      open: true,
      type: 'invoice',
      id: '__bulk__',
    });
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const fetchExportConfigIfNeeded = async (): Promise<boolean> => {
    if (exportColumns) return true;
    try {
      const res = await apiClient.get<{ columns: ExportColumnConfig[]; hasConfig: boolean }>(
        '/api/invoices/config/export'
      );
      setExportColumns(res.data.columns);
      setHasExportConfig(res.data.hasConfig);
      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        t('invoices.exportConfigLoadError');
      setActionError(message);
      return false;
    }
  };

  const startExportWithMode = async (mode: 'selected' | 'folder') => {
    const ok = await fetchExportConfigIfNeeded();
    if (!ok) return;
    // If user has no config yet, show dialog once to initialize it.
    if (hasExportConfig === false) {
      setExportMode(mode);
      setExportDialogOpen(true);
    } else {
      // Config already exists: run export directly without showing dialog.
      await runExport(mode);
    }
  };

  const handleExportSelected = async () => {
    if (selectedInvoices.size === 0 || exporting) return;
    await startExportWithMode('selected');
  };

  const handleExportFolder = async () => {
    if (!selectedFolderId || exporting) return;
    await startExportWithMode('folder');
  };

  const runExport = async (mode: 'selected' | 'folder') => {
    setActionError(null);
    setExporting(true);
    try {
      if (mode === 'selected') {
        const ids = Array.from(selectedInvoices);
        if (ids.length === 0) return;
        const response = await apiClient.post<ArrayBuffer>(
          '/api/invoices/export',
          {
            scope: 'selected',
            invoiceIds: ids,
            onlyConfirmed: true,
          },
          {
            responseType: 'arraybuffer',
          }
        );
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        triggerDownload(blob, `invoices-selected-${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else {
        const response = await apiClient.post<ArrayBuffer>(
          '/api/invoices/export',
          {
            scope: 'folder',
            folderIds: [selectedFolderId],
            includeSubfolders: true,
            onlyConfirmed: true,
          },
          {
            responseType: 'arraybuffer',
          }
        );
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        triggerDownload(blob, `invoices-folder-${new Date().toISOString().slice(0, 10)}.xlsx`);
      }
      setExportSuccessSnackbar(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      let message: string | undefined;

      const respData = axiosErr.response?.data;
      if (respData) {
        try {
          let parsed: unknown;
          if (respData instanceof ArrayBuffer) {
            const text = new TextDecoder('utf-8').decode(new Uint8Array(respData));
            parsed = JSON.parse(text);
          } else if (typeof respData === 'string') {
            parsed = JSON.parse(respData);
          } else if (typeof respData === 'object') {
            parsed = respData;
          }
          if (parsed && typeof (parsed as { error?: string }).error === 'string') {
            message = (parsed as { error: string }).error;
          }
        } catch {
          // If parsing fails, fall back to a generic message
        }
      }

      if (!message) {
        message = t('invoices.exportError');
      }

      setActionError(message);
    } finally {
      setExporting(false);
      setExportDialogOpen(false);
      setExportMode(null);
    }
  };

  const handleConfirmExportColumns = async (cols: ExportColumnConfig[]) => {
    setExportColumns(cols);
    try {
      const labels: Record<string, string> = {};
      cols.forEach((c) => {
        labels[c.key] = c.currentLabel;
      });
      await apiClient.put('/api/invoices/config/export', { labels });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        t('invoices.exportConfigSaveError');
      setActionError(message);
      return;
    }
    setHasExportConfig(true);
    if (exportMode) {
      await runExport(exportMode);
    }
  };

  // Upload handler: POST files to backend, merge response into state
  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setUploadError(null);
      setUploading(true);

      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));

      try {
        const res = await apiClient.post<{
          ids: string[];
          files: { id: string; filename: string }[];
        }>('/api/invoices/upload', formData);
        // After upload, refresh the tree and track ids so we poll until extraction completes
        await loadTree();
        if (res.data.ids?.length) {
          setPendingExtractionIds(res.data.ids);
        }
        setUploadDialogOpen(false);
        window.dispatchEvent(new CustomEvent('refreshBillingSummary'));
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string; code?: string }; status?: number } };
        const code = axiosErr?.response?.data?.code;
        const message =
          code === 'MONTHLY_LIMIT_REACHED'
            ? t('usageBilling.monthlyLimitReached')
            : code === 'SUBSCRIPTION_INACTIVE'
              ? t('usageBilling.subscriptionInactive')
              : code === 'TRIAL_EXPIRED'
                ? t('usageBilling.trialExpired')
                : axiosErr?.response?.data?.error ??
                  (err as Error)?.message ??
                  'Upload failed';
        setUploadError(message);
      } finally {
        setUploading(false);
      }
    },
    [loadTree, t]
  );

  // Get item info for dialogs
  const getDeleteItemInfo = () => {
    if (!deleteDialog) return { name: '', hasChildren: false, names: [] as string[] };
    if (deleteDialog.type === 'folder') {
      const folder = folders[deleteDialog.id];
      return {
        name: folder?.name || '',
        hasChildren: (folder?.children.length || 0) > 0 || (folder?.invoiceIds.length || 0) > 0,
        names: [] as string[],
      };
    }
    // Invoice delete: support both single and bulk modes
    if (deleteDialog.id === '__bulk__') {
      const ids = Array.from(selectedInvoices);
      const names =
        ids
          .map((id) => invoices[id]?.fileName)
          .filter((n): n is string => Boolean(n)) || [];
      return {
        name: `${names.length} invoices`,
        hasChildren: false,
        names,
      };
    }
    const invoice = invoices[deleteDialog.id];
    return {
      name: invoice?.fileName || '',
      hasChildren: false,
      names: invoice?.fileName ? [invoice.fileName] : [],
    };
  };

  const getMoveItemInfo = () => {
    if (!moveDialog) return { name: '', currentFolderId: 'root', names: [] as string[] };
    if (moveDialog.type === 'folder') {
      const folder = folders[moveDialog.id];
      return { name: folder?.name || '', currentFolderId: folder?.parentId || 'root', names: [] as string[] };
    }
    // Invoice move: support both single and bulk modes
    if (moveDialog.id === '__bulk__') {
      const ids = Array.from(selectedInvoices);
      const invoicesToMove = ids.map((id) => invoices[id]).filter(Boolean);
      const names = invoicesToMove.map((inv) => inv.fileName);
      const first = invoicesToMove[0];
      return {
        name: first?.fileName || '',
        currentFolderId: first?.folderId || 'root',
        names,
      };
    }
    const invoice = invoices[moveDialog.id];
    return {
      name: invoice?.fileName || '',
      currentFolderId: invoice?.folderId || 'root',
      names: invoice?.fileName ? [invoice.fileName] : [],
    };
  };

  const deleteItemInfo = getDeleteItemInfo();
  const moveItemInfo = getMoveItemInfo();

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      {/* Folder Tree Sidebar */}
      <Card
        sx={{
          width: 280,
          minWidth: 280,
          borderRadius: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveFolder={handleMoveFolder}
        />
      </Card>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ p: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {t('invoices.title')}
              </Typography>
              <Breadcrumbs path={folderPath} onNavigate={setSelectedFolderId} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportFolder}
                disabled={exporting}
              >
                {t('invoices.exportFolder')}
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                {t('invoices.uploadInvoice')}
              </Button>
            </Box>
          </Box>

          {actionError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setActionError(null)}
            >
              {actionError}
            </Alert>
          )}

          {/* Search, filters, and bulk actions */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder={t('invoices.searchPlaceholder')}
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
              size="small"
              startIcon={<FilterListIcon />}
              onClick={handleOpenFilterMenu}
            >
              {t('invoices.filters')}
            </Button>

            <Menu
              anchorEl={filterAnchorEl}
              open={filterMenuOpen}
              onClose={handleCloseFilterMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <Box sx={{ p: 2, width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2">{t('invoices.filterTitle')}</Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label={t('invoices.dateFrom')}
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label={t('invoices.dateTo')}
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label={t('invoices.amountMin')}
                    type="number"
                    size="small"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label={t('invoices.amountMax')}
                    type="number"
                    size="small"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    fullWidth
                  />
                </Box>

                <TextField
                  select
                  label={t('invoices.status')}
                  size="small"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'all' | FolderInvoice['status'])
                  }
                  fullWidth
                >
                  <MenuItem value="all">{t('invoices.statusAll')}</MenuItem>
                  <MenuItem value="pending">{t('invoiceList.pending')}</MenuItem>
                  <MenuItem value="needs_review">{t('invoiceList.needsReview')}</MenuItem>
                  <MenuItem value="approved">{t('invoiceList.approved')}</MenuItem>
                </TextField>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Button size="small" onClick={handleClearFilters}>
                    {t('common.clear')}
                  </Button>
                  <Button size="small" onClick={handleCloseFilterMenu}>
                    {t('common.close')}
                  </Button>
                </Box>
              </Box>
            </Menu>

            {selectedInvoices.size > 0 && (
              <Toolbar
                variant="dense"
                sx={{
                  bgcolor: 'primary.50',
                  borderRadius: 1,
                  minHeight: 40,
                  px: 2,
                }}
              >
                <Typography variant="body2" sx={{ mr: 2 }}>
                  {t('invoices.selectedCount', { count: selectedInvoices.size })}
                </Typography>
                <Tooltip title={t('invoices.moveSelected')}>
                  <IconButton size="small" onClick={handleBulkMove}>
                    <MoveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('invoices.deleteSelected')}>
                  <IconButton size="small" color="error" onClick={handleBulkDelete}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('invoices.exportSelected')}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleExportSelected}
                      disabled={exporting}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Toolbar>
            )}
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <InvoiceList
            invoices={folderInvoices}
            folders={subfolders}
            selectedInvoices={selectedInvoices}
            onSelectInvoice={handleSelectInvoice}
            onSelectAll={handleSelectAllInvoices}
            onDeleteInvoice={handleDeleteInvoice}
            onMoveInvoice={handleMoveInvoice}
          />
        </Box>
      </Box>

      {/* Dialogs */}
      <FolderNameDialog
        open={folderNameDialog.open}
        mode={folderNameDialog.mode}
        initialName={
          folderNameDialog.mode === 'rename' && folderNameDialog.folderId
            ? folders[folderNameDialog.folderId]?.name
            : ''
        }
        parentFolderName={
          folderNameDialog.mode === 'create' && folderNameDialog.parentId
            ? folders[folderNameDialog.parentId]?.name
            : undefined
        }
        onClose={() => setFolderNameDialog({ open: false, mode: 'create' })}
        onSubmit={handleFolderNameSubmit}
      />

      <DeleteDialog
        open={deleteDialog !== null}
        itemType={deleteDialog?.type || 'folder'}
        itemName={deleteItemInfo.name}
        itemNames={deleteItemInfo.names}
        hasChildren={deleteItemInfo.hasChildren}
        onClose={() => setDeleteDialog(null)}
        onConfirm={deleteDialog?.type === 'folder' ? handleConfirmDeleteFolder : handleConfirmDeleteInvoice}
      />

      <MoveDialog
        open={moveDialog !== null}
        itemType={moveDialog?.type || 'folder'}
        itemName={moveItemInfo.name}
        itemNames={moveItemInfo.names}
        itemId={moveDialog?.id || ''}
        folders={folders}
        currentFolderId={moveItemInfo.currentFolderId}
        onClose={() => setMoveDialog(null)}
        onMove={moveDialog?.type === 'folder' ? handleConfirmMoveFolder : handleConfirmMoveInvoice}
      />

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => {
          if (!uploading) {
            setUploadError(null);
            setUploadDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('invoices.uploadInvoices')}</DialogTitle>
        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
              {uploadError}
            </Alert>
          )}
          {uploading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>{t('invoices.processing')}</Typography>
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
                {t('invoices.dropOrClick')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('invoices.supportsFiles')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={extractionCompleteSnackbar}
        autoHideDuration={4000}
        onClose={() => setExtractionCompleteSnackbar(false)}
        message={t('invoices.extractionComplete')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      <Snackbar
        open={exportSuccessSnackbar}
        autoHideDuration={4000}
        onClose={() => setExportSuccessSnackbar(false)}
        message={t('invoices.exportSuccess')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      <ExportColumnsDialog
        open={exportDialogOpen}
        columns={exportColumns || []}
        loading={exporting}
        onClose={() => {
          if (!exporting) {
            setExportDialogOpen(false);
            setExportMode(null);
          }
        }}
        onConfirm={handleConfirmExportColumns}
      />
    </Box>
  );
};

export default Invoices;
