import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { adminClient } from '@/api/adminClient';

const AdminTableViewer: React.FC = () => {
  const { tableName } = useParams<{ tableName: string }>();
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tableName) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    adminClient
      .get<{ tableName: string; columns: string[]; rows: Record<string, unknown>[] }>(`/api/admin/${tableName}`)
      .then((res) => {
        if (!cancelled) {
          setColumns(res.data.columns ?? []);
          setRows(res.data.rows ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load table.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableName]);

  if (!tableName) {
    return (
      <Alert severity="error">
        Missing table name.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Link
        component={RouterLink}
        to="/admin"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2, textDecoration: 'none' }}
      >
        <ArrowBackIcon fontSize="small" /> Back to dashboard
      </Link>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        {tableName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {rows.length} row(s) (max 100)
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col} variant="head" sx={{ fontWeight: 600 }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col}>
                    {row[col] != null ? String(row[col]) : '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminTableViewer;
