import React from 'react';
import { Container, Typography, Box, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PublicLayout from '@/components/layout/PublicLayout';

const SECTIONS = 4;

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PublicLayout>
      <Box
        sx={{
          pt: { xs: 8, md: 10 },
          pb: 8,
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {t('privacy.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {t('privacy.lastUpdated')}
          </Typography>
          {Array.from({ length: SECTIONS }, (_, i) => i + 1).map((n) => (
            <Box key={n} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                {t(`privacy.section${n}Title`)}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {t(`privacy.section${n}Body`)}
              </Typography>
              {n < SECTIONS && <Divider sx={{ mt: 3 }} />}
            </Box>
          ))}
          <Box id="gdpr" sx={{ mb: 4, scrollMarginTop: 80 }}>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              {t('privacy.gdprTitle')}
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {t('privacy.gdprBody')}
            </Typography>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default PrivacyPolicy;
