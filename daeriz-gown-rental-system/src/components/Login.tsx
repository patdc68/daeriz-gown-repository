import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    TextField,
    Typography,
    Paper,
    Alert,
    CircularProgress,
} from '@mui/material';
import { supabase } from '../services/supabase';

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    // ✅ Auto-redirect if already logged in
    React.useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                navigate('/itemList', { replace: true });
            }
        };
        checkSession();
    }, [navigate]);

    const handleLogin = async () => {
        if (loading) return;
        setError('');
        setLoading(true);
        try {
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (loginError) {
                setError('Unable to sign in. Check your email and password.');
                return;
            }
            navigate('/itemList');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#f4f6f8',
            }}
        >
            <Paper sx={{ p: 4, width: 400 }}>
                <Typography variant="h5" mb={2}>
                    Daeriz Bleau Luxury Gown Rentals
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    label="Email"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    margin="normal"
                    autoComplete="email"
                />

                <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    margin="normal"
                    autoComplete="current-password"
                />

                <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={handleLogin}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Login'}
                </Button>
                <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                    Don't have an account?{' '}
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => navigate('/register')}
                    >
                        Register
                    </Button>
                </Typography>
            </Paper>
        </Box>
    );
}
