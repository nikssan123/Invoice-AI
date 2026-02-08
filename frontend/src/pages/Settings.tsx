import React, { useState } from 'react';
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

  // Organization settings
  const [orgName, setOrgName] = useState('Acme Corp');
  const [orgAddress, setOrgAddress] = useState('123 Business Street, Suite 100');

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);

  const handleInviteUser = () => {
    // Simulate invite
    setInviteDialogOpen(false);
    setInviteEmail('');
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
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                {t('settings.inviteUser')}
              </Button>
            </Box>

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
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('settings.inviteTeamMember')}</DialogTitle>
        <DialogContent>
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
            disabled={!inviteEmail.includes('@')}
          >
            {t('settings.sendInvite')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
