import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  Alert,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Receipt as ReceiptIcon,
  HourglassEmpty as PendingIcon,
  CheckCircle as ApprovedIcon,
  Star as PlanIcon,
  Description as DocIcon,
  Edit as EditIcon,
  Upload as UploadIcon,
  Folder as FolderIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mockDashboardStats } from '@/data/mockData';
import { apiClient } from '@/api/client';

interface InvoiceStats {
  total: number;
  pending: number;
  approved: number;
  needs_review: number;
  avgProcessingTimeSeconds: number | null;
}

export interface ActivityRow {
  id: string;
  organizationId: string;
  userId: string;
  userName: string | null;
  actionType: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

const ACTION_LABELS: Record<string, string> = {
  INVOICE_UPLOADED: 'Invoice uploaded',
  INVOICE_APPROVED: 'Invoice approved',
  INVOICE_MOVED: 'Invoice moved',
  INVOICE_DELETED: 'Invoice deleted',
  FOLDER_CREATED: 'Folder created',
  FOLDER_RENAMED: 'Folder renamed',
  FOLDER_DELETED: 'Folder deleted',
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [billingSummary, setBillingSummary] = useState<{
    plan: 'starter' | 'pro' | 'enterprise';
    monthlyInvoiceLimit: number;
    invoicesUsedThisPeriod: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<ActivityRow[]>('/api/activities', { params: { limit: 20 } });
        if (!cancelled) setActivities(res.data ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError((e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (e as Error).message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{
          plan: 'starter' | 'pro' | 'enterprise';
          subscriptionStatus: 'active' | 'past_due' | 'canceled';
          monthlyInvoiceLimit: number;
          invoicesUsedThisPeriod: number;
        }>('/api/billing/summary');
        if (!cancelled) {
          setBillingSummary({
            plan: res.data.plan,
            monthlyInvoiceLimit: res.data.monthlyInvoiceLimit,
            invoicesUsedThisPeriod: res.data.invoicesUsedThisPeriod,
          });
        }
      } catch {
        if (!cancelled) setBillingSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<InvoiceStats>('/api/invoices/stats');
        if (!cancelled) setInvoiceStats(res.data);
      } catch {
        if (!cancelled) setInvoiceStats(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { title: t('dashboard.stats.invoicesProcessed'), value: invoiceStats != null ? invoiceStats.total : '—', icon: <ReceiptIcon />, color: '#1565C0', bgColor: '#E3F2FD' },
    { title: t('dashboard.stats.pendingApprovals'), value: invoiceStats != null ? invoiceStats.pending + invoiceStats.needs_review : '—', icon: <PendingIcon />, color: '#F57C00', bgColor: '#FFF3E0' },
    { title: t('dashboard.stats.approvedInvoices'), value: invoiceStats != null ? invoiceStats.approved : '—', icon: <ApprovedIcon />, color: '#2E7D32', bgColor: '#E8F5E9' },
    {
      title: t('dashboard.stats.subscriptionPlan'),
      value:
        billingSummary != null
          ? billingSummary.plan === 'starter'
            ? 'Starter'
            : billingSummary.plan === 'pro'
              ? 'Pro'
              : 'Enterprise'
          : mockDashboardStats.subscriptionPlan,
      icon: <PlanIcon />,
      color: '#7B1FA2',
      bgColor: '#F3E5F5',
    },
  ];

  const getActivityIcon = (actionType: string) => {
    if (actionType.includes('DELETED')) return <DeleteIcon />;
    if (actionType.includes('UPLOADED')) return <UploadIcon />;
    if (actionType.includes('APPROVED')) return <ApprovedIcon />;
    if (actionType.includes('RENAMED') || actionType.includes('MOVED')) return <EditIcon />;
    if (actionType.includes('FOLDER')) return <FolderIcon />;
    return <DocIcon />;
  };

  const getActivityColor = (actionType: string) => {
    if (actionType.includes('DELETED')) return 'error.main';
    if (actionType.includes('UPLOADED')) return 'primary.main';
    if (actionType.includes('APPROVED')) return 'success.main';
    if (actionType.includes('RENAMED') || actionType.includes('MOVED')) return 'warning.main';
    return 'grey.600';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return t('dashboard.justNow');
    if (diffHours < 24) return t('dashboard.hoursAgo', { count: diffHours });
    return date.toLocaleDateString();
  };

  const actionLabel = (actionType: string) => ACTION_LABELS[actionType] ?? actionType;
  const displayUser = (a: ActivityRow) => a.userName?.trim() || a.userId || '—';

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>{t('dashboard.title')}</Typography>
        <Typography variant="body1" color="text.secondary">{t('dashboard.welcomeBack')}</Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{stat.title}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{stat.value}</Typography>
                  </Box>
                  <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: stat.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>{t('dashboard.recentActivity')}</Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {t('dashboard.errorLoadingActivity')}
                </Alert>
              )}
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 3 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">{t('dashboard.loadingActivity')}</Typography>
                </Box>
              ) : activities.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>{t('dashboard.noRecentActivity')}</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('dashboard.action')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('dashboard.entity')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('dashboard.user')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">{t('dashboard.time')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'grey.100', color: getActivityColor(activity.actionType) }}>
                              {getActivityIcon(activity.actionType)}
                            </Avatar>
                            <Typography variant="body2">{actionLabel(activity.actionType)}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {activity.entityName ?? activity.entityId ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{displayUser(activity)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(activity.timestamp)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>{t('dashboard.quickStats')}</Typography>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.monthlyUsage')}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {billingSummary
                      ? `${billingSummary.invoicesUsedThisPeriod} / ${billingSummary.monthlyInvoiceLimit}`
                      : '—'}
                  </Typography>
                </Box>
                <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 4, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width:
                        billingSummary && billingSummary.monthlyInvoiceLimit > 0
                          ? `${Math.min(
                              (billingSummary.invoicesUsedThisPeriod /
                                billingSummary.monthlyInvoiceLimit) *
                                100,
                              100,
                            )}%`
                          : '0%',
                      height: '100%',
                      bgcolor: 'primary.main',
                      borderRadius: 4,
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('dashboard.approvalRate')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {invoiceStats && invoiceStats.total > 0
                      ? `${((invoiceStats.approved / invoiceStats.total) * 100).toFixed(1)}%`
                      : '—'}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('dashboard.avgProcessingTime')}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {invoiceStats?.avgProcessingTimeSeconds != null
                    ? invoiceStats.avgProcessingTimeSeconds >= 60
                      ? `${(invoiceStats.avgProcessingTimeSeconds / 60).toFixed(1)} min`
                      : `${Math.round(invoiceStats.avgProcessingTimeSeconds)} sec`
                    : '—'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
