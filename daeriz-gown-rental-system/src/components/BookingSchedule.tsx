import * as React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput } from '@fullcalendar/core';
import dayjs from 'dayjs';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';
import PageContainer from './PageContainer';
import { ImagePreviewDialog, ImageThumbnail } from './ImagePreview';
import {
  getBookingOptions,
  getBookings,
  type Booking,
  type BookingBranch,
  type BookingItem,
} from '../services/BookingService';
import {
  RENTAL_STATUSES,
  RENTAL_STATUS_OPTIONS,
  type RentalStatus,
} from '../services/RentalService';
import useNotifications from '../hooks/useNotifications/useNotifications';

const MAX_VISIBLE_ROWS = 3;

const statusStyles: Record<RentalStatus, { color: string; background: string }> = {
  [RENTAL_STATUSES.RENTING]: { color: '#174ea6', background: '#dbeafe' },
  [RENTAL_STATUSES.IN_LAUNDRY]: { color: '#8a4b08', background: '#fef3c7' },
  [RENTAL_STATUSES.SHOP_RETURN]: { color: '#5b21b6', background: '#ede9fe' },
  [RENTAL_STATUSES.COMPLETED]: { color: '#475569', background: '#e2e8f0' },
};

function bookingTooltip(booking: Booking) {
  return [
    booking.renter_name,
    booking.item?.item_name ?? 'Unknown item',
    booking.branch?.name ?? 'Unknown branch',
    `${booking.date_rented} – ${booking.date_returned}`,
    booking.status,
  ].join('\n');
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value || '—'}</Typography>
    </Box>
  );
}

