import * as React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddCardRoundedIcon from '@mui/icons-material/AddCardRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import type { RentalRecord, RentalHistoryRecord } from '../services/RentalService';
import { getRentalHistory } from '../services/RentalService';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_OPTIONS,
  calculateFinancialSummary,
  createPayment,
  getPaymentErrorMessage,
  getRentalPayments,
  uploadPaymentReceipt,
  type PaymentMethod,
  type PaymentType,
  type RentalFinancialSummary,
  type RentalPayment,
} from '../services/PaymentService';
import { formatPeso } from '../utils/currency';
import { ImagePreviewDialog, ImageThumbnail } from './ImagePreview';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { useOutletContext } from 'react-router-dom';
import type { DashboardOutletContext } from './DashboardLayout';

type AddPaymentConfig = {
  title: string;
  type: PaymentType;
  suggestedAmount?: number;
  depositRefundOnly?: boolean;
};

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value || '—'}</Typography></Box>;
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: 'success' | 'warning' }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', borderColor: accent ? `${accent}.main` : 'divider' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" color={accent ? `${accent}.main` : 'text.primary'}>{value}</Typography>
    </Paper>
  );
}

function refundablePayments(payments: RentalPayment[], depositOnly: boolean) {
  const refunded = new Map<string, number>();
  payments.filter((payment) => payment.payment_type === PAYMENT_TYPES.REFUND && payment.related_payment_id)
    .forEach((payment) => refunded.set(payment.related_payment_id!, (refunded.get(payment.related_payment_id!) ?? 0) + Number(payment.amount)));
  return payments
    .filter((payment) => payment.payment_type !== PAYMENT_TYPES.REFUND)
    .filter((payment) => !depositOnly || payment.payment_type === PAYMENT_TYPES.SECURITY_DEPOSIT)
    .map((payment) => ({ payment, remaining: Math.max(Number(payment.amount) - (refunded.get(payment.id) ?? 0), 0) }))
    .filter(({ remaining }) => remaining > 0);
}

