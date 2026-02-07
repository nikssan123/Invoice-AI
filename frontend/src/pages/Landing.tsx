import React from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AutoAwesome as AIIcon,
  Chat as ChatIcon,
  History as AuditIcon,
  Check as CheckIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '@/components/layout/PublicLayout';
import { pricingPlans } from '@/data/mockData';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <UploadIcon sx={{ fontSize: 40 }} />,
      title: 'Invoice Upload',
      description: 'Drag & drop single or bulk invoices. Supports PDF, images, and scanned documents.',
    },
    {
      icon: <AIIcon sx={{ fontSize: 40 }} />,
      title: 'AI Data Extraction',
      description: 'Advanced OCR and ML models extract key fields with confidence scoring.',
    },
    {
      icon: <ChatIcon sx={{ fontSize: 40 }} />,
      title: 'Document Chat',
      description: 'Ask questions about any invoice. AI answers and can update extracted data.',
    },
    {
      icon: <AuditIcon sx={{ fontSize: 40 }} />,
      title: 'Audit Trail',
      description: 'Complete history of all changes, approvals, and chat interactions.',
    },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <Box
        id="product"
        sx={{
          pt: { xs: 8, md: 12 },
          pb: { xs: 10, md: 14 },
          background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography
                variant="h1"
                sx={{
                  mb: 3,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.1,
                  color: 'text.primary',
                }}
              >
                AI-Powered Invoice Processing with{' '}
                <Box component="span" sx={{ color: 'primary.main' }}>
                  Human Approval
                </Box>
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  mb: 4,
                  color: 'text.secondary',
                  fontWeight: 400,
                  lineHeight: 1.6,
                }}
              >
                Extract, validate, and approve invoices in minutes.
                Our AI handles the heavy lifting while you maintain full control.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/signup')}
                  endIcon={<ArrowIcon />}
                  sx={{ px: 4, py: 1.5 }}
                >
                  Start Free Trial
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  href="#demo"
                  sx={{ px: 4, py: 1.5 }}
                >
                  Book Demo
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                No credit card required • 14-day free trial
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                elevation={8}
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'white',
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'grey.200' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FF5F56' }} />
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFBD2E' }} />
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#27C93F' }} />
                  </Box>
                </Box>
                <Box sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Box sx={{ flex: 1, p: 2, bgcolor: 'grey.100', borderRadius: 2, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography color="text.secondary">PDF Preview</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">Supplier Name</Typography>
                        <Box sx={{ p: 1, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                          <Typography variant="body2">Acme Corporation</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                        <Box sx={{ p: 1, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                          <Typography variant="body2">€5,355.00</Typography>
                        </Box>
                      </Box>
                      <Chip label="98% Confidence" color="success" size="small" />
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>
              Everything you need for invoice processing
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
              From upload to approval, our platform handles the entire workflow with AI assistance.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    textAlign: 'center',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Demo Section */}
      <Box id="demo" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'grey.50' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>
              See it in action
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
              Watch how InvoiceAI processes documents in real-time.
            </Typography>
          </Box>

          <Paper
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              maxWidth: 900,
              mx: 'auto',
            }}
          >
            <Box sx={{ p: 2, bgcolor: 'grey.900', display: 'flex', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FF5F56' }} />
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFBD2E' }} />
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#27C93F' }} />
            </Box>
            <Box sx={{
              height: 400,
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}>
                <Box
                  sx={{
                    width: 0,
                    height: 0,
                    borderTop: '15px solid transparent',
                    borderBottom: '15px solid transparent',
                    borderLeft: '25px solid white',
                    ml: 1,
                  }}
                />
              </Box>
              <Typography variant="body1" color="text.secondary">
                Click to watch demo video
              </Typography>
            </Box>
          </Paper>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/signup')}
            >
              Try It Yourself
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>
              Simple, transparent pricing
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
              Start free, upgrade when you're ready. No hidden fees.
            </Typography>
          </Box>

          <Grid container spacing={4} justifyContent="center">
            {pricingPlans.map((plan, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    border: plan.highlighted ? '2px solid' : '1px solid',
                    borderColor: plan.highlighted ? 'primary.main' : 'divider',
                    transform: plan.highlighted ? 'scale(1.05)' : 'none',
                    zIndex: plan.highlighted ? 1 : 0,
                  }}
                >
                  {plan.highlighted && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <Chip label="Most Popular" color="primary" size="small" />
                    </Box>
                  )}
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 40 }}>
                      {plan.description}
                    </Typography>
                    <Box sx={{ mb: 3 }}>
                      {plan.price !== null ? (
                        <>
                          <Typography
                            component="span"
                            variant="h3"
                            sx={{ fontWeight: 700 }}
                          >
                            ${plan.price}
                          </Typography>
                          <Typography
                            component="span"
                            variant="body1"
                            color="text.secondary"
                          >
                            /{plan.period}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          Contact us
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant={plan.highlighted ? 'contained' : 'outlined'}
                      fullWidth
                      size="large"
                      onClick={() => navigate('/signup')}
                      sx={{ mb: 3 }}
                    >
                      {plan.price !== null ? 'Start Free Trial' : 'Contact Sales'}
                    </Button>
                    <List dense>
                      {plan.features.map((feature, featureIndex) => (
                        <ListItem key={featureIndex} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={feature}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: { xs: 8, md: 10 },
          background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
          color: 'white',
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ mb: 2, fontWeight: 700, color: 'inherit' }}>
              Ready to streamline your invoice processing?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, fontWeight: 400 }}>
              Join 500+ companies already using InvoiceAI to save time and reduce errors.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/signup')}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
              >
                Start Free Trial
              </Button>
              <Button
                variant="outlined"
                size="large"
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Book Demo
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Landing;
