import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
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
import { apiClient } from '@/api/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { PUBLIC_PLANS, getPlanFeatureKeys, PublicPlanKey } from '@/data/planDisplayConfig';
import demo1 from '../../public/Demo/dashboard.png';
import demo2 from '../../public/Demo/invoice-list.png';
import demo3 from '../../public/Demo/invoice-detail.png';
import demo4 from '../../public/Demo/invoice-chat.png';

const demoScreens = [
  demo1,
  demo2,
  demo3,
  demo4,
];

const Landing: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeDemoIndex, setActiveDemoIndex] = useState(0);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSubmitError, setContactSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (demoScreens.length <= 1) return;
    const id = setInterval(() => {
      setActiveDemoIndex((prev) => (prev + 1) % demoScreens.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

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
                          <Typography variant="body2">Test Corporation</Typography>
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
              maxWidth: 1100,
              mx: 'auto',
            }}
          >
            <Box sx={{ p: 2, bgcolor: 'grey.900', display: 'flex', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FF5F56' }} />
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFBD2E' }} />
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#27C93F' }} />
            </Box>
            <Box
              sx={{
                height: { xs: 360, md: 520 },
                bgcolor: 'grey.100',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: { xs: 1.5, md: 3 },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                {demoScreens.map((src, index) => (
                  <Box
                    key={src}
                    component="img"
                    src={src}
                    alt="Invoice Desk demo screen"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      backgroundColor: 'grey.100',
                      opacity: index === activeDemoIndex ? 1 : 0,
                      transition: 'opacity 500ms ease-in-out',
                    }}
                  />
                ))}
              </Box>
              {demoScreens.length > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
                  {demoScreens.map((_, index) => (
                    <Box
                      key={index}
                      onClick={() => setActiveDemoIndex(index)}
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: index === activeDemoIndex ? 'primary.main' : 'grey.400',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </Box>
              )}
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
            {PUBLIC_PLANS.map(({ key, price, period, highlighted }) => {
              const planKey: PublicPlanKey = key;
              const displayName =
                planKey === 'starter'
                  ? t('landing.pricing.planStarter')
                  : planKey === 'pro'
                    ? t('landing.pricing.planPro')
                    : t('landing.pricing.planEnterprise');
              const description =
                planKey === 'starter'
                  ? t('landing.pricing.planStarterDesc')
                  : planKey === 'pro'
                    ? t('landing.pricing.planProDesc')
                    : t('landing.pricing.planEnterpriseDesc');
              const featureKeys = getPlanFeatureKeys(planKey);
              const features = featureKeys.map((featureKey) => t(featureKey));

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={planKey}>
                  <Card
                    sx={{
                      height: '100%',
                      position: 'relative',
                      border: highlighted ? '2px solid' : '1px solid',
                      borderColor: highlighted ? 'primary.main' : 'divider',
                      transform: highlighted ? 'scale(1.05)' : 'none',
                      zIndex: highlighted ? 1 : 0,
                    }}
                  >
                    {highlighted && (
                      <Box
                        sx={{
                          position: 'absolute',
                          // top: -12,
                          mt: 1,
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <Chip label={t('landing.pricing.mostPopular')} color="primary" size="small" />
                      </Box>
                    )}
                    <CardContent sx={{ p: 4 }}>
                      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
                        {displayName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 40 }}>
                        {description}
                      </Typography>
                      <Box sx={{ mb: 3 }}>
                        {price !== null ? (
                          <>
                            <Typography
                              component="span"
                              variant="h3"
                              sx={{ fontWeight: 700 }}
                            >
                              €{price}
                            </Typography>
                            <Typography
                              component="span"
                              variant="body1"
                              color="text.secondary"
                            >
                              /{period}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {t('landing.pricing.contactUs')}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant={highlighted ? 'contained' : 'outlined'}
                        fullWidth
                        size="large"
                        onClick={() => {
                          if (planKey === 'enterprise') {
                            setContactEmail('');
                            setContactPhone('');
                            setContactName('');
                            setContactMessage('');
                            setContactSubmitError(null);
                            setContactDialogOpen(true);
                          } else {
                            navigate('/signup');
                          }
                        }}
                        sx={{ mb: 3 }}
                      >
                        {price !== null
                          ? planKey === 'enterprise'
                            ? t('landing.pricing.contactSales')
                            : t('landing.pricing.startFreeTrial')
                          : t('landing.pricing.contactSales')}
                      </Button>
                      <List dense>
                        {features.map((feature, featureIndex) => (
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
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Dialog
        open={contactDialogOpen}
        onClose={() => {
          if (!contactSending) setContactDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('usageBilling.contactDialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('usageBilling.contactEmail')}
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />
            <TextField
              label={t('usageBilling.contactPhone')}
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              required
              fullWidth
              autoComplete="tel"
            />
            <TextField
              label={t('usageBilling.contactName')}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              fullWidth
              autoComplete="name"
            />
            <TextField
              label={t('usageBilling.contactMessage')}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            {contactSubmitError && (
              <Typography variant="body2" color="error">
                {contactSubmitError}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)} disabled={contactSending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const email = contactEmail.trim();
              const phone = contactPhone.trim();
              if (!email || !phone) {
                setContactSubmitError(t('usageBilling.contactError'));
                return;
              }
              setContactSending(true);
              setContactSubmitError(null);
              try {
                await apiClient.post('/api/contact', {
                  email,
                  phone,
                  name: contactName.trim() || undefined,
                  message: contactMessage.trim() || undefined,
                });
                setContactDialogOpen(false);
              } catch (err: any) {
                setContactSubmitError(err?.response?.data?.error ?? t('usageBilling.contactError'));
              } finally {
                setContactSending(false);
              }
            }}
            disabled={contactSending}
          >
            {t('usageBilling.contactSubmit')}
          </Button>
        </DialogActions>
      </Dialog>

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
                onClick={() => {
                  setContactEmail('');
                  setContactPhone('');
                  setContactName('');
                  setContactMessage('');
                  setContactSubmitError(null);
                  setContactDialogOpen(true);
                }}
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
