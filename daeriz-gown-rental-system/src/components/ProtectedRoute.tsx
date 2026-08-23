import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
