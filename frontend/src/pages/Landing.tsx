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
import { useTranslation } from 'react-i18next';
import PublicLayout from '@/components/layout/PublicLayout';
import { pricingPlans } from '@/data/mockData';

const Landing: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const features = [
    {
      icon: <UploadIcon sx={{ fontSize: 40 }} />,
      title: t('landing.features.upload.title'),
      description: t('landing.features.upload.description'),
    },
    {
      icon: <AIIcon sx={{ fontSize: 40 }} />,
      title: t('landing.features.extraction.title'),
      description: t('landing.features.extraction.description'),
    },
    {
      icon: <ChatIcon sx={{ fontSize: 40 }} />,
      title: t('landing.features.chat.title'),
      description: t('landing.features.chat.description'),
    },
    {
      icon: <AuditIcon sx={{ fontSize: 40 }} />,
      title: t('landing.features.audit.title'),
      description: t('landing.features.audit.description'),
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
                {t('landing.hero.title')}{' '}
                <Box component="span" sx={{ color: 'primary.main' }}>
                  {t('landing.hero.titleHighlight')}
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
                {t('landing.hero.subtitle')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/signup')}
                  endIcon={<ArrowIcon />}
                  sx={{ px: 4, py: 1.5 }}
                >
                  {t('landing.hero.startTrial')}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  href="#demo"
                  sx={{ px: 4, py: 1.5 }}
                >
                  {t('landing.hero.bookDemo')}
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('landing.hero.noCard')}
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
                      <Typography color="text.secondary">{t('landing.demo.pdfPreview')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">{t('landing.demo.supplierName')}</Typography>
                        <Box sx={{ p: 1, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                          <Typography variant="body2">Acme Corporation</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">{t('landing.demo.totalAmount')}</Typography>
                        <Box sx={{ p: 1, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                          <Typography variant="body2">€5,355.00</Typography>
                        </Box>
                      </Box>
                      <Chip label={t('landing.demo.confidence')} color="success" size="small" />
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
              {t('landing.features.sectionTitle')}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
              {t('landing.features.sectionSubtitle')}
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
              {t('landing.demoSection.title')}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
              {t('landing.demoSection.subtitle')}
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
                {t('landing.demoSection.clickToWatch')}
              </Typography>
            </Box>
          </Paper>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/signup')}
            >
              {t('landing.demoSection.tryYourself')}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>
              {t('landing.pricing.title')}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
              {t('landing.pricing.subtitle')}
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
                      <Chip label={t('landing.pricing.mostPopular')} color="primary" size="small" />
                    </Box>
                  )}
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
                      {plan.name === 'Starter' ? t('landing.pricing.planStarter') : plan.name === 'Pro' ? t('landing.pricing.planPro') : t('landing.pricing.planEnterprise')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 40 }}>
                      {plan.name === 'Starter' ? t('landing.pricing.planStarterDesc') : plan.name === 'Pro' ? t('landing.pricing.planProDesc') : t('landing.pricing.planEnterpriseDesc')}
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
                          {t('landing.pricing.contactUs')}
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
                      {plan.price !== null ? t('landing.pricing.startFreeTrial') : t('landing.pricing.contactSales')}
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
              {t('landing.cta.title')}
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, fontWeight: 400 }}>
              {t('landing.cta.subtitle')}
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
                {t('landing.cta.startTrial')}
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
                {t('landing.cta.bookDemo')}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Landing;
