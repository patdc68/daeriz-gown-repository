import * as React from 'react';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ severity: 'error' | 'success'; text: string } | null>(null);

  React.useEffect(() => {
    supabase.from('DBLG_SHOP_BRANCH').select('id, name').order('name').then(({ data, error }) => {
      if (error) setMessage({ severity: 'error', text: 'Unable to load shop branches.' });
      else setBranches(data ?? []);
    });
  }, []);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setMessage(null);
    if (!email || !password || !name.trim() || !branchId) {
      setMessage({ severity: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim(), branch_id: branchId } },
      });
      if (error) {
        setMessage({ severity: 'error', text: error.message });
        return;
      }
      setMessage({ severity: 'success', text: 'Account created. Check your email if confirmation is required.' });
      setTimeout(() => navigate('/login'), 900);
    } catch (error) {
      console.error('Registration failed:', error);
      setMessage({ severity: 'error', text: 'Unable to create the account.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" p={2}>
      <Paper component="form" onSubmit={handleRegister} sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" mb={2}>Register New User</Typography>
        {message && <Alert severity={message.severity} sx={{ mb: 1 }}>{message.text}</Alert>}
        <TextField required fullWidth label="Name" value={name} onChange={(event) => setName(event.target.value)} margin="normal" autoComplete="name" />
        <TextField required fullWidth label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} margin="normal" autoComplete="email" />
        <TextField required fullWidth label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} margin="normal" autoComplete="new-password" />
        <TextField select required fullWidth label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} margin="normal">
          {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
        </TextField>
        <Alert severity="info" sx={{ mt: 2 }}>New accounts are created with staff access. An administrator can change access when needed.</Alert>
        <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }} disabled={loading}>
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Register'}
        </Button>
      </Paper>
    </Box>
  );
}
