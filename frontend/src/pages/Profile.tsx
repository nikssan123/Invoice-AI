import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Snackbar,
  Divider,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { ExportColumnConfig } from '@/types/export';

type ProfileMeResponse = {
  id: string;
  email: string;
  name: string | null;
  organizationId: string;
  hasExportConfig: boolean;
  isOwner?: boolean;
};

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const DELETE_CONFIRM_PHRASE = 'DELETE';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setAuth, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const [emailValue, setEmailValue] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [exportColumns, setExportColumns] = useState<ExportColumnConfig[] | null>(null);
  const [exportSaving, setExportSaving] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteNewOwnerId, setDeleteNewOwnerId] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiClient.get<ProfileMeResponse>('/api/profile/me');
      setProfile(res.data);
      setEmailValue(res.data.email);
      setProfileError(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setProfileError(axiosErr.response?.data?.error ?? t('profile.loadError'));
    }
  }, [t]);

  const loadExportConfig = useCallback(async () => {
    try {
      const res = await apiClient.get<{ columns: ExportColumnConfig[]; hasConfig: boolean }>(
        '/api/invoices/config/export'
      );
      setExportColumns(res.data.columns);
      setExportError(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setExportError(axiosErr.response?.data?.error ?? t('invoices.exportConfigLoadError'));
    }
  }, [t]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await apiClient.get<{ members: Member[]; ownerId: string | null }>(
        '/api/organizations/members'
      );
      setMembers(res.data.members ?? []);
      setOwnerId(res.data.ownerId ?? null);
    } catch {
      setMembers([]);
      setOwnerId(null);
    } finally {
      setMembersLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadExportConfig();
  }, [loadProfile, loadExportConfig]);

  useEffect(() => {
    if (profile?.isOwner) {
      loadMembers();
    } else {
      setMembersLoaded(true);
    }
  }, [profile?.isOwner, loadMembers]);

  const handleSaveEmail = async () => {
    setEmailError(null);
    if (!emailValue || !currentPasswordForEmail) {
      setEmailError(t('profile.changeEmailValidation'));
      return;
    }
    setEmailSaving(true);
    try {
      const res = await apiClient.put<{ user: { id: string; email: string; name: string | null } }>(
        '/api/profile/email',
        {
          email: emailValue,
          currentPassword: currentPasswordForEmail,
        }
      );
      setSuccessMessage(t('profile.changeEmailSuccess'));
      setProfile((prev) =>
        prev ? { ...prev, email: res.data.user.email } : prev
      );
      if (user) {
        setAuth(
          localStorage.getItem('auth_token') ?? '',
          { ...user, email: res.data.user.email }
        );
      }
      setCurrentPasswordForEmail('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setEmailError(axiosErr.response?.data?.error ?? t('profile.changeEmailError'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError(t('profile.changePasswordValidation'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('profile.changePasswordMismatch'));
      return;
    }
    setPasswordSaving(true);
    try {
      await apiClient.put('/api/profile/password', {
        currentPassword,
        newPassword,
      });
      setSuccessMessage(t('profile.changePasswordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setPasswordError(axiosErr.response?.data?.error ?? t('profile.changePasswordError'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleExportLabelChange = (key: ExportColumnConfig['key'], value: string) => {
    setExportColumns((prev) =>
      prev ? prev.map((c) => (c.key === key ? { ...c, currentLabel: value } : c)) : prev
    );
  };

  const handleSaveExportConfig = async () => {
    if (!exportColumns) return;
    setExportError(null);
    const anyEmpty = exportColumns.some(
      (c) => !c.currentLabel || c.currentLabel.trim().length === 0
    );
    if (anyEmpty) {
      setExportError(t('invoices.exportColumnValidation'));
      return;
    }
    setExportSaving(true);
    try {
      const labels: Record<string, string> = {};
      exportColumns.forEach((c) => {
        labels[c.key] = c.currentLabel;
      });
      await apiClient.put('/api/invoices/config/export', { labels });
      setSuccessMessage(t('profile.excelSettingsSaveSuccess'));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setExportError(
        axiosErr.response?.data?.error ?? t('profile.excelSettingsSaveError')
      );
    } finally {
      setExportSaving(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const otherMembers = members.filter((m) => m.id !== user?.id);
  const isOwnerWithOthers = !!profile?.isOwner && otherMembers.length > 0;
  const isOwnerAlone = !!profile?.isOwner && membersLoaded && otherMembers.length === 0;
  const canDeleteWithTransfer = isOwnerWithOthers && deleteNewOwnerId;
  const deleteConfirmValid = deleteConfirmText === DELETE_CONFIRM_PHRASE;

  const handleOpenDeleteDialog = () => {
    setDeleteError(null);
    setDeleteConfirmText('');
    setDeleteNewOwnerId(isOwnerWithOthers ? (otherMembers[0]?.id ?? '') : '');
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteConfirmValid) return;
    if (isOwnerWithOthers && !deleteNewOwnerId) {
      setDeleteError(t('profile.deleteAccountTransferRequired'));
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const body: { newOwnerId?: string } = {};
      if (canDeleteWithTransfer) body.newOwnerId = deleteNewOwnerId;
      await apiClient.post('/api/profile/delete-account', body);
      logout();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setDeleteError(
        axiosErr.response?.data?.error ?? t('profile.deleteAccountError')
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setDeleteError(null);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          {t('profile.title')}
        </Typography>
        {/* Optional subtitle could go here for consistency */}
      </Box>
      {profileError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {profileError}
        </Alert>
      )}
      <Card>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label={t('profile.tabAccount')} />
          <Tab label={t('profile.tabSecurity')} />
          <Tab label={t('profile.tabExcel')} />
        </Tabs>

        {tabValue === 0 && (
          <CardContent>
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('profile.accountInfo')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.currentEmail')}: {profile?.email ?? user?.email ?? ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.currentName')}: {profile?.name ?? user?.name ?? '-'}
              </Typography>
            </Box>
          </CardContent>
        )}

        {tabValue === 1 && (
          <CardContent>
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('profile.changeEmailTitle')}
              </Typography>
              {emailError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {emailError}
                </Alert>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                <TextField
                  fullWidth
                  label={t('profile.newEmail')}
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                />
                <TextField
                  fullWidth
                  label={t('profile.currentPassword')}
                  type="password"
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSaveEmail}
                    disabled={emailSaving}
                  >
                    {t('common.save')}
                  </Button>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('profile.changePasswordTitle')}
              </Typography>
              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {passwordError}
                </Alert>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label={t('profile.currentPassword')}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <TextField
                  fullWidth
                  label={t('profile.newPassword')}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <TextField
                  fullWidth
                  label={t('profile.confirmNewPassword')}
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSavePassword}
                    disabled={passwordSaving}
                  >
                    {t('common.save')}
                  </Button>
                </Box>
              </Box>
            </Box>
          </CardContent>
        )}

        {tabValue === 2 && (
          <CardContent>
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {t('profile.excelSettingsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('profile.excelSettingsDescription')}
              </Typography>
              {exportError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {exportError}
                </Alert>
              )}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {exportColumns?.map((col) => (
                  <TextField
                    key={col.key}
                    fullWidth
                    label={col.defaultLabel}
                    value={col.currentLabel}
                    onChange={(e) => handleExportLabelChange(col.key, e.target.value)}
                  />
                ))}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Button
                variant="contained"
                onClick={handleSaveExportConfig}
                disabled={exportSaving}
              >
                {t('profile.excelSettingsSave')}
              </Button>
            </Box>
          </CardContent>
        )}
      </Card>

      <Card sx={{ mt: 3, borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }} color="error">
            {t('profile.deleteAccountTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {profile?.isOwner
              ? isOwnerAlone
                ? t('profile.deleteAccountOwnerAloneHint')
                : t('profile.deleteAccountOwnerWithMembersHint')
              : t('profile.deleteAccountNonOwnerHint')}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={handleOpenDeleteDialog}
            disabled={!membersLoaded}
          >
            {t('profile.deleteAccountButton')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.deleteAccountConfirmTitle')}</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          {isOwnerWithOthers && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('profile.deleteAccountSelectNewOwner')}</InputLabel>
              <Select
                value={deleteNewOwnerId}
                label={t('profile.deleteAccountSelectNewOwner')}
                onChange={(e) => setDeleteNewOwnerId(e.target.value)}
              >
                {otherMembers.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name || m.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('profile.deleteAccountTypeConfirm', { phrase: DELETE_CONFIRM_PHRASE })}
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={DELETE_CONFIRM_PHRASE}
            error={deleteConfirmText.length > 0 && !deleteConfirmValid}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeleteAccount}
            disabled={!deleteConfirmValid || deleteLoading || (isOwnerWithOthers && !deleteNewOwnerId)}
            startIcon={deleteLoading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {deleteLoading ? t('profile.deleteAccountDeleting') : t('profile.deleteAccountConfirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default Profile;

