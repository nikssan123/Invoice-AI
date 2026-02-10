import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, LinearProgress, Divider, Chip, List, ListItem, ListItemText, Link, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid';
import { TrendingUp as TrendingUpIcon, Receipt as ReceiptIcon, CalendarToday as CalendarIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/client';

type BillingSummary = {
  plan: 'starter' | 'pro' | 'enterprise';
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  monthlyInvoiceLimit: number;
  invoicesUsedThisPeriod: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  scheduledDowngradeTo?: 'starter' | null;
  scheduledDowngradeAt?: string | null;
  cancelAtPeriodEnd?: boolean;
};

type BillingInvoiceItem = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
};

type PaymentMethodInfo = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null;

const UsageBilling: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<BillingInvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [upgradePreview, setUpgradePreview] = useState<{ amountCents: number; currency: string } | null>(null);
  const [downgradePreview, setDowngradePreview] = useState<{ nextAmountCents: number; currency: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get('checkout');
    if (q === 'success') {
      setCheckoutSuccess(true);
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<BillingSummary>('/api/billing/summary');
        setSummary(res.data);
      } catch (err: any) {
        const message = err?.response?.data?.error ?? t('usageBilling.errorLoading');
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<BillingInvoiceItem[]>('/api/billing/invoices');
        if (!cancelled) setPaymentHistory(res.data ?? []);
      } catch {
        if (!cancelled) setPaymentHistory([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<PaymentMethodInfo>('/api/billing/payment-method');
        if (!cancelled) setPaymentMethod(res.data ?? null);
      } catch {
        if (!cancelled) setPaymentMethod(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleUpdatePaymentMethod = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const res = await apiClient.post<{ url: string }>('/api/billing/customer-portal', { returnUrl });
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(t('usageBilling.errorLoading'));
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('usageBilling.errorLoading'));
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (summary?.plan !== 'starter' || summary?.subscriptionStatus !== 'active') {
      setUpgradePreview(null);
      return;
    }
    let cancelled = false;
    apiClient.get<{ amountCents: number; currency: string }>('/api/billing/upgrade-preview').then((res) => {
      if (!cancelled) setUpgradePreview(res.data ?? null);
    }).catch(() => { if (!cancelled) setUpgradePreview(null); });
    return () => { cancelled = true; };
  }, [summary?.plan, summary?.subscriptionStatus]);

  useEffect(() => {
    if (summary?.plan !== 'pro') {
      setDowngradePreview(null);
      return;
    }
    let cancelled = false;
    apiClient.get<{ nextAmountCents: number; currency: string }>('/api/billing/downgrade-preview').then((res) => {
      if (!cancelled) setDowngradePreview(res.data ?? null);
    }).catch(() => { if (!cancelled) setDowngradePreview(null); });
    return () => { cancelled = true; };
  }, [summary?.plan]);

  const formatAmountFromCents = (cents: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toLowerCase() }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency}`;
    }
  };

  const used = summary?.invoicesUsedThisPeriod ?? 0;
  const limit = summary?.monthlyInvoiceLimit ?? 0;
  const usagePercentage = limit > 0 ? (used / limit) * 100 : 0;
  const remaining = limit > 0 ? Math.max(limit - used, 0) : 0;

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const formatAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toLowerCase() }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  const currentPlanLabel =
    summary?.plan === 'starter'
      ? 'Starter'
      : summary?.plan === 'pro'
        ? 'Pro'
        : 'Enterprise';

  const canCancelSubscription =
    summary != null &&
    summary.subscriptionStatus === 'active' &&
    (summary.plan === 'starter' || summary.plan === 'pro');

  const handleCancelSubscription = () => {
    setCancelError(null);
    setSuccessMessage(null);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancelSubscription = async () => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      await apiClient.post('/api/billing/cancel-subscription');
      const res = await apiClient.get<BillingSummary>('/api/billing/summary');
      setSummary(res.data);
      setSuccessMessage(null);
      setCancelDialogOpen(false);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? t('usageBilling.cancelError');
      setCancelError(message);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>{t('usageBilling.title')}</Typography>
        <Typography variant="body1" color="text.secondary">{t('usageBilling.subtitle')}</Typography>
      </Box>

      {checkoutSuccess && (
        <Card sx={{ mb: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CardContent>
            <Typography variant="body2">{t('usageBilling.checkoutSuccess')}</Typography>
          </CardContent>
        </Card>
      )}
      {successMessage && (
        <Card sx={{ mb: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CardContent>
            <Typography variant="body2">{successMessage}</Typography>
          </CardContent>
        </Card>
      )}
      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">{t('usageBilling.currentPlan')}</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {currentPlanLabel}
                  </Typography>
                </Box>
                {summary && (
                  <Chip
                    label={
                      summary.subscriptionStatus === 'active'
                        ? t('usageBilling.active')
                        : summary.subscriptionStatus === 'past_due'
                          ? t('usageBilling.pastDue')
                          : t('usageBilling.canceled')
                    }
                    color={summary.subscriptionStatus === 'active' ? 'success' : 'warning'}
                  />
                )}
              </Box>
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('usageBilling.documentsProcessed')}</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {used} / {limit}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={usagePercentage}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      bgcolor: usagePercentage > 80 ? 'warning.main' : 'primary.main',
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {remaining} {t('usageBilling.documentsRemaining')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {t('usageBilling.limitResetHelper')}
                </Typography>
              </Box>
              {canCancelSubscription && (
                <Box sx={{ mt: 2 }}>
                  <Button color="error" variant="outlined" size="small" onClick={handleCancelSubscription}>
                    {t('usageBilling.cancelSubscription')}
                  </Button>
                </Box>
              )}
              <Divider sx={{ my: 3 }} />
              <Grid container spacing={3}>
                {[
                  {
                    icon: <ReceiptIcon />,
                    label: t('usageBilling.billingCycle'),
                    value: t('usageBilling.billingCycleMonthly'),
                    bg: 'success.50',
                    color: 'success.main',
                  },
                  {
                    icon: <CalendarIcon />,
                    label: t('usageBilling.nextBillingDate'),
                    value: formatDate(summary?.currentPeriodEnd ?? null),
                    bg: 'warning.50',
                    color: 'warning.main',
                  },
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
          {summary?.scheduledDowngradeTo === 'starter' && summary?.scheduledDowngradeAt && (
            <Card sx={{ borderColor: 'info.main', borderWidth: 1, borderStyle: 'solid', bgcolor: 'info.50' }}>
              <CardContent>
                <Typography variant="body2">
                  {t('usageBilling.scheduledDowngradeMessage', { date: formatDate(summary.scheduledDowngradeAt) })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('usageBilling.scheduledDowngradeHint')}
                </Typography>
              </CardContent>
            </Card>
          )}
          {summary?.cancelAtPeriodEnd && summary?.currentPeriodEnd && (
            <Card sx={{ borderColor: 'warning.main', borderWidth: 1, borderStyle: 'solid', bgcolor: 'warning.50' }}>
              <CardContent>
                <Typography variant="body2">
                  {t('usageBilling.cancelAtPeriodEndMessage', { date: formatDate(summary.currentPeriodEnd) })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('usageBilling.cancelAtPeriodEndHint')}
                </Typography>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                {t('usageBilling.availablePlans')}
              </Typography>
              <Grid container spacing={2}>
                {(['starter', 'pro', 'enterprise'] as const).map((planKey) => {
                  const isCurrent = summary?.plan === planKey;
                  const isSubscriptionCanceled = summary?.subscriptionStatus === 'canceled';
                  const cancelAtPeriodEnd = summary?.cancelAtPeriodEnd === true;
                  const canReactivate = cancelAtPeriodEnd && isCurrent;
                  const isScheduledDowngrade = summary?.scheduledDowngradeTo === 'starter';
                  const canCancelScheduledDowngrade = planKey === 'pro' && isScheduledDowngrade;
                  const isDowngrade = summary?.plan === 'pro' && planKey === 'starter';
                  const downgradeAlreadyScheduled = isDowngrade && summary?.scheduledDowngradeTo === 'starter';
                  const displayName =
                    planKey === 'starter' ? 'Starter' : planKey === 'pro' ? 'Pro' : 'Enterprise';
                  const isEnterprise = planKey === 'enterprise';

                  const featureKeys =
                    planKey === 'starter'
                      ? ['usageBilling.planStarterFeature1', 'usageBilling.planStarterFeature2', 'usageBilling.planStarterFeature3']
                      : planKey === 'pro'
                        ? ['usageBilling.planProFeature1', 'usageBilling.planProFeature2', 'usageBilling.planProFeature3']
                        : ['usageBilling.planEnterpriseFeature1', 'usageBilling.planEnterpriseFeature2', 'usageBilling.planEnterpriseFeature3'];
                  const features = featureKeys.map((key) => t(key));

                  const buttonLabel = canCancelScheduledDowngrade
                    ? t('usageBilling.stayOnPro')
                    : canReactivate
                      ? t('usageBilling.keepPlan')
                      : downgradeAlreadyScheduled
                        ? t('usageBilling.downgradeScheduledShort')
                        : isSubscriptionCanceled && isCurrent
                          ? t('usageBilling.resubscribe')
                          : isSubscriptionCanceled && !isEnterprise
                            ? t('usageBilling.switchToPlan', { plan: displayName })
                            : isCurrent
                              ? t('usageBilling.currentPlanLabel')
                              : isEnterprise
                                ? t('usageBilling.contactSales')
                                : planKey === 'starter'
                                  ? t('usageBilling.downgrade')
                                  : t('usageBilling.upgrade');

                  const isUpgradeWithActiveSub =
                    summary?.plan === 'starter' &&
                    planKey === 'pro' &&
                    summary?.subscriptionStatus === 'active';

                  const handleClick = async () => {
                    if (downgradeAlreadyScheduled) {
                      return;
                    }
                    if (canReactivate) {
                      setError(null);
                      try {
                        await apiClient.post('/api/billing/reactivate-subscription');
                        setSuccessMessage(t('usageBilling.reactivateSuccess'));
                        const sumRes = await apiClient.get<BillingSummary>('/api/billing/summary');
                        setSummary(sumRes.data);
                      } catch (err: any) {
                        setError(err?.response?.data?.error ?? t('usageBilling.errorLoading'));
                      }
                      return;
                    }
                    if (canCancelScheduledDowngrade) {
                      setError(null);
                      try {
                        const res = await apiClient.post<{ success: boolean; url?: string }>('/api/billing/upgrade', { plan: 'pro' });
                        if (res.data?.url) {
                          window.location.href = res.data.url;
                          return;
                        }
                        setSuccessMessage(t('usageBilling.upgradeSuccess'));
                        const sumRes = await apiClient.get<BillingSummary>('/api/billing/summary');
                        setSummary(sumRes.data);
                      } catch (err: any) {
                        setError(err?.response?.data?.error ?? t('usageBilling.errorLoading'));
                      }
                      return;
                    }
                    if (!isSubscriptionCanceled && !cancelAtPeriodEnd && (isCurrent || isEnterprise)) return;
                    setError(null);
                    try {
                      if (isSubscriptionCanceled) {
                        const res = await apiClient.post<{ url: string }>(
                          '/api/billing/create-checkout-session',
                          { plan: planKey }
                        );
                        if (res.data?.url) window.location.href = res.data.url;
                        else setError(t('usageBilling.errorLoading'));
                      } else if (isDowngrade) {
                        await apiClient.post('/api/billing/schedule-downgrade', {
                          plan: 'starter',
                        });
                        setSuccessMessage(t('usageBilling.downgradeScheduled'));
                        const res = await apiClient.get<BillingSummary>('/api/billing/summary');
                        setSummary(res.data);
                      } else if (isUpgradeWithActiveSub) {
                        try {
                          const res = await apiClient.post<{ success: boolean; url?: string }>(
                            '/api/billing/upgrade',
                            { plan: 'pro' }
                          );
                          if (res.data.url) {
                            window.location.href = res.data.url;
                            return;
                          }
                          setSuccessMessage(t('usageBilling.upgradeSuccess'));
                          const sumRes = await apiClient.get<BillingSummary>('/api/billing/summary');
                          setSummary(sumRes.data);
                        } catch (upgradeErr: any) {
                          const msg = upgradeErr?.response?.data?.error ?? '';
                          if (upgradeErr?.response?.status === 400 && typeof msg === 'string' && msg.includes('No active subscription')) {
                            const checkoutRes = await apiClient.post<{ url: string }>('/api/billing/create-checkout-session', { plan: 'pro' });
                            if (checkoutRes.data?.url) window.location.href = checkoutRes.data.url;
                            else setError(t('usageBilling.errorLoading'));
                          } else {
                            setError(msg || t('usageBilling.errorLoading'));
                          }
                        }
                      } else {
                        const res = await apiClient.post<{ url: string }>(
                          '/api/billing/create-checkout-session',
                          { plan: planKey }
                        );
                        if (res.data?.url) {
                          window.location.href = res.data.url;
                        }
                      }
                    } catch (err: any) {
                      const message = err?.response?.data?.error ?? t('usageBilling.errorLoading');
                      setError(message);
                    }
                  };

                  return (
                    <Grid key={planKey} size={{ xs: 12, md: 4 }}>
                      <Card
                        variant="outlined"
                        sx={{
                          height: '100%',
                          borderColor: isCurrent ? 'primary.main' : 'divider',
                          borderWidth: isCurrent ? 2 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <CardContent
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            pb: 2,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 2,
                            }}
                          >
                            <Typography variant="h6" fontWeight={600}>
                              {displayName}
                            </Typography>
                            {isCurrent && !downgradeAlreadyScheduled && !isSubscriptionCanceled && !cancelAtPeriodEnd && (
                              <Chip label={t('usageBilling.current')} color="primary" size="small" />
                            )}
                          </Box>
                          <List dense sx={{ mb: 2, pl: 2, flex: '0 0 auto' }}>
                            {features.map((f, idx) => (
                              <ListItem key={featureKeys[idx]} sx={{ py: 0.25, px: 0 }}>
                                <ListItemText
                                  primary={f}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                          {isUpgradeWithActiveSub && upgradePreview && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flex: '0 0 auto' }}>
                              {t('usageBilling.upgradeProrated', { amount: formatAmountFromCents(upgradePreview.amountCents, upgradePreview.currency) })}
                            </Typography>
                          )}
                          {isDowngrade && downgradePreview && !downgradeAlreadyScheduled && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flex: '0 0 auto' }}>
                              {t('usageBilling.downgradeNextMonth', { amount: formatAmountFromCents(downgradePreview.nextAmountCents, downgradePreview.currency) })}
                            </Typography>
                          )}
                          <Box sx={{ flex: 1, minHeight: 8 }} />
                          <Button
                            variant={canCancelScheduledDowngrade || canReactivate || isSubscriptionCanceled ? 'contained' : isCurrent && !downgradeAlreadyScheduled ? 'outlined' : 'contained'}
                            fullWidth
                            disabled={!canCancelScheduledDowngrade && !canReactivate && !isSubscriptionCanceled && (isCurrent || isEnterprise || downgradeAlreadyScheduled || loading)}
                            onClick={handleClick}
                          >
                            {buttonLabel}
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>{t('usageBilling.billingHistory')}</Typography>
              <List>
                {paymentHistory.length === 0 ? (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText primary={t('usageBilling.noPaymentsYet')} primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }} />
                  </ListItem>
                ) : (
                  paymentHistory.map((inv, i) => (
                    <ListItem key={inv.id} sx={{ px: 0, borderBottom: i < paymentHistory.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                      <ListItemText
                        primary={formatDate(inv.date)}
                        secondary={formatAmount(inv.amount, inv.currency)}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'body2' }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {inv.hostedInvoiceUrl && (
                          <Link href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                            {t('usageBilling.viewInvoice')}
                          </Link>
                        )}
                        <Chip label={t('usageBilling.paid')} color="success" size="small" variant="outlined" />
                      </Box>
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>{t('usageBilling.paymentMethod')}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                {paymentMethod ? (
                  <>
                    <Box sx={{ width: 48, height: 32, bgcolor: 'primary.main', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700 }}>
                      {paymentMethod.brand}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>•••• •••• •••• {paymentMethod.last4}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('usageBilling.expires')} {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">{t('usageBilling.noPaymentMethod')}</Typography>
                )}
              </Box>
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
                onClick={handleUpdatePaymentMethod}
                disabled={portalLoading}
                startIcon={portalLoading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {portalLoading ? t('usageBilling.openingPortal') : t('usageBilling.updatePaymentMethod')}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Dialog
        open={cancelDialogOpen}
        onClose={() => {
          if (!cancelLoading) setCancelDialogOpen(false);
        }}
      >
        <DialogTitle>{t('usageBilling.cancelSubscription')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('usageBilling.cancelSubscriptionConfirm')}
          </Typography>
          {cancelError && (
            <Typography variant="body2" color="error">
              {cancelError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>
            {t('usageBilling.keepPlan')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmCancelSubscription}
            disabled={cancelLoading}
            startIcon={cancelLoading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {cancelLoading ? t('usageBilling.canceling') : t('usageBilling.confirmCancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsageBilling;
