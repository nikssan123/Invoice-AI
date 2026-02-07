import React from 'react';
import { Box, Typography, Card, CardContent, Button, LinearProgress, Divider, List, ListItem, ListItemText, Chip } from '@mui/material';
import Grid from '@mui/material/Grid';
import { TrendingUp as TrendingUpIcon, Receipt as ReceiptIcon, CalendarToday as CalendarIcon } from '@mui/icons-material';
import { mockUsageData, pricingPlans } from '@/data/mockData';

const UsageBilling: React.FC = () => {
  const usagePercentage = (mockUsageData.documentsProcessed / mockUsageData.documentsLimit) * 100;

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Usage & Billing</Typography>
        <Typography variant="body1" color="text.secondary">Monitor your usage and manage your subscription</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">Current Plan</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{mockUsageData.currentPlan}</Typography>
                </Box>
                <Chip label="Active" color="success" />
              </Box>
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Documents processed this month</Typography>
                  <Typography variant="body2" fontWeight={600}>{mockUsageData.documentsProcessed} / {mockUsageData.documentsLimit}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={usagePercentage} sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200', '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: usagePercentage > 80 ? 'warning.main' : 'primary.main' } }} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{mockUsageData.documentsLimit - mockUsageData.documentsProcessed} documents remaining</Typography>
              </Box>
              <Divider sx={{ my: 3 }} />
              <Grid container spacing={3}>
                {[
                  { icon: <ReceiptIcon />, label: 'Monthly Price', value: `$${mockUsageData.monthlyPrice}`, bg: 'primary.50', color: 'primary.main' },
                  { icon: <TrendingUpIcon />, label: 'Billing Cycle', value: mockUsageData.billingCycle, bg: 'success.50', color: 'success.main' },
                  { icon: <CalendarIcon />, label: 'Next Billing Date', value: mockUsageData.nextBillingDate, bg: 'warning.50', color: 'warning.main' },
                ].map((item, i) => (
                  <Grid key={i} size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>{item.icon}</Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                        <Typography variant="h6" fontWeight={700}>{item.value}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>Available Plans</Typography>
              <Grid container spacing={2}>
                {pricingPlans.map((plan) => (
                  <Grid key={plan.name} size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined" sx={{ height: '100%', borderColor: plan.name === mockUsageData.currentPlan ? 'primary.main' : 'divider', borderWidth: plan.name === mockUsageData.currentPlan ? 2 : 1 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6" fontWeight={600}>{plan.name}</Typography>
                          {plan.name === mockUsageData.currentPlan && <Chip label="Current" color="primary" size="small" />}
                        </Box>
                        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>{plan.price !== null ? `$${plan.price}` : 'Custom'}{plan.price !== null && <Typography component="span" variant="body2" color="text.secondary">/mo</Typography>}</Typography>
                        <List dense sx={{ mb: 2 }}>{plan.features.slice(0, 4).map((feature, idx) => <ListItem key={idx} sx={{ px: 0, py: 0.25 }}><ListItemText primary={feature} primaryTypographyProps={{ variant: 'body2' }} /></ListItem>)}</List>
                        <Button variant={plan.name === mockUsageData.currentPlan ? 'outlined' : 'contained'} fullWidth disabled={plan.name === mockUsageData.currentPlan}>{plan.name === mockUsageData.currentPlan ? 'Current Plan' : plan.price === null ? 'Contact Sales' : plan.name === 'Starter' ? 'Downgrade' : 'Upgrade'}</Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Billing History</Typography>
              <List>
                {[{ date: 'Jan 15, 2024', amount: '$99.00' }, { date: 'Dec 15, 2023', amount: '$99.00' }, { date: 'Nov 15, 2023', amount: '$99.00' }, { date: 'Oct 15, 2023', amount: '$99.00' }].map((inv, i) => (
                  <ListItem key={i} sx={{ px: 0, borderBottom: i < 3 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <ListItemText primary={inv.date} secondary={inv.amount} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} secondaryTypographyProps={{ variant: 'body2' }} />
                    <Chip label="Paid" color="success" size="small" variant="outlined" />
                  </ListItem>
                ))}
              </List>
              <Button variant="text" fullWidth sx={{ mt: 2 }}>View All Invoices</Button>
            </CardContent>
          </Card>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Payment Method</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Box sx={{ width: 48, height: 32, bgcolor: 'primary.main', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700 }}>VISA</Box>
                <Box><Typography variant="body2" fontWeight={500}>•••• •••• •••• 4242</Typography><Typography variant="caption" color="text.secondary">Expires 12/25</Typography></Box>
              </Box>
              <Button variant="outlined" fullWidth sx={{ mt: 2 }}>Update Payment Method</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UsageBilling;
