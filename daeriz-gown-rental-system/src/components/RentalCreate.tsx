import * as React from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  createRental,
  getRentalErrorMessage,
  type CreateRentalValues,
} from '../services/RentalService';
import { getBookingOptions, type BookingBranch, type BookingItem } from '../services/BookingService';
import PageContainer from './PageContainer';
import useNotifications from '../hooks/useNotifications/useNotifications';

const initialValues: CreateRentalValues = {
  branch_id: '',
  item_rented_id: '',
  date_rented: '',
  date_returned: '',
  renter_name: '',
  renter_contact_no: '',
  rental_amount: 0,
  security_deposit_amount: 0,
  discount_amount: 0,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" mb={2}>{title}</Typography>
      {children}
    </Paper>
  );
}

export default function CreateRental() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [items, setItems] = React.useState<BookingItem[]>([]);
  const [branches, setBranches] = React.useState<BookingBranch[]>([]);
  const [values, setValues] = React.useState<CreateRentalValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    getBookingOptions()
      .then(({ items: itemRows, branches: branchRows }) => {
        setItems(itemRows);
        setBranches(branchRows);
        if (branchRows.length === 1) setValues((current) => ({ ...current, branch_id: branchRows[0].id }));
      })
      .catch(() => setErrorMessage('Unable to load branches and items.'))
      .finally(() => setIsLoadingOptions(false));
  }, []);

  const branchItems = React.useMemo(
    () => values.branch_id ? items.filter((item) => item.branch_id === values.branch_id) : [],
    [items, values.branch_id],
  );
  const selectedItem = branchItems.find((item) => item.id === values.item_rented_id) ?? null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!values.date_rented || !values.date_returned
      || dayjs(values.date_returned).isBefore(dayjs(values.date_rented), 'day')) {
      setErrorMessage('Return date cannot be before rental date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createRental(values);
      notifications.show('Rental created successfully.', { severity: 'success' });
      navigate('/bookings');
    } catch (error) {
      setErrorMessage(getRentalErrorMessage(error));
      console.error('Rental creation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Create Rental"
      breadcrumbs={[{ title: 'Active Rentals', path: '/reports/rentals' }, { title: 'Create' }]}
    >
      <Box component="form" onSubmit={handleSubmit} maxWidth={920} width="100%" mx="auto">
        <Stack spacing={2}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          <Section title="Customer">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField required fullWidth label="Renter Name" value={values.renter_name} onChange={(event) => setValues((current) => ({ ...current, renter_name: event.target.value }))} autoComplete="name" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField required fullWidth label="Contact Number" type="tel" value={values.renter_contact_no} onChange={(event) => setValues((current) => ({ ...current, renter_contact_no: event.target.value }))} slotProps={{ htmlInput: { inputMode: 'tel', autoComplete: 'tel' } }} helperText="Stored as entered, including a leading zero." />
              </Grid>
            </Grid>
          </Section>

          <Section title="Booking">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select required fullWidth label="Branch" value={values.branch_id}
                  disabled={isLoadingOptions}
                  onChange={(event) => setValues((current) => ({ ...current, branch_id: event.target.value, item_rented_id: '' }))}
                >
                  {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  options={branchItems}
                  value={selectedItem}
                  disabled={!values.branch_id || isLoadingOptions}
                  onChange={(_event, item) => setValues((current) => ({ ...current, item_rented_id: item?.id ?? '' }))}
                  getOptionLabel={(item) => `${item.item_name} — ${item.size || 'No size'} — ${item.avail_qty} available`}
                  renderOption={(props, item) => (
                    <Box component="li" {...props} key={item.id} sx={{ gap: 1.5 }}>
                      <Avatar variant="rounded" src={item.image_url ?? undefined} alt="" />
                      <Box minWidth={0}>
                        <Typography variant="body2" noWrap>{item.item_name} — {item.size || 'No size'}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.avail_qty} available · {item.category || 'Uncategorized'}</Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => <TextField {...params} required label="Item" helperText={!values.branch_id ? 'Select a branch first.' : 'Availability for these dates is verified when saved.'} />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Rental Date"
                  value={values.date_rented ? dayjs(values.date_rented) : null}
                  onChange={(date) => setValues((current) => ({ ...current, date_rented: date?.format('YYYY-MM-DD') ?? '', date_returned: current.date_returned && date && dayjs(current.date_returned).isBefore(date, 'day') ? '' : current.date_returned }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Return Date"
                  value={values.date_returned ? dayjs(values.date_returned) : null}
                  minDate={values.date_rented ? dayjs(values.date_rented) : undefined}
                  disabled={!values.date_rented}
                  onChange={(date) => setValues((current) => ({ ...current, date_returned: date?.format('YYYY-MM-DD') ?? '' }))}
                  slotProps={{ textField: { fullWidth: true, required: true, helperText: 'The return date is included in the booking.' } }}
                />
              </Grid>
            </Grid>
          </Section>

          <Section title="Financial Agreement">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField required fullWidth type="number" label="Rental Amount" value={values.rental_amount} onChange={(event) => setValues((current) => ({ ...current, rental_amount: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 0, step: '0.01' } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField required fullWidth type="number" label="Security Deposit Required" value={values.security_deposit_amount} onChange={(event) => setValues((current) => ({ ...current, security_deposit_amount: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 0, step: '0.01' } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField required fullWidth type="number" label="Discount" value={values.discount_amount} onChange={(event) => setValues((current) => ({ ...current, discount_amount: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 0, max: values.rental_amount, step: '0.01' } }} helperText="Cannot exceed the rental amount." />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Alert severity="info">Payments and receipt images are recorded from Rental Details after this rental is created.</Alert>
              </Grid>
            </Grid>
          </Section>

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" gap={1}>
            <Button onClick={() => navigate('/reports/rentals')} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || isLoadingOptions} startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}>
              {isSubmitting ? 'Saving Rental...' : 'Create Rental'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </PageContainer>
  );
}
