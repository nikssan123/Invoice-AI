import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ExportColumnConfig } from '@/types/export';

type Props = {
  open: boolean;
  columns: ExportColumnConfig[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (columns: ExportColumnConfig[]) => void;
};

const ExportColumnsDialog: React.FC<Props> = ({ open, columns, loading, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [localColumns, setLocalColumns] = useState<ExportColumnConfig[]>(columns);
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  useEffect(() => {
    const anyEmpty = localColumns.some((c) => !c.currentLabel || c.currentLabel.trim().length === 0);
    setHasErrors(anyEmpty);
  }, [localColumns]);

  const handleChange = (key: ExportColumnConfig['key'], value: string) => {
    setLocalColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, currentLabel: value } : c))
    );
  };

  const handleConfirm = () => {
    if (hasErrors) return;
    onConfirm(localColumns);
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1.5 }}>{t('invoices.exportConfigTitle')}</DialogTitle>
      <DialogContent dividers sx={{ pt: 1.5, pb: 2.5 }}>
        <Typography variant="body2" sx={{ mb: 2.5 }}>
          {t('invoices.exportConfigDescription')}
        </Typography>
        <Box
          sx={{
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 2
          }}
        >
          {localColumns.map((col) => (
            <TextField
              key={col.key}
              size="small"
              label={t('invoices.exportColumnCurrentLabel')}
              value={col.currentLabel}
              onChange={(e) => handleChange(col.key, e.target.value)}
              error={!col.currentLabel || col.currentLabel.trim().length === 0}
              helperText={
                !col.currentLabel || col.currentLabel.trim().length === 0
                  ? t('invoices.exportColumnValidation')
                  : ''
              }
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || hasErrors}
        >
          {t('invoices.exportConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportColumnsDialog;