function BookingDetailsDialog({
  booking,
  onClose,
  onPreview,
}: {
  booking: Booking | null;
  onClose: () => void;
  onPreview: (url: string, alt: string, title: string) => void;
}) {
  return (
    <Dialog open={Boolean(booking)} onClose={onClose} maxWidth="md" fullWidth fullScreen={false}>
      <DialogTitle sx={{ pr: 7 }}>
        Rental details
        <IconButton aria-label="Close rental details" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {booking && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline" color="text.secondary">Renter</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Name" value={booking.renter_name} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Contact number" value={booking.renter_contact_no} /></Grid>
              </Grid>
            </Box>
            <Divider />
            <Box>
              <Typography variant="overline" color="text.secondary">Item</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={1}>
                <ImageThumbnail
                  src={booking.item?.image_url}
                  alt={booking.item?.item_name ?? 'Rental item'}
                  size={96}
                  fallback="No image"
                  onPreview={(url, alt) => onPreview(url, alt, 'Item image')}
                />
                <Grid container spacing={2} flex={1}>
                  <Grid size={{ xs: 12, sm: 4 }}><DetailRow label="Item name" value={booking.item?.item_name} /></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Category" value={booking.item?.category} /></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Size" value={booking.item?.size} /></Grid>
                </Grid>
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography variant="overline" color="text.secondary">Booking</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Branch" value={booking.branch?.name} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailRow label="Status" value={<Chip size="small" label={booking.status} sx={{ color: statusStyles[booking.status].color, bgcolor: statusStyles[booking.status].background }} />} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Rental date" value={dayjs(booking.date_rented).format('MMM D, YYYY')} /></Grid>
                <Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Expected return" value={dayjs(booking.date_returned).format('MMM D, YYYY')} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><DetailRow label="Actual return" value={booking.actual_returned_date ? dayjs(booking.actual_returned_date).format('MMM D, YYYY h:mm A') : undefined} /></Grid>
              </Grid>
            </Box>
            <Divider />
            <Box>
              <Typography variant="overline" color="text.secondary">Payment</Typography>
              <Box mt={1}>
                <ImageThumbnail
                  src={booking.receipt_img}
                  alt={`Receipt for ${booking.renter_name}`}
                  size={96}
                  fallback="No receipt"
                  onPreview={(url, alt) => onPreview(url, alt, 'Receipt image')}
                />
              </Box>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions><Box component="button" hidden /></DialogActions>
    </Dialog>
  );
}

export default function BookingSchedule() {
  const theme = useTheme();
  const notifications = useNotifications();
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [branches, setBranches] = React.useState<BookingBranch[]>([]);
  const [items, setItems] = React.useState<BookingItem[]>([]);
  const [branchId, setBranchId] = React.useState('all');
  const [itemId, setItemId] = React.useState('all');
  const [status, setStatus] = React.useState<'all' | RentalStatus>('all');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [overflowDate, setOverflowDate] = React.useState<string | null>(null);
  const [visibleRange, setVisibleRange] = React.useState(() => ({
    start: dayjs().startOf('month').subtract(7, 'day').format('YYYY-MM-DD'),
    end: dayjs().endOf('month').add(7, 'day').format('YYYY-MM-DD'),
  }));
  const [preview, setPreview] = React.useState<{ url: string; alt: string; title: string } | null>(null);

  React.useEffect(() => {
    getBookingOptions()
      .then(({ branches: branchRows, items: itemRows }) => {
        setBranches(branchRows);
        setItems(itemRows);
      })
      .catch(() => notifications.show('Unable to load booking filters.', { severity: 'error' }));
  }, [notifications]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    getBookings(visibleRange.start, visibleRange.end)
      .then((rows) => { if (active) setBookings(rows); })
      .catch(() => notifications.show('Unable to load bookings.', { severity: 'error' }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notifications, visibleRange]);

  const selectableItems = React.useMemo(
    () => branchId === 'all' ? items : items.filter((item) => item.branch_id === branchId),
    [branchId, items],
  );

  React.useEffect(() => {
    if (itemId !== 'all' && !selectableItems.some((item) => item.id === itemId)) setItemId('all');
  }, [itemId, selectableItems]);

  const filteredBookings = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return bookings.filter((booking) =>
      (branchId === 'all' || booking.branch_id === branchId)
      && (itemId === 'all' || booking.item_rented_id === itemId)
      && (status === 'all' || booking.status === status)
      && (!query || booking.renter_name.toLocaleLowerCase().includes(query)),
    );
  }, [bookings, branchId, itemId, search, status]);

  const bookingById = React.useMemo(() => new Map(filteredBookings.map((booking) => [booking.id, booking])), [filteredBookings]);
  const events = React.useMemo<EventInput[]>(() => filteredBookings.map((booking) => ({
    id: booking.id,
    title: booking.renter_name,
    start: booking.date_rented,
    end: dayjs(booking.date_returned).add(1, 'day').format('YYYY-MM-DD'),
    allDay: true,
    backgroundColor: statusStyles[booking.status].background,
    borderColor: statusStyles[booking.status].color,
    textColor: statusStyles[booking.status].color,
    extendedProps: { status: booking.status, itemName: booking.item?.item_name, size: booking.item?.size },
  })), [filteredBookings]);

  const overflowBookings = React.useMemo(() => {
    if (!overflowDate) return [];
    const unique = new Map(filteredBookings
      .filter((booking) => booking.date_rented <= overflowDate && booking.date_returned >= overflowDate)
      .map((booking) => [booking.id, booking]));
    return [...unique.values()];
  }, [filteredBookings, overflowDate]);

  const noMatches = !loading && filteredBookings.length === 0;

  return (
    <PageContainer title="Booking Schedule" breadcrumbs={[{ title: 'Rentals' }, { title: 'Booking Schedule' }]}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="booking-branch-label">Branch</InputLabel>
                <Select labelId="booking-branch-label" label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                  <MenuItem value="all">All Branches</MenuItem>
                  {branches.map((branch) => <MenuItem value={branch.id} key={branch.id}>{branch.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Autocomplete
                size="small"
                options={selectableItems}
                value={items.find((item) => item.id === itemId) ?? null}
                onChange={(_event, item) => setItemId(item?.id ?? 'all')}
                getOptionLabel={(item) => `${item.item_name} — ${item.size || 'No size'}`}
                renderOption={(props, item) => (
                  <Box component="li" {...props} key={item.id} sx={{ gap: 1 }}>
                    <Avatar variant="rounded" src={item.image_url ?? undefined} alt="" sx={{ width: 32, height: 32 }} />
                    <Box minWidth={0}>
                      <Typography variant="body2" noWrap>{item.item_name} — {item.size || 'No size'}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.branch?.name || 'Branch'} · {item.avail_qty} available</Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} label="Item" placeholder="All Items" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="booking-status-label">Status</InputLabel>
                <Select labelId="booking-status-label" label="Status" value={status} onChange={(event) => setStatus(event.target.value as 'all' | RentalStatus)}>
                  <MenuItem value="all">All</MenuItem>
                  {RENTAL_STATUS_OPTIONS.map((option) => <MenuItem value={option} key={option}>{option}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <TextField fullWidth size="small" label="Search renter" value={search} onChange={(event) => setSearch(event.target.value)} />
            </Grid>
          </Grid>
        </Paper>

        <Stack direction="row" flexWrap="wrap" gap={1} aria-label="Booking status legend">
          {RENTAL_STATUS_OPTIONS.map((option) => (
            <Chip key={option} size="small" label={option} variant="outlined" sx={{ color: statusStyles[option].color, borderColor: statusStyles[option].color, bgcolor: statusStyles[option].background }} />
          ))}
        </Stack>

        {loading && <Alert icon={<CircularProgress size={18} />} severity="info">Loading bookings...</Alert>}
        {noMatches && <Alert severity="info">{bookings.length ? 'No bookings match the selected filters.' : 'No bookings for this month.'}</Alert>}

        <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, overflowX: 'auto' }}>
          <Box
            sx={{
              minWidth: { xs: 760, md: 0 },
              '& .fc': { fontFamily: theme.typography.fontFamily },
              '& .fc .fc-toolbar': { flexWrap: 'wrap', gap: 1 },
              '& .fc .fc-toolbar-title': { fontSize: { xs: '1.05rem', sm: '1.3rem' }, fontWeight: 700 },
              '& .fc .fc-button-primary': { bgcolor: 'primary.main', borderColor: 'primary.main', textTransform: 'capitalize' },
              '& .fc .fc-day-today': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
              '& .fc .fc-daygrid-day-number': { color: 'text.primary', p: 1 },
              '& .fc .fc-event': { borderRadius: 1, borderLeftWidth: 3, cursor: 'pointer', overflow: 'hidden' },
              '& .fc .fc-more-link': { color: 'primary.main', fontWeight: 700 },
            }}
          >
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              firstDay={0}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              buttonText={{ today: 'Today' }}
              height="auto"
              events={events}
              dayMaxEvents={MAX_VISIBLE_ROWS}
              fixedWeekCount={false}
              displayEventTime={false}
              eventClick={(info) => setSelectedBooking(bookingById.get(info.event.id) ?? null)}
              eventDidMount={(info) => {
                const booking = bookingById.get(info.event.id);
                if (booking) {
                  info.el.title = bookingTooltip(booking);
                  info.el.setAttribute('aria-label', bookingTooltip(booking).replaceAll('\n', ', '));
                }
              }}
              eventContent={(info) => (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, px: 0.5, py: 0.2 }}>
                  <Typography component="span" variant="caption" fontWeight={700} noWrap>{info.event.title}</Typography>
                  <Typography component="span" variant="caption" noWrap sx={{ opacity: 0.85 }}>
                    — {info.event.extendedProps.itemName || 'Item'} {info.event.extendedProps.size || ''}
                  </Typography>
                  <Box component="span" sx={{ ml: 'auto!important', fontSize: 9, fontWeight: 700 }}>{info.event.extendedProps.status}</Box>
                </Stack>
              )}
              moreLinkClick={(info) => { setOverflowDate(dayjs(info.date).format('YYYY-MM-DD')); }}
              datesSet={(info) => setVisibleRange({
                start: dayjs(info.start).format('YYYY-MM-DD'),
                end: dayjs(info.end).subtract(1, 'day').format('YYYY-MM-DD'),
              })}
            />
          </Box>
        </Paper>
      </Stack>

      <Dialog open={Boolean(overflowDate)} onClose={() => setOverflowDate(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 7 }}>
          Bookings on {overflowDate ? dayjs(overflowDate).format('MMMM D, YYYY') : ''}
          <IconButton aria-label="Close booking list" onClick={() => setOverflowDate(null)} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <List disablePadding>
            {overflowBookings.map((booking) => (
              <ListItemButton key={booking.id} onClick={() => { setOverflowDate(null); setSelectedBooking(booking); }}>
                <ListItemAvatar><Avatar src={booking.item?.image_url ?? undefined}><CalendarMonthRoundedIcon /></Avatar></ListItemAvatar>
                <ListItemText
                  primary={booking.renter_name}
                  secondary={`${booking.item?.item_name || 'Unknown item'} · ${booking.date_rented} – ${booking.date_returned}`}
                />
                <Chip size="small" label={booking.status} sx={{ color: statusStyles[booking.status].color, bgcolor: statusStyles[booking.status].background }} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <BookingDetailsDialog
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onPreview={(url, alt, title) => setPreview({ url, alt, title })}
      />
      <ImagePreviewDialog imageUrl={preview?.url ?? null} alt={preview?.alt ?? 'Booking image'} title={preview?.title} onClose={() => setPreview(null)} />
    </PageContainer>
  );
}
