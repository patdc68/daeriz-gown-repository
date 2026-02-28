import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { Outlet, useNavigate } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import SitemarkIcon from './SitemarkIcon';
import { supabase } from '../services/supabase';


export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState<{ name: string; role: string } | null>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);

  // Fetch user info from DBLG_USERS
  React.useEffect(() => {
    const fetchUser = async () => {
      setLoadingUser(true);

      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user.id;

      if (!userId) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('DBLG_USERS')
        .select('name, role')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        console.error('Failed to fetch user:', error.message);
        navigate('/login');
        return;
      }

      if (data) {
        setUser({ name: data.name, role: data.role });
      }

      setLoadingUser(false);
    };

    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login');
      } else {
        fetchUser();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const theme = useTheme();
  const [isDesktopNavigationExpanded, setIsDesktopNavigationExpanded] = React.useState(true);
  const [isMobileNavigationExpanded, setIsMobileNavigationExpanded] = React.useState(false);

  const isOverMdViewport = useMediaQuery(theme.breakpoints.up('md'));
  const isNavigationExpanded = isOverMdViewport
    ? isDesktopNavigationExpanded
    : isMobileNavigationExpanded;

  const setIsNavigationExpanded = React.useCallback(
    (newExpanded: boolean) => {
      if (isOverMdViewport) setIsDesktopNavigationExpanded(newExpanded);
      else setIsMobileNavigationExpanded(newExpanded);
    },
    [isOverMdViewport]
  );

  const handleToggleHeaderMenu = React.useCallback(
    (isExpanded: boolean) => setIsNavigationExpanded(isExpanded),
    [setIsNavigationExpanded]
  );

  const layoutRef = React.useRef<HTMLDivElement>(null);

  return (
    <Box
      ref={layoutRef}
      sx={{
        position: 'relative',
        display: 'flex',
        overflow: 'hidden',
        height: '100%',
        width: '100%',
      }}
    >
      <DashboardHeader
        logo={<SitemarkIcon />}
        title=""
        menuOpen={isNavigationExpanded}
        onToggleMenu={handleToggleHeaderMenu}
        userName={user?.name}
        onLogout={handleLogout}
      />

      <DashboardSidebar
        expanded={isNavigationExpanded}
        setExpanded={setIsNavigationExpanded}
        container={layoutRef?.current ?? undefined}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Toolbar sx={{ displayPrint: 'none' }} />
        <Box
          component="main"
          sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}
        >
          <Outlet context={{ user }} />
        </Box>
      </Box>
    </Box>
  );
}