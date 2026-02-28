import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
  Box,
  Paper,
  TextField,
  Button,
  MenuItem,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('DBLG_SHOP_BRANCH')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Failed to fetch branches:', error.message);
        return;
      }
      if (data) setBranches(data);
    };

    fetchBranches();
  }, []);

  const handleRegister = async () => {
    if (loading) return; // prevent double click

    if (!email || !password || !name || !branchId) {
      alert('Please fill all fields');
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        alert(authError.message);
        return;
      }

      if (!authData.user?.id) {
        alert('Failed to create user.');
        return;
      }

      // 2️⃣ Update the DBLG_USERS row created by the trigger
      const { data: updatedData, error } = await supabase
        .from('DBLG_USERS')
        .update({
          name,
          role,
          branch_id: branchId,
        })
        .eq('auth_user_id', authData.user.id)
        .select();

      if (error) {
        alert(error.message);
        return;
      }

      console.log('Updated row in DB:', updatedData);

      alert('User created successfully!');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <Paper sx={{ p: 4, width: 400 }}>
        <Typography variant="h5" mb={2}>
          Register New User
        </Typography>

        <TextField
          fullWidth
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          margin="normal"
        />

        <TextField
          fullWidth
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="normal"
        />

        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
        />

        <TextField
          select
          fullWidth
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          margin="normal"
        >
          <MenuItem value="staff">Staff</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
        </TextField>

        <TextField
          select
          fullWidth
          label="Branch"
          value={branchId ?? ''}
          onChange={(e) => setBranchId(e.target.value)}
          margin="normal"
        >
          {branches.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.name}
            </MenuItem>
          ))}
        </TextField>

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </Paper>
    </Box>
  );
}