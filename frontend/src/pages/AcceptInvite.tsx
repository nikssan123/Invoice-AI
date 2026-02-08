import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Container,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/context/AuthContext';

const AcceptInvite: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { setAuth } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('acceptInvite.errorTokenRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('acceptInvite.errorPasswordLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('acceptInvite.errorPasswordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ token: string; user: User }>('/api/auth/accept-invite', {
        token,
        password,
        name: name.trim() || undefined,
      });
      const { token: authToken, user } = res.data;
      setAuth(authToken, user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; data?: { error?: string } } };
      const message =
        axiosErr.response?.data?.error ?? t('acceptInvite.errorGeneric');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Card sx={{ maxWidth: 460 }}>
          <CardContent sx={{ p: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {t('acceptInvite.errorTokenRequired')}
            </Alert>
            <Button component={RouterLink} to="/login" fullWidth variant="contained">
              {t('acceptInvite.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ maxWidth: 460, mx: 'auto' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" align="center" sx={{ mb: 1, fontWeight: 700 }}>
              {t('acceptInvite.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              {t('acceptInvite.subtitle')}
            </Typography>

            <form onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                label={t('acceptInvite.nameLabel')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 2 }}
                placeholder={t('acceptInvite.namePlaceholder')}
              />
              <TextField
                fullWidth
                label={t('acceptInvite.passwordLabel')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 2 }}
                required
                inputProps={{ minLength: 8 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label={t('acceptInvite.confirmPasswordLabel')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                sx={{ mb: 2 }}
                required
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || password.length < 8}
                sx={{ mb: 2 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : t('acceptInvite.submit')}
              </Button>
              <Link component={RouterLink} to="/login" variant="body2" display="block" textAlign="center">
                {t('acceptInvite.backToLogin')}
              </Link>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default AcceptInvite;
