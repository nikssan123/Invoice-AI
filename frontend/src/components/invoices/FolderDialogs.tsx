import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Folder } from '@/data/folderData';

// Create/Rename Folder Dialog
interface FolderNameDialogProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  parentFolderName?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const FolderNameDialog: React.FC<FolderNameDialogProps> = ({
  open,
  mode,
  initialName = '',
  parentFolderName,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName, open]);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim());
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {mode === 'create' ? t('folderDialogs.createNewFolder') : t('folderDialogs.renameFolder')}
      </DialogTitle>
      <DialogContent>
        {mode === 'create' && parentFolderName && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('folderDialogs.creatingIn', { name: parentFolderName })}
          </Typography>
        )}
        <TextField
          autoFocus
          fullWidth
          label={t('folderDialogs.folderName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          {mode === 'create' ? t('common.create') : t('common.rename')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Delete Confirmation Dialog
interface DeleteDialogProps {
  open: boolean;
  itemType: 'folder' | 'invoice';
  itemName: string;
  itemNames?: string[];
  hasChildren?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  itemType,
  itemName,
  itemNames,
  hasChildren,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const allNames = itemNames && itemNames.length > 0 ? itemNames : itemName ? [itemName] : [];
  const maxToShow = 5;
  const visibleNames = allNames.slice(0, maxToShow);
  const remaining = allNames.length - visibleNames.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{itemType === 'folder' ? t('folderDialogs.deleteFolder') : t('folderDialogs.deleteInvoice')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('folderDialogs.deleteConfirm', { name: itemName })}
        </Typography>
        {visibleNames.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {visibleNames.map((name, idx) => (
              <Typography key={`${name}-${idx}`} variant="body2">
                {name}
              </Typography>
            ))}
            {remaining > 0 && (
              <Typography variant="body2" color="text.secondary">
                + {remaining} more
              </Typography>
            )}
          </Box>
        )}
        {hasChildren && (
          <Typography color="error" sx={{ mt: 1 }}>
            {t('folderDialogs.deleteWarning')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Move Item Dialog
interface MoveFolderNodeProps {
  folder: Folder;
  folders: Record<string, Folder>;
  level: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  disabledFolderIds: Set<string>;
  onToggleExpand: (folderId: string) => void;
  onSelect: (folderId: string) => void;
}

const MoveFolderNode: React.FC<MoveFolderNodeProps> = ({
  folder,
  folders,
  level,
  selectedFolderId,
  expandedFolders,
  disabledFolderIds,
  onToggleExpand,
  onSelect,
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children.length > 0;
  const isDisabled = disabledFolderIds.has(folder.id);

  return (
    <>
      <ListItemButton
        selected={isSelected}
        disabled={isDisabled}
        onClick={() => !isDisabled && onSelect(folder.id)}
        sx={{
          pl: 2 + level * 2,
          py: 0.75,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(folder.id);
            }}
            sx={{ mr: 0.5, p: 0.25 }}
          >
            {isExpanded ? (
              <ExpandIcon fontSize="small" />
            ) : (
              <CollapseIcon fontSize="small" />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} />
        )}
        
        <ListItemIcon sx={{ minWidth: 36 }}>
          {isExpanded ? (
            <FolderOpenIcon sx={{ color: 'primary.main' }} />
          ) : (
            <FolderIcon sx={{ color: 'grey.500' }} />
          )}
        </ListItemIcon>
        
        <ListItemText
          primary={folder.name}
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: isSelected ? 600 : 400,
          }}
        />
      </ListItemButton>
      
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {folder.children.map((childId) => {
              const childFolder = folders[childId];
              if (!childFolder) return null;
              return (
                <MoveFolderNode
                  key={childId}
                  folder={childFolder}
                  folders={folders}
                  level={level + 1}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  disabledFolderIds={disabledFolderIds}
                  onToggleExpand={onToggleExpand}
                  onSelect={onSelect}
                />
              );
            })}
          </List>
        </Collapse>
      )}
    </>
  );
};

interface MoveDialogProps {
  open: boolean;
  itemType: 'folder' | 'invoice';
  itemName: string;
  itemNames?: string[];
  itemId: string;
  folders: Record<string, Folder>;
  currentFolderId: string;
  onClose: () => void;
  onMove: (targetFolderId: string) => void;
}

export const MoveDialog: React.FC<MoveDialogProps> = ({
  open,
  itemType,
  itemName,
  itemNames,
  itemId,
  folders,
  currentFolderId,
  onClose,
  onMove,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['root'])
  );

  // Get all descendant folder IDs (can't move a folder into itself or its children)
  const getDescendantIds = (folderId: string): Set<string> => {
    const result = new Set<string>([folderId]);
    const folder = folders[folderId];
    if (folder) {
      for (const childId of folder.children) {
        const childDescendants = getDescendantIds(childId);
        childDescendants.forEach((id) => result.add(id));
      }
    }
    return result;
  };

  const disabledFolderIds = itemType === 'folder'
    ? getDescendantIds(itemId)
    : new Set([currentFolderId]);

  const handleToggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleMove = () => {
    if (selectedFolderId) {
      onMove(selectedFolderId);
      onClose();
    }
  };

  const rootFolder = folders['root'];
  if (!rootFolder) return null;

  const { t } = useTranslation();

  const allNames = itemNames && itemNames.length > 0 ? itemNames : itemName ? [itemName] : [];
  const maxToShow = 5;
  const visibleNames = allNames.slice(0, maxToShow);
  const remaining = allNames.length - visibleNames.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{itemType === 'folder' ? t('folderDialogs.moveFolder') : t('folderDialogs.moveInvoice')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('folderDialogs.selectDestination', { name: itemName })}
        </Typography>
        {visibleNames.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {visibleNames.map((name, idx) => (
              <Typography key={`${name}-${idx}`} variant="body2">
                {name}
              </Typography>
            ))}
            {remaining > 0 && (
              <Typography variant="body2" color="text.secondary">
                + {remaining} more
              </Typography>
            )}
          </Box>
        )}
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          <List disablePadding>
            <MoveFolderNode
              folder={rootFolder}
              folders={folders}
              level={0}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              disabledFolderIds={disabledFolderIds}
              onToggleExpand={handleToggleExpand}
              onSelect={setSelectedFolderId}
            />
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleMove}
          disabled={!selectedFolderId}
        >
          {t('common.moveHere')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
