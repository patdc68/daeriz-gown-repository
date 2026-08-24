import * as React from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import AssignmentReturnRoundedIcon from '@mui/icons-material/AssignmentReturnRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import LocalLaundryServiceRoundedIcon from '@mui/icons-material/LocalLaundryServiceRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import { useNavigate, useOutletContext } from 'react-router-dom';
import PageContainer from './PageContainer';
import RentalDetailsDialog from './RentalDetailsDialog';
import { getOperationsDashboard, type DashboardRental, type OperationsDashboardData } from '../services/DashboardService';
import { formatPeso } from '../utils/currency';
import type { DashboardOutletContext } from './DashboardLayout';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function CountCard({ label, value, icon, color, onClick }: { label: string; value: number; icon: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }} aria-label={`${label}: ${value}`}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box><Typography color="text.secondary" variant="body2">{label}</Typography><Typography variant="h3" fontWeight={700} mt={0.5}>{value}</Typography></Box>
            <Avatar sx={{ bgcolor: color, color: 'common.white' }}>{icon}</Avatar>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function FinancialCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ bgcolor: 'primary.main' }}>{icon}</Avatar>
        <Box><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={700}>{value}</Typography>{detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}</Box>
      </Stack>
    </Paper>
  );
}

function RentalListSection({ title, rentals, empty, onSelect, id }: { title: string; rentals: DashboardRental[]; empty: string; onSelect: (rental: DashboardRental) => void; id?: string }) {
  return (
    <Paper id={id} variant="outlined" sx={{ overflow: 'hidden', scrollMarginTop: 80 }}>
      <Box p={2} borderBottom="1px solid" borderColor="divider"><Typography variant="h6">{title}</Typography></Box>
      {rentals.length ? <List disablePadding>{rentals.map((rental) => (
        <ListItemButton key={rental.id} divider onClick={() => onSelect(rental)} alignItems="flex-start">
          <ListItemAvatar><Avatar variant="rounded" src={rental.item?.image_url ?? undefined}>{rental.item?.item_name?.charAt(0)}</Avatar></ListItemAvatar>
          <ListItemText
            primary={<Stack direction={{ xs: 'column', sm: 'row' }} gap={{ sm: 1 }}><Typography variant="body2" fontWeight={700}>{rental.renter_name}</Typography><Typography variant="caption" color="text.secondary">{rental.renter_contact_no}</Typography></Stack>}
            secondary={`${rental.item?.item_name || 'Unknown item'} · ${rental.branch?.name || 'Unknown branch'} · ${dayjs(rental.date_returned).format('MMM D')}`}
          />
          {rental.financial.rentalBalance <= 0 ? <Chip size="small" color="success" label="Paid" /> : <Chip size="small" color="warning" variant="outlined" label={`${formatPeso(rental.financial.rentalBalance)} balance`} />}
        </ListItemButton>
      ))}</List> : <Typography color="text.secondary" variant="body2" p={2}>{empty}</Typography>}
    </Paper>
  );
}

