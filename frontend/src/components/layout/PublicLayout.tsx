import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  useScrollTrigger,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 50,
  });

  const navItems = [
    { label: 'Product', href: '#product' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Demo', href: '#demo' },
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
                component="span"
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                IV
              </Box>
              InvoiceAI
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
                  Go to Dashboard
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
                    Login
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/signup"
                    variant="contained"
                    color="primary"
                    sx={{ ml: 1 }}
                  >
                    Start Free Trial
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
                InvoiceAI
              </Typography>
              <Typography variant="body2" sx={{ maxWidth: 300 }}>
                AI-powered invoice processing with human approval. 
                Streamline your accounts payable workflow.
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', mb: 1.5, fontWeight: 600 }}>
                Product
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Features</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Pricing</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Security</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', mb: 1.5, fontWeight: 600 }}>
                Company
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>About</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Blog</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Careers</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', mb: 1.5, fontWeight: 600 }}>
                Legal
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Privacy Policy</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Terms of Service</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>GDPR</Typography>
            </Box>
          </Box>
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'grey.800' }}>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              © {new Date().getFullYear()} InvoiceAI. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default PublicLayout;
