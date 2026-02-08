import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
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
  Chat as ChatIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mockDashboardStats, mockRecentActivity } from '@/data/mockData';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const stats = [
    { title: t('dashboard.stats.invoicesProcessed'), value: mockDashboardStats.invoicesProcessed, icon: <ReceiptIcon />, color: '#1565C0', bgColor: '#E3F2FD' },
    { title: t('dashboard.stats.pendingApprovals'), value: mockDashboardStats.pendingApprovals, icon: <PendingIcon />, color: '#F57C00', bgColor: '#FFF3E0' },
    { title: t('dashboard.stats.approvedInvoices'), value: mockDashboardStats.approvedInvoices, icon: <ApprovedIcon />, color: '#2E7D32', bgColor: '#E8F5E9' },
    { title: t('dashboard.stats.subscriptionPlan'), value: mockDashboardStats.subscriptionPlan, icon: <PlanIcon />, color: '#7B1FA2', bgColor: '#F3E5F5' },
  ];

  const getActivityIcon = (action: string) => {
    if (action.includes('uploaded')) return <UploadIcon />;
    if (action.includes('approved')) return <ApprovedIcon />;
    if (action.includes('updated')) return <EditIcon />;
    if (action.includes('Chat')) return <ChatIcon />;
    return <DocIcon />;
  };

  const getActivityColor = (action: string) => {
    if (action.includes('uploaded')) return 'primary.main';
    if (action.includes('approved')) return 'success.main';
    if (action.includes('updated')) return 'warning.main';
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
              <List sx={{ p: 0 }}>
                {mockRecentActivity.map((activity, index) => (
                  <ListItem key={activity.id} sx={{ px: 0, borderBottom: index < mockRecentActivity.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'grey.100', color: getActivityColor(activity.action) }}>{getActivityIcon(activity.action)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="subtitle2">{activity.action}</Typography><Typography variant="caption" color="text.secondary">{t('dashboard.by')} {activity.user}</Typography></Box>}
                      secondary={activity.description}
                    />
                    <Typography variant="caption" color="text.secondary">{formatTime(activity.timestamp)}</Typography>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>{t('dashboard.quickStats')}</Typography>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('dashboard.monthlyUsage')}</Typography>
                  <Typography variant="body2" fontWeight={600}>247 / 500</Typography>
                </Box>
                <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ width: '49.4%', height: '100%', bgcolor: 'primary.main', borderRadius: 4 }} />
                </Box>
              </Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('dashboard.approvalRate')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" fontWeight={700} color="success.main">95.1%</Typography>
                  <Chip label="+2.3%" color="success" size="small" />
                </Box>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('dashboard.avgProcessingTime')}</Typography>
                <Typography variant="h5" fontWeight={700}>2.3 min</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
