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
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your organization and preferences
        </Typography>
      </Box>

      <Card>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Organization" />
          <Tab label="Users" />
          <Tab label="Preferences" />
        </Tabs>

        {/* Organization Tab */}
        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Organization Details
            </Typography>
            <Box sx={{ maxWidth: 600 }}>
              <TextField
                fullWidth
                label="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label="Business Address"
                value={orgAddress}
                onChange={(e) => setOrgAddress(e.target.value)}
                multiline
                rows={2}
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label="VAT Number"
                defaultValue="DE123456789"
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label="Billing Email"
                defaultValue="billing@acmecorp.com"
                sx={{ mb: 3 }}
              />
              <Button variant="contained">
                Save Changes
              </Button>
            </Box>
          </CardContent>
        </TabPanel>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Team Members
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Invite User
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
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
                                <Chip label="You" size="small" sx={{ ml: 1 }} />
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
                          label={teamUser.role === 'admin' ? 'Admin' : 'User'}
                          color={teamUser.role === 'admin' ? 'primary' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label="Active" color="success" size="small" variant="outlined" />
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
              Notification Preferences
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
                    <Typography variant="body1">Email Notifications</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Receive email alerts for new invoices and approvals
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
                    <Typography variant="body1">Weekly Summary Report</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Get a weekly digest of processed invoices and activity
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, alignItems: 'flex-start' }}
              />
              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" sx={{ mt: 4, mb: 3, fontWeight: 600 }}>
                Processing Preferences
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
                    <Typography variant="body1">Auto-approve High Confidence</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Automatically approve invoices with 95%+ confidence score
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, alignItems: 'flex-start' }}
              />

              <Button variant="contained" sx={{ mt: 3 }}>
                Save Preferences
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
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleInviteUser}
            disabled={!inviteEmail.includes('@')}
          >
            Send Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
