import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { TableChart as TableChartIcon } from '@mui/icons-material';
import { adminClient } from '@/api/adminClient';

interface TableInfo {
  name: string;
  rowCount: number;
}

const AdminDashboard: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [totalTables, setTotalTables] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminClient
      .get<{ tables: TableInfo[]; totalTables: number }>('/api/admin')
      .then((res) => {
        if (!cancelled) {
          setTables(res.data.tables ?? []);
          setTotalTables(res.data.totalTables ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Database tables
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {totalTables} table(s). Click a table to view up to 100 rows.
      </Typography>
      <Card variant="outlined">
        <CardContent sx={{ py: 0, '&:last-child': { pb: 0 } }}>
          <List disablePadding>
            {tables.map((t) => (
              <ListItem key={t.name} disablePadding divider>
                <ListItemButton
                  component={RouterLink}
                  to={`/admin/tables/${t.name}`}
                  sx={{ gap: 1 }}
                >
                  <TableChartIcon fontSize="small" color="action" />
                  <ListItemText primary={t.name} secondary={`${t.rowCount} rows`} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;