export default function OperationsDashboard() {
  const navigate = useNavigate();
  const { user } = useOutletContext<DashboardOutletContext>();
  const [data, setData] = React.useState<OperationsDashboardData | null>(null);
  const [branchId, setBranchId] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [selectedRental, setSelectedRental] = React.useState<DashboardRental | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await getOperationsDashboard(branchId === 'all' ? undefined : branchId));
    } catch (loadError) {
      console.error('Operations dashboard load failed:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <PageContainer
      title="Operations Dashboard"
      breadcrumbs={[{ title: 'Dashboard' }]}
      actions={<Button startIcon={<RefreshRoundedIcon />} onClick={() => void load()} disabled={loading}>Refresh</Button>}
    >
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6">{greeting()}{user?.name ? `, ${user.name}` : ''}</Typography>
          <Typography color="text.secondary">Daeriz Bleu Operations · {dayjs().format('dddd, MMMM D, YYYY')}</Typography>
        </Box>

        {user?.role === 'admin' && data && (
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 260 } }}>
            <InputLabel id="dashboard-branch-label">Branch</InputLabel>
            <Select labelId="dashboard-branch-label" label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <MenuItem value="all">All Branches</MenuItem>
              {data.branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {error && <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>Unable to load dashboard.</Alert>}
        {data?.warnings.map((warning) => <Alert severity="warning" key={warning}>{warning}</Alert>)}
        {loading && !data ? <Grid container spacing={2}>{[0, 1, 2, 3].map((key) => <Grid key={key} size={{ xs: 12, sm: 6, lg: 3 }}><Skeleton variant="rounded" height={138} /></Grid>)}</Grid> : data && (
          <>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}><CountCard label="Today's Pickups" value={data.todaysPickups.length} icon={<TodayRoundedIcon />} color="#2563eb" onClick={() => scrollTo('todays-pickups')} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><CountCard label="Today's Returns" value={data.todaysReturns.length} icon={<AssignmentReturnRoundedIcon />} color="#059669" onClick={() => scrollTo('todays-returns')} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><CountCard label="Overdue Rentals" value={data.overdue.length} icon={<WarningAmberRoundedIcon />} color="#dc2626" onClick={() => scrollTo('needs-attention')} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><CountCard label="In Laundry" value={data.inLaundry.length} icon={<LocalLaundryServiceRoundedIcon />} color="#d97706" onClick={() => navigate('/reports/in-laundry')} /></Grid>
            </Grid>

            <Box><Typography variant="h5" mb={1.5}>Financials</Typography><Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}><FinancialCard label="Payments Collected Today" value={formatPeso(data.paymentsToday.net)} detail={`Gross ${formatPeso(data.paymentsToday.gross)} · Refunds ${formatPeso(data.paymentsToday.refunds)}`} icon={<PaymentsRoundedIcon />} /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><FinancialCard label="Outstanding Rental Balance" value={formatPeso(data.outstandingBalance)} detail="Excludes security deposits" icon={<AccountBalanceWalletRoundedIcon />} /></Grid>
              <Grid size={{ xs: 12, md: 4 }}><FinancialCard label="Security Deposits Held" value={formatPeso(data.depositsHeld)} detail="Tracked separately from rental revenue" icon={<SavingsRoundedIcon />} /></Grid>
            </Grid></Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}><RentalListSection id="todays-pickups" title="Today's Pickups" rentals={data.todaysPickups} empty="No pickups scheduled today." onSelect={setSelectedRental} /></Grid>
              <Grid size={{ xs: 12, lg: 6 }}><RentalListSection id="todays-returns" title="Today's Returns" rentals={data.todaysReturns} empty="No customer returns due today." onSelect={setSelectedRental} /></Grid>
            </Grid>

            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" p={2} borderBottom="1px solid" borderColor="divider"><Typography variant="h6">Upcoming Bookings · Next 7 Days</Typography><Button startIcon={<CalendarMonthRoundedIcon />} onClick={() => navigate('/bookings')}>View Booking Schedule</Button></Stack>
              {data.upcoming.length ? <List disablePadding>{data.upcoming.map((rental) => <ListItemButton key={rental.id} divider onClick={() => setSelectedRental(rental)}><ListItemAvatar><Avatar variant="rounded">{dayjs(rental.date_rented).format('D')}</Avatar></ListItemAvatar><ListItemText primary={rental.renter_name} secondary={`${dayjs(rental.date_rented).format('ddd, MMM D')} · ${rental.item?.item_name || 'Unknown item'} · ${rental.branch?.name || 'Unknown branch'}`} /></ListItemButton>)}</List> : <Typography color="text.secondary" variant="body2" p={2}>No bookings start in the next seven days.</Typography>}
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Paper id="needs-attention" variant="outlined" sx={{ p: 2, scrollMarginTop: 80 }}><Typography variant="h6" mb={1}>Needs Attention</Typography><Stack spacing={1}>
                  <Alert severity={data.overdue.length ? 'warning' : 'success'} onClick={() => data.overdue.length && scrollTo('overdue-list')} sx={{ cursor: data.overdue.length ? 'pointer' : 'default' }}>{data.overdue.length} overdue customer rental{data.overdue.length === 1 ? '' : 's'}</Alert>
                  <Alert severity={data.unpaid.length ? 'warning' : 'success'}>{data.unpaid.length} active rental{data.unpaid.length === 1 ? '' : 's'} with outstanding balance</Alert>
                  <Alert severity={data.inLaundry.length ? 'info' : 'success'} onClick={() => navigate('/reports/in-laundry')} sx={{ cursor: 'pointer' }}>{data.inLaundry.length} gown{data.inLaundry.length === 1 ? '' : 's'} in laundry</Alert>
                  <Alert severity={data.shopReturn.length ? 'info' : 'success'} icon={<StorefrontRoundedIcon />} onClick={() => navigate('/reports/shop-return')} sx={{ cursor: 'pointer' }}>{data.shopReturn.length} gown{data.shopReturn.length === 1 ? '' : 's'} awaiting shop return</Alert>
                </Stack></Paper>
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" mb={1}>Recent Activity</Typography>{data.recentActivity.length ? <Stack spacing={1.5}>{data.recentActivity.map((activity) => <Box key={activity.id}><Typography variant="body2" fontWeight={700}>{activity.action?.replaceAll('_', ' ') || 'Rental activity'}</Typography><Typography variant="caption" color="text.secondary">{activity.rental?.item?.item_name || 'Rental'} · {dayjs(activity.created_at).format('h:mm A')}</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No recent rental activity.</Typography>}</Paper>
              </Grid>
            </Grid>
            {data.overdue.length > 0 && <RentalListSection id="overdue-list" title="Overdue Customer Rentals" rentals={data.overdue} empty="No overdue rentals." onSelect={setSelectedRental} />}
          </>
        )}
      </Stack>
      <RentalDetailsDialog rental={selectedRental} onClose={() => setSelectedRental(null)} />
    </PageContainer>
  );
}
