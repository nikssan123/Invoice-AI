import React from 'react';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { Folder } from '@/data/folderData';

interface BreadcrumbsProps {
  path: Folder[];
  onNavigate: (folderId: string) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, onNavigate }) => {
  return (
    <MuiBreadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      sx={{ mb: 2 }}
    >
      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        
        if (isLast) {
          return (
            <Typography
              key={folder.id}
              color="text.primary"
              fontWeight={600}
              variant="body2"
            >
              {folder.name}
            </Typography>
          );
        }
        
        return (
          <Link
            key={folder.id}
            component="button"
            variant="body2"
            underline="hover"
            color="text.secondary"
            onClick={() => onNavigate(folder.id)}
            sx={{ cursor: 'pointer' }}
          >
            {folder.name}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
};

export default Breadcrumbs;
