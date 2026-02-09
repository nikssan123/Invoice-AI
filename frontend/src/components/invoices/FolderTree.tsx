import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  List,
  ListItemButton,
  Badge,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
  MoreVert as MoreIcon,
  CreateNewFolder as CreateFolderIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Folder, countInvoicesInFolder } from '@/data/folderData';

interface FolderTreeProps {
  folders: Record<string, Folder>;
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string) => void;
}

interface FolderNodeProps {
  folder: Folder;
  folders: Record<string, Folder>;
  level: number;
  selectedFolderId: string;
  expandedFolders: Set<string>;
  onToggleExpand: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onContextMenu: (event: React.MouseEvent, folderId: string) => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  folders,
  level,
  selectedFolderId,
  expandedFolders,
  onToggleExpand,
  onSelectFolder,
  onContextMenu,
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children.length > 0;
  const invoiceCount = countInvoicesInFolder(folder.id, folders);

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelectFolder(folder.id)}
        onContextMenu={(e) => onContextMenu(e, folder.id)}
        sx={{
          pl: 2 + level * 2,
          py: 0.75,
          borderRadius: 1,
          mx: 1,
          mb: 0.5,
          '&.Mui-selected': {
            bgcolor: 'primary.50',
            '&:hover': {
              bgcolor: 'primary.100',
            },
          },
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
        
        {isExpanded ? (
          <FolderOpenIcon
            sx={{ mr: 1.5, color: 'primary.main', fontSize: 20 }}
          />
        ) : (
          <FolderIcon
            sx={{ mr: 1.5, color: 'grey.500', fontSize: 20 }}
          />
        )}
        
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontWeight: isSelected ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {folder.name}
        </Typography>
        
        {invoiceCount > 0 && (
          <Badge
            badgeContent={invoiceCount}
            color="default"
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: 'grey.200',
                color: 'grey.700',
                fontSize: '0.7rem',
                minWidth: 20,
                height: 20,
              },
            }}
          />
        )}

        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e as unknown as React.MouseEvent, folder.id);
          }}
        >
          <MoreIcon fontSize="small" />
        </IconButton>
      </ListItemButton>
      
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {folder.children.map((childId) => {
              const childFolder = folders[childId];
              if (!childFolder) return null;
              return (
                <FolderNode
                  key={childId}
                  folder={childFolder}
                  folders={folders}
                  level={level + 1}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  onToggleExpand={onToggleExpand}
                  onSelectFolder={onSelectFolder}
                  onContextMenu={onContextMenu}
                />
              );
            })}
          </List>
        </Collapse>
      )}
    </>
  );
};

const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
}) => {
  const { t } = useTranslation();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['root', 'client-acme', 'client-techsol'])
  );
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    folderId: string;
  } | null>(null);

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

  const handleContextMenu = (event: React.MouseEvent, folderId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      folderId,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const rootFolder = folders['root'];
  if (!rootFolder) return null;

  const selectedFolder = contextMenu ? folders[contextMenu.folderId] : null;
  const isRootSelected = contextMenu?.folderId === 'root';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {t('folderTree.clients')}
        </Typography>
        <IconButton
          size="small"
          onClick={() => onCreateFolder('root')}
          title={t('folderTree.createNewClientFolder')}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <List disablePadding>
          <FolderNode
            folder={rootFolder}
            folders={folders}
            level={0}
            selectedFolderId={selectedFolderId}
            expandedFolders={expandedFolders}
            onToggleExpand={handleToggleExpand}
            onSelectFolder={onSelectFolder}
            onContextMenu={handleContextMenu}
          />
        </List>
      </Box>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              onCreateFolder(contextMenu.folderId);
            }
            handleCloseContextMenu();
          }}
        >
          <ListItemIcon>
            <CreateFolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New Subfolder</ListItemText>
        </MenuItem>
        
        {!isRootSelected && (
          <>
            <MenuItem
              onClick={() => {
                if (contextMenu) {
                  onRenameFolder(contextMenu.folderId);
                }
                handleCloseContextMenu();
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Rename</ListItemText>
            </MenuItem>
            
            <MenuItem
              onClick={() => {
                if (contextMenu) {
                  onMoveFolder(contextMenu.folderId);
                }
                handleCloseContextMenu();
              }}
            >
              <ListItemIcon>
                <MoveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Move</ListItemText>
            </MenuItem>
            
            <MenuItem
              onClick={() => {
                if (contextMenu) {
                  onDeleteFolder(contextMenu.folderId);
                }
                handleCloseContextMenu();
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};

export default FolderTree;
