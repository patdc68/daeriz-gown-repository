import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { ReactNode } from 'react';

export default function RequireAuth({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (!authenticated) return <Navigate to="/" replace />;

  return <>{children}</>;
}