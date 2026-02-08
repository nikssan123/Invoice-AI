import React, { useState } from 'react';
import {
  Container,
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
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('resetPassword.errorTokenRequired'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.errorPasswordMismatch'));
      return;
    }
    if (password.length < 8) return;
    setLoading(true);
    try {
      await apiClient.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
    } catch {
      setError(t('login.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  if (!token && !success) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Card sx={{ maxWidth: 460 }}>
          <CardContent sx={{ p: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {t('resetPassword.errorTokenRequired')}
            </Alert>
            <Button component={RouterLink} to="/login" fullWidth variant="contained">
              {t('resetPassword.backToLogin')}
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
              {t('resetPassword.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              {t('resetPassword.subtitle')}
            </Typography>

            {success ? (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t('resetPassword.success')}
                </Alert>
                <Button component={RouterLink} to="/login" fullWidth variant="contained">
                  {t('resetPassword.backToLogin')}
                </Button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                <TextField
                  fullWidth
                  label={t('resetPassword.passwordLabel')}
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
                  label={t('resetPassword.confirmPasswordLabel')}
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
                  {loading ? <CircularProgress size={24} color="inherit" /> : t('resetPassword.submit')}
                </Button>
                <Link component={RouterLink} to="/login" variant="body2" display="block" textAlign="center">
                  {t('resetPassword.backToLogin')}
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ResetPassword;
