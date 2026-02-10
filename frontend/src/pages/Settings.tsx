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
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/api/client';

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

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
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteSuccessSnackbar, setInviteSuccessSnackbar] = useState<string | null>(null);
  const [editRoleMember, setEditRoleMember] = useState<Member | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<'admin' | 'member'>('member');
  const [editRoleLoading, setEditRoleLoading] = useState(false);
  const [editRoleError, setEditRoleError] = useState('');
  const [removeConfirmMember, setRemoveConfirmMember] = useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [memberSuccessSnackbar, setMemberSuccessSnackbar] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isOwner = !!user?.id && user.id === ownerId;

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await apiClient.get<{ members: Member[]; ownerId: string | null }>('/api/organizations/members');
      setMembers(res.data.members ?? []);
      setOwnerId(res.data.ownerId ?? null);
    } catch {
      setMembers([]);
      setOwnerId(null);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const canEditRole = (member: Member): boolean => {
    if (!isAdmin) return false;
    if (member.id === ownerId) return false;
    if (member.role === 'admin' && !isOwner) return false;
    return true;
  };

  const canRemove = (member: Member): boolean => {
    if (!isAdmin) return false;
    if (member.id === user?.id) return false;
    if (member.id === ownerId) return false;
    if (member.role === 'admin' && !isOwner) return false;
    return true;
  };

  const handleOpenEditRole = (member: Member) => {
    setEditRoleMember(member);
    setEditRoleValue(member.role === 'admin' ? 'admin' : 'member');
    setEditRoleError('');
  };

  const handleEditRoleSubmit = async () => {
    if (!editRoleMember) return;
    setEditRoleError('');
    setEditRoleLoading(true);
    try {
      await apiClient.patch(`/api/organizations/members/${editRoleMember.id}/role`, { role: editRoleValue });
      setEditRoleMember(null);
      setMemberSuccessSnackbar(t('settings.roleUpdated'));
      await fetchMembers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setEditRoleError(axiosErr.response?.data?.error ?? t('settings.saveErrorGeneric'));
    } finally {
      setEditRoleLoading(false);
    }
  };

  const handleOpenRemoveConfirm = (member: Member) => {
    setRemoveConfirmMember(member);
    setRemoveError('');
  };

  const handleRemoveConfirm = async () => {
    if (!removeConfirmMember) return;
    setRemoveError('');
    setRemoveLoading(true);
    try {
      await apiClient.delete(`/api/organizations/members/${removeConfirmMember.id}`);
      setRemoveConfirmMember(null);
      setMemberSuccessSnackbar(t('settings.memberRemoved'));
      await fetchMembers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setRemoveError(axiosErr.response?.data?.error ?? t('settings.saveErrorGeneric'));
    } finally {
      setRemoveLoading(false);
    }
  };

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

  const [org, setOrg] = useState<{ id: string; name: string; address: string | null; billingEmail: string | null } | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgSaveLoading, setOrgSaveLoading] = useState(false);
  const [orgSaveError, setOrgSaveError] = useState('');
  const [orgSuccessSnackbar, setOrgSuccessSnackbar] = useState(false);

  const fetchOrg = useCallback(async () => {
    setOrgLoading(true);
    try {
      const res = await apiClient.get<{ id: string; name: string; address: string | null; billingEmail: string | null }>('/api/organizations/me');
      setOrg(res.data);
    } catch {
      setOrg(null);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabValue === 0) fetchOrg();
  }, [tabValue, fetchOrg]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchInvitations();
      fetchMembers();
    }
  }, [tabValue, fetchInvitations, fetchMembers]);

  // Load organization-level processing preferences when Preferences tab is opened
  useEffect(() => {
    const loadPreferences = async () => {
      if (tabValue !== 2) return;
      setPrefsLoading(true);
      setPrefsError('');
      try {
        const res = await apiClient.get<{ autoApproveHighConfidence: boolean; emailNotificationsOnApproval: boolean }>(
          '/api/organizations/preferences',
        );
        setAutoApprove(res.data.autoApproveHighConfidence);
        setEmailNotifications(res.data.emailNotificationsOnApproval);
        setInitialAutoApprove(res.data.autoApproveHighConfidence);
        setInitialEmailNotifications(res.data.emailNotificationsOnApproval);
      } catch (err: any) {
        const message =
          err?.response?.data?.error ?? t('settings.preferencesLoadFailed');
        setPrefsError(message);
      } finally {
        setPrefsLoading(false);
      }
    };

    loadPreferences();
  }, [tabValue, t]);

  const handleSaveOrg = async () => {
    if (!org) return;
    setOrgSaveError('');
    setOrgSaveLoading(true);
    try {
      const res = await apiClient.patch<typeof org>('/api/organizations/me', {
        name: org.name,
        address: org.address ?? '',
        billingEmail: org.billingEmail ?? '',
      });
      setOrg(res.data);
      setOrgSuccessSnackbar(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setOrgSaveError(axiosErr.response?.data?.error ?? t('settings.saveErrorGeneric'));
    } finally {
      setOrgSaveLoading(false);
    }
  };

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");
  const [prefsSuccess, setPrefsSuccess] = useState("");
  const [initialEmailNotifications, setInitialEmailNotifications] = useState<boolean | null>(null);
  const [initialAutoApprove, setInitialAutoApprove] = useState<boolean | null>(null);

  const handleInviteUser = async () => {
    setInviteError('');
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) return;
    setInviteLoading(true);
    try {
      await apiClient.post('/api/organizations/invitations', { email });
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteSuccessSnackbar(email);
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
              {orgLoading ? (
                <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={32} />
                </Box>
              ) : org ? (
                <>
                  {orgSaveError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOrgSaveError('')}>
                      {orgSaveError}
                    </Alert>
                  )}
                  <TextField
                    fullWidth
                    label={t('settings.organizationName')}
                    value={org.name}
                    onChange={(e) => setOrg((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                    sx={{ mb: 3 }}
                  />
                  <TextField
                    fullWidth
                    label={t('settings.businessAddress')}
                    value={org.address ?? ''}
                    onChange={(e) => setOrg((prev) => (prev ? { ...prev, address: e.target.value || null } : null))}
                    multiline
                    rows={2}
                    sx={{ mb: 3 }}
                  />
                  <TextField
                    fullWidth
                    label={t('settings.billingEmail')}
                    value={org.billingEmail ?? ''}
                    onChange={(e) => setOrg((prev) => (prev ? { ...prev, billingEmail: e.target.value || null } : null))}
                    type="email"
                    sx={{ mb: 3 }}
                  />
                  {isAdmin && (
                    <Button
                      variant="contained"
                      onClick={handleSaveOrg}
                      disabled={orgSaveLoading}
                    >
                      {orgSaveLoading ? <CircularProgress size={24} color="inherit" /> : t('settings.saveChanges')}
                    </Button>
                  )}
                </>
              ) : (
                <Typography color="text.secondary">{t('settings.organizationLoadFailed')}</Typography>
              )}
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
                  {membersLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('settings.noTeamMembers')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((teamUser) => (
                      <TableRow key={teamUser.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {(teamUser.name || teamUser.email).charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2">
                                {teamUser.name || teamUser.email}
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={teamUser.role === 'admin' ? t('settings.admin') : t('settings.userRole')}
                              color={teamUser.role === 'admin' ? 'primary' : 'default'}
                              size="small"
                              variant="outlined"
                            />
                            {teamUser.id === ownerId && (
                              <Chip label={t('settings.owner')} size="small" color="primary" variant="filled" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={t('settings.active')} color="success" size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditRole(teamUser)}
                            disabled={!canEditRole(teamUser)}
                            title={!canEditRole(teamUser) ? t('settings.onlyOwnerCanDemote') : undefined}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenRemoveConfirm(teamUser)}
                            disabled={!canRemove(teamUser)}
                            title={!canRemove(teamUser) ? t('settings.onlyOwnerCanRemoveAdmin') : undefined}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
              {prefsError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPrefsError("")}>
                  {prefsError}
                </Alert>
              )}
              {prefsSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPrefsSuccess("")}>
                  {prefsSuccess}
                </Alert>
              )}
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

              <Typography variant="h6" sx={{ mt: 4, mb: 3, fontWeight: 600 }}>
                {t('settings.processingPreferences')}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    disabled={prefsLoading || prefsSaving}
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

              <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={async () => {
                  setPrefsError("");
                  setPrefsSuccess("");
                  // Do not send request if nothing changed
                  const hasAutoApproveChanged =
                    initialAutoApprove === null || autoApprove !== initialAutoApprove;
                  const hasEmailNotificationsChanged =
                    initialEmailNotifications === null || emailNotifications !== initialEmailNotifications;
                  if (!hasAutoApproveChanged && !hasEmailNotificationsChanged) {
                    return;
                  }

                  setPrefsSaving(true);
                  try {
                    const payload: {
                      autoApproveHighConfidence?: boolean;
                      emailNotificationsOnApproval?: boolean;
                    } = {};

                    if (hasAutoApproveChanged) {
                      payload.autoApproveHighConfidence = autoApprove;
                    }
                    if (hasEmailNotificationsChanged) {
                      payload.emailNotificationsOnApproval = emailNotifications;
                    }

                    const res = await apiClient.patch<{
                      autoApproveHighConfidence: boolean;
                      emailNotificationsOnApproval: boolean;
                    }>(
                      "/api/organizations/preferences",
                      payload,
                    );
                    setAutoApprove(res.data.autoApproveHighConfidence);
                    setEmailNotifications(res.data.emailNotificationsOnApproval);
                    setInitialAutoApprove(res.data.autoApproveHighConfidence);
                    setInitialEmailNotifications(res.data.emailNotificationsOnApproval);
                    setPrefsSuccess(t("settings.preferencesSaved"));
                  } catch (err: any) {
                    const message =
                      err?.response?.data?.error ??
                      t("settings.preferencesSaveFailed");
                    setPrefsError(message);
                  } finally {
                    setPrefsSaving(false);
                  }
                }}
                disabled={prefsSaving}
              >
                {prefsSaving ? <CircularProgress size={24} color="inherit" /> : t('settings.savePreferences')}
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
      <Snackbar
        open={!!inviteSuccessSnackbar}
        autoHideDuration={5000}
        onClose={() => setInviteSuccessSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setInviteSuccessSnackbar(null)} severity="success" sx={{ width: '100%' }}>
          {inviteSuccessSnackbar ? t('settings.inviteSuccessEmail', { email: inviteSuccessSnackbar }) : ''}
        </Alert>
      </Snackbar>
      <Snackbar
        open={orgSuccessSnackbar}
        autoHideDuration={4000}
        onClose={() => setOrgSuccessSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOrgSuccessSnackbar(false)} severity="success" sx={{ width: '100%' }}>
          {t('settings.organizationSaved')}
        </Alert>
      </Snackbar>

      {/* Edit role dialog */}
      <Dialog
        open={!!editRoleMember}
        onClose={() => { setEditRoleMember(null); setEditRoleError(''); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('settings.editRole')}</DialogTitle>
        <DialogContent>
          {editRoleMember && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.editRoleFor', { name: editRoleMember.name || editRoleMember.email })}
            </Typography>
          )}
          {editRoleError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditRoleError('')}>
              {editRoleError}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t('settings.role')}</InputLabel>
            <Select
              value={editRoleValue}
              label={t('settings.role')}
              onChange={(e) => setEditRoleValue(e.target.value as 'admin' | 'member')}
            >
              <MenuItem value="member">{t('settings.userRole')}</MenuItem>
              <MenuItem value="admin">{t('settings.admin')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRoleMember(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleEditRoleSubmit} disabled={editRoleLoading}>
            {editRoleLoading ? <CircularProgress size={24} color="inherit" /> : t('settings.saveChanges')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove member confirmation */}
      <Dialog
        open={!!removeConfirmMember}
        onClose={() => { setRemoveConfirmMember(null); setRemoveError(''); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('settings.removeMember')}</DialogTitle>
        <DialogContent>
          {removeConfirmMember && (
            <Typography variant="body2">
              {t('settings.removeMemberConfirm', { name: removeConfirmMember.name || removeConfirmMember.email })}
            </Typography>
          )}
          {removeError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setRemoveError('')}>
              {removeError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveConfirmMember(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleRemoveConfirm} disabled={removeLoading}>
            {removeLoading ? <CircularProgress size={24} color="inherit" /> : t('settings.remove')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!memberSuccessSnackbar}
        autoHideDuration={4000}
        onClose={() => setMemberSuccessSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setMemberSuccessSnackbar(null)} severity="success" sx={{ width: '100%' }}>
          {memberSuccessSnackbar ?? ''}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
