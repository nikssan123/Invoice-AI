import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Tabs,
  Tab,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { mockUsers } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/api/client';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string | null; email: string };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await apiClient.get<Invitation[]>('/api/organizations/invitations');
      setInvitations(res.data);
    } catch {
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabValue === 1) fetchInvitations();
  }, [tabValue, fetchInvitations]);

  // Organization settings
  const [orgName, setOrgName] = useState('Acme Corp');
  const [orgAddress, setOrgAddress] = useState('123 Business Street, Suite 100');

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);

  const handleInviteUser = async () => {
    setInviteError('');
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) return;
    setInviteLoading(true);
    try {
      await apiClient.post('/api/organizations/invitations', { email });
      setInviteDialogOpen(false);
      setInviteEmail('');
      await fetchInvitations();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; data?: { error?: string } } };
      setInviteError(axiosErr.response?.data?.error ?? t('settings.inviteErrorGeneric'));
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          {t('settings.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('settings.subtitle')}
        </Typography>
      </Box>

      <Card>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label={t('settings.organization')} />
          <Tab label={t('settings.users')} />
          <Tab label={t('settings.preferences')} />
        </Tabs>

        {/* Organization Tab */}
        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('settings.organizationDetails')}
            </Typography>
            <Box sx={{ maxWidth: 600 }}>
              <TextField
                fullWidth
                label={t('settings.organizationName')}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label={t('settings.businessAddress')}
                value={orgAddress}
                onChange={(e) => setOrgAddress(e.target.value)}
                multiline
                rows={2}
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label={t('settings.vatNumber')}
                defaultValue="DE123456789"
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label={t('settings.billingEmail')}
                defaultValue="billing@acmecorp.com"
                sx={{ mb: 3 }}
              />
              <Button variant="contained">
                {t('settings.saveChanges')}
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('settings.teamMembers')}
              </Typography>
              {isAdmin && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => { setInviteError(''); setInviteDialogOpen(true); }}
                >
                  {t('settings.inviteUser')}
                </Button>
              )}
            </Box>

            {invitations.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('settings.pendingInvitations')}
                </Typography>
                <TableContainer sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('settings.emailAddress')}</TableCell>
                        <TableCell>{t('settings.role')}</TableCell>
                        <TableCell>{t('settings.status')}</TableCell>
                        <TableCell>{t('settings.invitedBy')}</TableCell>
                        <TableCell>{t('settings.expiresAt')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invitationsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                            <CircularProgress size={24} />
                          </TableCell>
                        </TableRow>
                      ) : (
                        invitations.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>{inv.email}</TableCell>
                            <TableCell>
                              <Chip
                                label={inv.role === 'admin' ? t('settings.admin') : t('settings.userRole')}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={inv.status}
                                size="small"
                                color={inv.status === 'pending' ? 'warning' : 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{inv.invitedBy?.name ?? inv.invitedBy?.email ?? '—'}</TableCell>
                            <TableCell>{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Divider sx={{ my: 2 }} />
              </>
            )}

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t('settings.teamMembers')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('settings.user')}</TableCell>
                    <TableCell>{t('settings.role')}</TableCell>
                    <TableCell>{t('settings.status')}</TableCell>
                    <TableCell align="right">{t('settings.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockUsers.map((teamUser) => (
                    <TableRow key={teamUser.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {teamUser.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">
                              {teamUser.name}
                              {teamUser.email === user?.email && (
                                <Chip label={t('settings.you')} size="small" sx={{ ml: 1 }} />
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {teamUser.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={teamUser.role === 'admin' ? t('settings.admin') : t('settings.userRole')}
                          color={teamUser.role === 'admin' ? 'primary' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={t('settings.active')} color="success" size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={teamUser.email === user?.email}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </TabPanel>

        {/* Preferences Tab */}
        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('settings.notificationPreferences')}
            </Typography>
            <Box sx={{ maxWidth: 600 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">{t('settings.emailNotifications')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.emailNotificationsDesc')}
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, alignItems: 'flex-start' }}
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={weeklyReport}
                    onChange={(e) => setWeeklyReport(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">{t('settings.weeklySummaryReport')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.weeklyReportDesc')}
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, alignItems: 'flex-start' }}
              />
              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" sx={{ mt: 4, mb: 3, fontWeight: 600 }}>
                {t('settings.processingPreferences')}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">{t('settings.autoApproveHighConfidence')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.autoApproveDesc')}
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, alignItems: 'flex-start' }}
              />

              <Button variant="contained" sx={{ mt: 3 }}>
                {t('settings.savePreferences')}
              </Button>
            </Box>
          </CardContent>
        </TabPanel>
      </Card>

      {/* Invite User Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => { setInviteDialogOpen(false); setInviteError(''); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settings.inviteTeamMember')}</DialogTitle>
        <DialogContent>
          {inviteError && (
            <Alert severity="error" sx={{ mt: 2, mb: 1 }} onClose={() => setInviteError('')}>
              {inviteError}
            </Alert>
          )}
          <TextField
            fullWidth
            label={t('settings.emailAddress')}
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t('settings.emailPlaceholder')}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleInviteUser}
            disabled={!inviteEmail.trim().includes('@') || inviteLoading}
          >
            {inviteLoading ? <CircularProgress size={24} color="inherit" /> : t('settings.sendInvite')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
