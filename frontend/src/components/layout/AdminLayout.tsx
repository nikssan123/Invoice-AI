import React from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Link,
} from '@mui/material';
import { Logout as LogoutIcon, TableChart as TableChartIcon } from '@mui/icons-material';
import { setAdminToken } from '@/api/adminClient';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    setAdminToken(null);
    navigate('/admin/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Link
            component={RouterLink}
            to="/admin"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'text.primary', mr: 3 }}
          >
            <TableChartIcon />
            <Typography variant="h6" component="span">Admin</Typography>
          </Link>
          <Link
            component={RouterLink}
            to="/admin"
            sx={{ px: 2, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
          >
            Dashboard
          </Link>
          <Link
            component={RouterLink}
            to="/admin/limits"
            sx={{ px: 2, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
          >
            Limits
          </Link>
          <Box sx={{ flexGrow: 1 }} />
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;