function AddPaymentDialog({ rental, payments, config, onClose, onSaved, canRefund }: {
  rental: RentalRecord;
  payments: RentalPayment[];
  config: AddPaymentConfig;
  onClose: () => void;
  onSaved: () => Promise<void>;
  canRefund: boolean;
}) {
  const notifications = useNotifications();
  const [paymentType, setPaymentType] = React.useState<PaymentType>(config.type);
  const [amount, setAmount] = React.useState(config.suggestedAmount?.toString() ?? '');
  const [method, setMethod] = React.useState<PaymentMethod>(PAYMENT_METHODS.CASH);
  const [reference, setReference] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [paymentDate, setPaymentDate] = React.useState<Dayjs | null>(dayjs());
  const [relatedPaymentId, setRelatedPaymentId] = React.useState('');
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const refundOptions = refundablePayments(payments, Boolean(config.depositRefundOnly));

  React.useEffect(() => () => { if (receiptPreview) URL.revokeObjectURL(receiptPreview); }, [receiptPreview]);

  const handleReceipt = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setError('Receipt must be an image file no larger than 5 MB.');
      event.target.value = '';
      return;
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    const numericAmount = Number(amount);
    const summary = calculateFinancialSummary(rental, payments);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (method !== PAYMENT_METHODS.CASH && !reference.trim()) {
      setError('A reference number is required for this payment method.');
      return;
    }
    if (!paymentDate?.isValid()) {
      setError('Payment date is required.');
      return;
    }
    if ((paymentType === PAYMENT_TYPES.DOWN_PAYMENT || paymentType === PAYMENT_TYPES.RENTAL_PAYMENT) && numericAmount > summary.rentalBalance) {
      setError('Payment exceeds the remaining rental balance.');
      return;
    }
    if (paymentType === PAYMENT_TYPES.SECURITY_DEPOSIT && numericAmount > summary.depositOutstanding) {
      setError('Deposit exceeds the remaining required security deposit.');
      return;
    }
    if (paymentType === PAYMENT_TYPES.REFUND) {
      const selectedRefund = refundOptions.find(({ payment }) => payment.id === relatedPaymentId);
      if (!selectedRefund) {
        setError('Select the payment being refunded.');
        return;
      }
      if (numericAmount > selectedRefund.remaining) {
        setError(selectedRefund.payment.payment_type === PAYMENT_TYPES.SECURITY_DEPOSIT ? 'Refund exceeds the remaining security deposit.' : 'Refund exceeds the remaining refundable payment amount.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const receiptImg = receiptFile ? await uploadPaymentReceipt(rental.id, receiptFile) : undefined;
      await createPayment({
        rental_id: rental.id,
        payment_type: paymentType,
        amount: numericAmount,
        payment_method: method,
        reference_no: reference,
        receipt_img: receiptImg,
        payment_date: paymentDate?.toISOString() ?? '',
        notes,
        related_payment_id: paymentType === PAYMENT_TYPES.REFUND ? relatedPaymentId : undefined,
      });
      notifications.show(paymentType === PAYMENT_TYPES.REFUND ? 'Refund recorded successfully.' : 'Payment recorded successfully.', { severity: 'success' });
      await onSaved();
      onClose();
    } catch (paymentError) {
      console.error('Payment recording failed:', paymentError);
      setError(getPaymentErrorMessage(paymentError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{config.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={0.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl fullWidth required>
            <InputLabel id="payment-type-label">Payment Type</InputLabel>
            <Select labelId="payment-type-label" label="Payment Type" value={paymentType} onChange={(event) => { setPaymentType(event.target.value as PaymentType); setRelatedPaymentId(''); }} disabled={Boolean(config.depositRefundOnly)}>
              {PAYMENT_TYPE_OPTIONS.filter((option) => canRefund || option !== PAYMENT_TYPES.REFUND).map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          {paymentType === PAYMENT_TYPES.REFUND && (
            <FormControl fullWidth required>
              <InputLabel id="refund-payment-label">Original Payment</InputLabel>
              <Select labelId="refund-payment-label" label="Original Payment" value={relatedPaymentId} onChange={(event) => { setRelatedPaymentId(event.target.value); const option = refundOptions.find(({ payment }) => payment.id === event.target.value); if (option) setAmount(option.remaining.toString()); }}>
                {refundOptions.map(({ payment, remaining }) => <MenuItem key={payment.id} value={payment.id}>{payment.payment_type} · {dayjs(payment.payment_date).format('MMM D')} · {formatPeso(remaining)} refundable</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <TextField required fullWidth type="number" label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} slotProps={{ htmlInput: { min: 0.01, step: '0.01' } }} />
          <FormControl fullWidth required>
            <InputLabel id="payment-method-label">Payment Method</InputLabel>
            <Select labelId="payment-method-label" label="Payment Method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHOD_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth required={method !== PAYMENT_METHODS.CASH} label="Reference Number" value={reference} onChange={(event) => setReference(event.target.value)} helperText={method === PAYMENT_METHODS.CASH ? 'Optional for cash.' : 'Required for this payment method.'} />
          <DateTimePicker label="Payment Date" value={paymentDate} onChange={setPaymentDate} slotProps={{ textField: { required: true, fullWidth: true } }} />
          <TextField fullWidth multiline minRows={2} label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Stack direction="row" spacing={2} alignItems="center">
            <Button component="label" variant="outlined" startIcon={<UploadRoundedIcon />} disabled={submitting}>
              Add Receipt
              <input hidden type="file" accept="image/*" onChange={handleReceipt} />
            </Button>
            {receiptPreview && <Box component="img" src={receiptPreview} alt="Payment receipt preview" sx={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}>{submitting ? 'Saving...' : 'Record'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function PaymentPanel({ rental, payments, summary, loading, onAdd, onPreview, canRefund }: {
  rental: RentalRecord;
  payments: RentalPayment[];
  summary: RentalFinancialSummary;
  loading: boolean;
  onAdd: (config: AddPaymentConfig) => void;
  onPreview: (url: string, alt: string, title: string) => void;
  canRefund: boolean;
}) {
  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Rental Amount" value={formatPeso(summary.grossRentalAmount)} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Discount" value={formatPeso(summary.discount)} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Net Rental" value={formatPeso(summary.netRentalAmount)} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Rental Paid" value={formatPeso(summary.rentalPaid)} accent={summary.paymentStatus === 'Paid' ? 'success' : undefined} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Rental Balance" value={formatPeso(summary.rentalBalance)} accent={summary.rentalBalance > 0 ? 'warning' : 'success'} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Deposit Required" value={formatPeso(summary.depositRequired)} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Deposit Collected" value={formatPeso(summary.depositCollected)} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Deposit Refunded" value={formatPeso(summary.depositRefunded)} /></Grid>
        <Grid size={{ xs: 6, sm: 4 }}><SummaryCard label="Deposit Held" value={formatPeso(summary.depositHeld)} /></Grid>
      </Grid>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Button variant="contained" startIcon={<AddCardRoundedIcon />} onClick={() => onAdd({ title: 'Add Payment', type: summary.rentalPaid > 0 ? PAYMENT_TYPES.RENTAL_PAYMENT : PAYMENT_TYPES.DOWN_PAYMENT, suggestedAmount: summary.rentalBalance })}>Add Payment</Button>
        {summary.depositOutstanding > 0 && <Button variant="outlined" startIcon={<SavingsRoundedIcon />} onClick={() => onAdd({ title: 'Collect Security Deposit', type: PAYMENT_TYPES.SECURITY_DEPOSIT, suggestedAmount: summary.depositOutstanding })}>Collect Deposit</Button>}
        {canRefund && summary.depositHeld > 0 && <Button variant="outlined" color="warning" startIcon={<ReplayRoundedIcon />} onClick={() => onAdd({ title: 'Refund Security Deposit', type: PAYMENT_TYPES.REFUND, suggestedAmount: summary.depositHeld, depositRefundOnly: true })}>Refund Deposit</Button>}
      </Stack>
      <Typography variant="subtitle1" fontWeight={700}>Payment History</Typography>
      {loading ? <Box textAlign="center" py={3}><CircularProgress size={24} /></Box> : payments.length ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Method</TableCell><TableCell align="right">Amount</TableCell><TableCell>Reference</TableCell><TableCell>Receipt</TableCell></TableRow></TableHead>
            <TableBody>{payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{dayjs(payment.payment_date).format('MMM D, YYYY h:mm A')}</TableCell>
                <TableCell><Chip size="small" label={payment.payment_type} color={payment.payment_type === PAYMENT_TYPES.REFUND ? 'warning' : 'default'} /></TableCell>
                <TableCell>{payment.payment_method}</TableCell>
                <TableCell align="right" sx={{ color: payment.payment_type === PAYMENT_TYPES.REFUND ? 'warning.main' : undefined }}>{payment.payment_type === PAYMENT_TYPES.REFUND ? '−' : ''}{formatPeso(payment.amount)}</TableCell>
                <TableCell>{payment.reference_no || '—'}</TableCell>
                <TableCell>{payment.receipt_img ? <ImageThumbnail src={payment.receipt_img} alt={`${payment.payment_type} receipt`} size={36} onPreview={(url, alt) => onPreview(url, alt, 'Payment receipt')} /> : '—'}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
      ) : <Alert severity="info">No payments have been recorded.</Alert>}
      {rental.receipt_img && <Alert severity="info">This rental has a legacy receipt with no reliable amount or payment method. It is preserved in Overview and is not counted as a payment.</Alert>}
    </Stack>
  );
}

export default function RentalDetailsDialog({ rental, onClose }: { rental: RentalRecord | null; onClose: () => void }) {
  const { user } = useOutletContext<DashboardOutletContext>();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = React.useState(0);
  const [payments, setPayments] = React.useState<RentalPayment[]>([]);
  const [history, setHistory] = React.useState<RentalHistoryRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [addPayment, setAddPayment] = React.useState<AddPaymentConfig | null>(null);
  const [preview, setPreview] = React.useState<{ url: string; alt: string; title: string } | null>(null);

  const loadDetails = React.useCallback(async () => {
    if (!rental) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [paymentRows, historyRows] = await Promise.all([getRentalPayments(rental.id), getRentalHistory(rental.id)]);
      setPayments(paymentRows);
      setHistory(historyRows);
    } catch (error) {
      console.error('Rental financial details load failed:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [rental]);

  React.useEffect(() => { if (rental) void loadDetails(); }, [loadDetails, rental]);
  const summary = rental ? calculateFinancialSummary(rental, payments) : null;

  return (
    <>
      <Dialog open={Boolean(rental)} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 7 }}>Rental Details<IconButton aria-label="Close rental details" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRoundedIcon /></IconButton></DialogTitle>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" aria-label="Rental details sections"><Tab label="Overview" /><Tab label="Payment" /><Tab label="History" /></Tabs>
        <DialogContent dividers>
          {loadError && <Alert severity="error" action={<Button onClick={() => void loadDetails()}>Retry</Button>} sx={{ mb: 2 }}>Unable to load complete rental details.</Alert>}
          {rental && tab === 0 && (
            <Stack spacing={3}>
              <Box><Typography variant="overline" color="text.secondary">Renter</Typography><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Name" value={rental.renter_name} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DetailRow label="Contact" value={rental.renter_contact_no} /></Grid></Grid></Box>
              <Divider />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <ImageThumbnail src={rental.item?.image_url} alt={rental.item?.item_name ?? 'Rental item'} size={96} fallback="No image" onPreview={(url, alt) => setPreview({ url, alt, title: 'Item image' })} />
                <Grid container spacing={2} flex={1}><Grid size={{ xs: 12, sm: 4 }}><DetailRow label="Item" value={rental.item?.item_name} /></Grid><Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Category" value={rental.item?.category} /></Grid><Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Size" value={rental.item?.size} /></Grid><Grid size={{ xs: 12, sm: 4 }}><DetailRow label="Branch" value={rental.branch?.name} /></Grid><Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Rental Date" value={dayjs(rental.date_rented).format('MMM D, YYYY')} /></Grid><Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Return Date" value={dayjs(rental.date_returned).format('MMM D, YYYY')} /></Grid><Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Status" value={<Chip size="small" label={rental.status} />} /></Grid><Grid size={{ xs: 6, sm: 4 }}><DetailRow label="Actual Return" value={rental.actual_returned_date ? dayjs(rental.actual_returned_date).format('MMM D, YYYY h:mm A') : undefined} /></Grid></Grid>
              </Stack>
              {rental.receipt_img && <Box><Typography variant="overline" color="text.secondary">Legacy Receipt</Typography><ImageThumbnail src={rental.receipt_img} alt={`Legacy receipt for ${rental.renter_name}`} size={72} onPreview={(url, alt) => setPreview({ url, alt, title: 'Legacy receipt' })} /></Box>}
            </Stack>
          )}
          {rental && summary && tab === 1 && <PaymentPanel rental={rental} payments={payments} summary={summary} loading={loading} onAdd={setAddPayment} onPreview={(url, alt, title) => setPreview({ url, alt, title })} canRefund={user?.role === 'admin'} />}
          {tab === 2 && (loading ? <Box textAlign="center" py={3}><CircularProgress size={24} /></Box> : history.length ? <Stack divider={<Divider flexItem />} spacing={1.5}>{history.map((entry) => <Box key={entry.id}><Typography variant="body2" fontWeight={700}>{entry.action?.replaceAll('_', ' ') || 'Activity'}</Typography><Typography variant="body2" color="text.secondary">{entry.notes || 'No notes'}</Typography><Typography variant="caption" color="text.secondary">{dayjs(entry.created_at).format('MMM D, YYYY h:mm A')}</Typography></Box>)}</Stack> : <Alert severity="info">No rental history has been recorded.</Alert>)}
        </DialogContent>
      </Dialog>
      {rental && addPayment && <AddPaymentDialog key={`${addPayment.title}-${addPayment.type}`} rental={rental} payments={payments} config={addPayment} onClose={() => setAddPayment(null)} onSaved={loadDetails} canRefund={user?.role === 'admin'} />}
      <ImagePreviewDialog imageUrl={preview?.url ?? null} alt={preview?.alt ?? 'Rental image'} title={preview?.title} onClose={() => setPreview(null)} />
    </>
  );
}
