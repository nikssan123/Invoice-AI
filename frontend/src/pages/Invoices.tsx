import React, { useState, useCallback } from 'react';
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
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import FolderTree from '@/components/invoices/FolderTree';
import InvoiceList from '@/components/invoices/InvoiceList';
import Breadcrumbs from '@/components/invoices/Breadcrumbs';
import { FolderNameDialog, DeleteDialog, MoveDialog } from '@/components/invoices/FolderDialogs';
import {
  Folder,
  FolderInvoice,
  mockFolders,
  mockFolderInvoices,
  getFolderPath,
} from '@/data/folderData';

const Invoices: React.FC = () => {
  const { t } = useTranslation();
  // State
  const [folders, setFolders] = useState<Record<string, Folder>>(mockFolders);
  const [invoices, setInvoices] = useState<Record<string, FolderInvoice>>(mockFolderInvoices);
  const [selectedFolderId, setSelectedFolderId] = useState('root');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  // Get current folder and its contents
  const currentFolder = folders[selectedFolderId];
  const folderPath = getFolderPath(selectedFolderId, folders);

  // Get subfolders
  const subfolders = currentFolder?.children
    .map((id) => folders[id])
    .filter(Boolean) || [];

  // Get invoices in current folder (with search filter)
  const folderInvoices = currentFolder?.invoiceIds
    .map((id) => invoices[id])
    .filter(Boolean)
    .filter(
      (invoice) =>
        !searchQuery ||
        invoice.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

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

  const handleFolderNameSubmit = (name: string) => {
    if (folderNameDialog.mode === 'create' && folderNameDialog.parentId) {
      const newId = `folder-${Date.now()}`;
      const parentId = folderNameDialog.parentId;

      setFolders((prev) => ({
        ...prev,
        [newId]: {
          id: newId,
          name,
          parentId,
          children: [],
          invoiceIds: [],
          createdAt: new Date().toISOString(),
        },
        [parentId]: {
          ...prev[parentId],
          children: [...prev[parentId].children, newId],
        },
      }));
    } else if (folderNameDialog.mode === 'rename' && folderNameDialog.folderId) {
      setFolders((prev) => ({
        ...prev,
        [folderNameDialog.folderId!]: {
          ...prev[folderNameDialog.folderId!],
          name,
        },
      }));
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    setDeleteDialog({
      open: true,
      type: 'folder',
      id: folderId,
    });
  };

  const handleConfirmDeleteFolder = () => {
    if (!deleteDialog || deleteDialog.type !== 'folder') return;

    const folderId = deleteDialog.id;
    const folder = folders[folderId];
    if (!folder || !folder.parentId) return;

    // Remove from parent's children
    setFolders((prev) => {
      const newFolders = { ...prev };
      const parent = newFolders[folder.parentId!];
      if (parent) {
        newFolders[folder.parentId!] = {
          ...parent,
          children: parent.children.filter((id) => id !== folderId),
        };
      }
      delete newFolders[folderId];
      return newFolders;
    });

    // If current folder was deleted, go to parent
    if (selectedFolderId === folderId) {
      setSelectedFolderId(folder.parentId);
    }

    setDeleteDialog(null);
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

  const handleConfirmDeleteInvoice = () => {
    if (!deleteDialog || deleteDialog.type !== 'invoice') return;

    const invoiceId = deleteDialog.id;
    const invoice = invoices[invoiceId];
    if (!invoice) return;

    // Remove from folder
    setFolders((prev) => {
      const folder = prev[invoice.folderId];
      if (!folder) return prev;
      return {
        ...prev,
        [invoice.folderId]: {
          ...folder,
          invoiceIds: folder.invoiceIds.filter((id) => id !== invoiceId),
        },
      };
    });

    // Remove invoice
    setInvoices((prev) => {
      const newInvoices = { ...prev };
      delete newInvoices[invoiceId];
      return newInvoices;
    });

    // Remove from selection
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      next.delete(invoiceId);
      return next;
    });

    setDeleteDialog(null);
  };

  const handleMoveInvoice = (invoiceId: string) => {
    setMoveDialog({
      open: true,
      type: 'invoice',
      id: invoiceId,
    });
  };

  const handleConfirmMoveInvoice = (targetFolderId: string) => {
    if (!moveDialog || moveDialog.type !== 'invoice') return;

    const invoiceId = moveDialog.id;
    const invoice = invoices[invoiceId];
    if (!invoice) return;

    const oldFolderId = invoice.folderId;

    // Update folders
    setFolders((prev) => {
      const oldFolder = prev[oldFolderId];
      const newFolder = prev[targetFolderId];

      if (!oldFolder || !newFolder) return prev;

      return {
        ...prev,
        [oldFolderId]: {
          ...oldFolder,
          invoiceIds: oldFolder.invoiceIds.filter((id) => id !== invoiceId),
        },
        [targetFolderId]: {
          ...newFolder,
          invoiceIds: [...newFolder.invoiceIds, invoiceId],
        },
      };
    });

    // Update invoice
    setInvoices((prev) => ({
      ...prev,
      [invoiceId]: {
        ...prev[invoiceId],
        folderId: targetFolderId,
      },
    }));

    setMoveDialog(null);
  };

  // Bulk actions
  const handleBulkDelete = () => {
    selectedInvoices.forEach((invoiceId) => {
      const invoice = invoices[invoiceId];
      if (!invoice) return;

      setFolders((prev) => {
        const folder = prev[invoice.folderId];
        if (!folder) return prev;
        return {
          ...prev,
          [invoice.folderId]: {
            ...folder,
            invoiceIds: folder.invoiceIds.filter((id) => id !== invoiceId),
          },
        };
      });

      setInvoices((prev) => {
        const newInvoices = { ...prev };
        delete newInvoices[invoiceId];
        return newInvoices;
      });
    });

    setSelectedInvoices(new Set());
  };

  // Upload handler
  const handleUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setUploading(true);
      setTimeout(() => {
        const newInvoices: FolderInvoice[] = Array.from(files).map((file, index) => ({
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
          folderId: selectedFolderId,
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

        // Add invoices to state
        const newInvoiceMap: Record<string, FolderInvoice> = {};
        const newInvoiceIds: string[] = [];
        newInvoices.forEach((inv) => {
          newInvoiceMap[inv.id] = inv;
          newInvoiceIds.push(inv.id);
        });

        setInvoices((prev) => ({ ...prev, ...newInvoiceMap }));
        setFolders((prev) => ({
          ...prev,
          [selectedFolderId]: {
            ...prev[selectedFolderId],
            invoiceIds: [...prev[selectedFolderId].invoiceIds, ...newInvoiceIds],
          },
        }));

        setUploading(false);
        setUploadDialogOpen(false);
      }, 2000);
    },
    [selectedFolderId]
  );

  // Get item info for dialogs
  const getDeleteItemInfo = () => {
    if (!deleteDialog) return { name: '', hasChildren: false };
    if (deleteDialog.type === 'folder') {
      const folder = folders[deleteDialog.id];
      return {
        name: folder?.name || '',
        hasChildren: (folder?.children.length || 0) > 0 || (folder?.invoiceIds.length || 0) > 0,
      };
    }
    const invoice = invoices[deleteDialog.id];
    return { name: invoice?.fileName || '', hasChildren: false };
  };

  const getMoveItemInfo = () => {
    if (!moveDialog) return { name: '', currentFolderId: 'root' };
    if (moveDialog.type === 'folder') {
      const folder = folders[moveDialog.id];
      return { name: folder?.name || '', currentFolderId: folder?.parentId || 'root' };
    }
    const invoice = invoices[moveDialog.id];
    return { name: invoice?.fileName || '', currentFolderId: invoice?.folderId || 'root' };
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
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              {t('invoices.uploadInvoice')}
            </Button>
          </Box>

          {/* Search and bulk actions */}
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
                  <IconButton size="small">
                    <MoveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('invoices.deleteSelected')}>
                  <IconButton size="small" color="error" onClick={handleBulkDelete}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
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
        hasChildren={deleteItemInfo.hasChildren}
        onClose={() => setDeleteDialog(null)}
        onConfirm={deleteDialog?.type === 'folder' ? handleConfirmDeleteFolder : handleConfirmDeleteInvoice}
      />

      <MoveDialog
        open={moveDialog !== null}
        itemType={moveDialog?.type || 'folder'}
        itemName={moveItemInfo.name}
        itemId={moveDialog?.id || ''}
        folders={folders}
        currentFolderId={moveItemInfo.currentFolderId}
        onClose={() => setMoveDialog(null)}
        onMove={moveDialog?.type === 'folder' ? handleConfirmMoveFolder : handleConfirmMoveInvoice}
      />

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !uploading && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('invoices.uploadInvoices')}</DialogTitle>
        <DialogContent>
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
    </Box>
  );
};

export default Invoices;
