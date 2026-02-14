import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { adminClient } from '@/api/adminClient';

type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';
type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

interface AdminOrgRow {
  id: string;
  name: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  monthlyInvoiceLimit: number;
  invoicesUsedThisPeriod: number;
  enterpriseChatEnabled: boolean;
  chatMessageLimitPerInvoice: number | null;
  currentPeriodEnd: string | null;
}

const AdminLimits: React.FC = () => {
  const [orgs, setOrgs] = useState<AdminOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<AdminOrgRow | null>(null);
  const [editMonthlyLimit, setEditMonthlyLimit] = useState('');
  const [editChatLimit, setEditChatLimit] = useState('');
  const [editUsePlanDefaultChat, setEditUsePlanDefaultChat] = useState(true);
  const [editEnterpriseChat, setEditEnterpriseChat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchOrgs = () => {
    setLoading(true);
    setError('');
    adminClient
      .get<AdminOrgRow[]>('/api/admin/organizations')
      .then((res) => setOrgs(res.data ?? []))
      .catch(() => setError('Failed to load organizations.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const openEdit = (org: AdminOrgRow) => {
    setEditOrg(org);
    setEditMonthlyLimit(String(org.monthlyInvoiceLimit));
    setEditChatLimit(org.chatMessageLimitPerInvoice != null ? String(org.chatMessageLimitPerInvoice) : '');
    setEditUsePlanDefaultChat(org.chatMessageLimitPerInvoice == null);
    setEditEnterpriseChat(org.enterpriseChatEnabled);
    setSaveError('');
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditOrg(null);
    setSaveError('');
  };

  const handleSave = async () => {
    if (!editOrg) return;
    setSaveError('');
    const monthlyLimit = parseInt(editMonthlyLimit, 10);
    if (Number.isNaN(monthlyLimit) || monthlyLimit < 1) {
      setSaveError('Invoice limit must be at least 1.');
      return;
    }
    const chatLimit = editUsePlanDefaultChat
      ? null
      : (() => {
        const n = parseInt(editChatLimit, 10);
        return Number.isNaN(n) || n < 0 ? null : n;
      })();
    if (!editUsePlanDefaultChat && (chatLimit === null || chatLimit === undefined)) {
      setSaveError('Chat limit must be a number ≥ 0.');
      return;
    }
    setSaving(true);
    try {
      await adminClient.patch(`/api/admin/organizations/${editOrg.id}/limits`, {
        monthlyInvoiceLimit: monthlyLimit,
        chatMessageLimitPerInvoice: chatLimit,
        enterpriseChatEnabled: editEnterpriseChat,
      });
      fetchOrgs();
      closeEdit();
    } catch (err: unknown) {
      const msg =
        err &&
          typeof err === 'object' &&
          'response' in err &&
          err.response &&
          typeof (err.response as { data?: { error?: string } }).data?.error === 'string'
          ? (err.response as { data: { error: string } }).data.error
          : 'Failed to save.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Organization limits
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set custom invoice limit, chat messages per invoice, and enterprise chat per organization (enterprise-style).
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Invoice limit</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Used this period</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Chat limit/invoice</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Enterprise chat</TableCell>
              <TableCell sx={{ fontWeight: 600 }} width={80}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.subscriptionPlan}</TableCell>
                <TableCell align="right">{org.monthlyInvoiceLimit}</TableCell>
                <TableCell align="right">{org.invoicesUsedThisPeriod}</TableCell>
                <TableCell align="right">
                  {org.chatMessageLimitPerInvoice != null ? org.chatMessageLimitPerInvoice : 'Plan default'}
                </TableCell>
                <TableCell>{org.enterpriseChatEnabled ? 'On' : 'Off'}</TableCell>
                <TableCell>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(org)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editOpen} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit limits — {editOrg?.name}</DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
              {saveError}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Monthly invoice limit"
            type="number"
            inputProps={{ min: 1, max: 1000000 }}
            value={editMonthlyLimit}
            onChange={(e) => setEditMonthlyLimit(e.target.value)}
            sx={{ mb: 2, mt: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={editUsePlanDefaultChat}
                onChange={(e) => {
                  setEditUsePlanDefaultChat(e.target.checked);
                  if (e.target.checked) setEditChatLimit('');
                }}
              />
            }
            label="Use plan default for chat messages per invoice"
            sx={{ display: 'block', mb: 1 }}
          />
          {!editUsePlanDefaultChat && (
            <TextField
              fullWidth
              label="Chat messages per invoice"
              type="number"
              inputProps={{ min: 0, max: 10000 }}
              value={editChatLimit}
              onChange={(e) => setEditChatLimit(e.target.value)}
              placeholder="0 = unlimited"
              sx={{ mb: 2 }}
            />
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={editEnterpriseChat}
                onChange={(e) => setEditEnterpriseChat(e.target.checked)}
              />
            }
            label="Enterprise chat enabled"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminLimits;
