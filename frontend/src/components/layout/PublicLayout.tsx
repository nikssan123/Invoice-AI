import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Link,
  useScrollTrigger,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 50,
  });

  const navItems = [
    { label: t('layout.public.product'), href: '#product' },
    { label: t('layout.public.pricing'), href: '#pricing' },
    { label: t('layout.public.demo'), href: '#demo' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar 
        position="fixed" 
        color="inherit"
        elevation={trigger ? 2 : 0}
        sx={{ 
          borderBottom: trigger ? 'none' : '1px solid',
          borderColor: 'divider',
          bgcolor: trigger ? 'rgba(255, 255, 255, 0.98)' : 'transparent',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            <Typography
              variant="h5"
              component={RouterLink}
              to="/"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                component="img"
                src="/InvoiceLogo.png"
                alt={t('app.brand')}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  objectFit: 'contain',
                }}
              />
              {t('app.brand')}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  href={item.href}
                  sx={{ 
                    color: 'text.primary',
                    fontWeight: 500,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  {item.label}
                </Button>
              ))}
              
              {isAuthenticated ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/dashboard')}
                  sx={{ ml: 2 }}
                >
                  {t('layout.public.goToDashboard')}
                </Button>
              ) : (
                <>
                  <Button
                    component={RouterLink}
                    to="/login"
                    sx={{ 
                      color: 'text.primary',
                      fontWeight: 500,
                      ml: 1,
                    }}
                  >
                    {t('layout.public.login')}
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/signup"
                    variant="contained"
                    color="primary"
                    sx={{ ml: 1 }}
                  >
                    {t('layout.public.startFreeTrial')}
                  </Button>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ pt: 8 }}>
        {children}
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 6,
          px: 2,
          mt: 'auto',
          bgcolor: 'grey.900',
          color: 'grey.300',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <Box>
              <Typography variant="h6" sx={{ color: 'white', mb: 2, fontWeight: 700 }}>
                {t('app.brand')}
              </Typography>
              <Typography variant="body2" sx={{ maxWidth: 300 }}>
                {t('landing.footer.tagline')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', mb: 1.5, fontWeight: 600 }}>
                {t('landing.footer.product')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{t('landing.footer.features')}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{t('landing.footer.pricing')}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{t('landing.footer.security')}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', mb: 1.5, fontWeight: 600 }}>
                {t('landing.footer.legal')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <Link component={RouterLink} to="/privacy" sx={{ color: 'inherit', textDecoration: 'none' }}>{t('landing.footer.privacyPolicy')}</Link>
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <Link component={RouterLink} to="/terms" sx={{ color: 'inherit', textDecoration: 'none' }}>{t('landing.footer.termsOfService')}</Link>
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <Link component={RouterLink} to="/privacy#gdpr" sx={{ color: 'inherit', textDecoration: 'none' }}>{t('landing.footer.gdpr')}</Link>
              </Typography>
            </Box>
          </Box>
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'grey.800' }}>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              {t('landing.footer.copyright', { year: new Date().getFullYear() })}
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default PublicLayout;
