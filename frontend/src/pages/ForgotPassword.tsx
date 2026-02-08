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
  CircularProgress,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email?.trim()) return;
    setLoading(true);
    try {
      await apiClient.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      setError(t('login.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

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
              {t('forgotPassword.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              {t('forgotPassword.subtitle')}
            </Typography>

            {sent ? (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t('forgotPassword.success')}
                </Alert>
                <Button component={RouterLink} to="/login" fullWidth variant="contained">
                  {t('forgotPassword.backToLogin')}
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
                  label={t('forgotPassword.emailLabel')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{ mb: 2 }}
                  autoFocus
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ mb: 2 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : t('forgotPassword.submit')}
                </Button>
                <Link component={RouterLink} to="/login" variant="body2" display="block" textAlign="center">
                  {t('forgotPassword.backToLogin')}
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ForgotPassword;
