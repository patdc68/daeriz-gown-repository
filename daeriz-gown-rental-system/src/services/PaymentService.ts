import { supabase } from './supabase';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_OPTIONS,
  type PaymentMethod,
  type PaymentType,
  type RentalPayment,
} from '../utils/paymentCalculations';

export {
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_OPTIONS,
  calculateFinancialSummary,
} from '../utils/paymentCalculations';
export type { PaymentMethod, PaymentStatus, PaymentType, RentalFinancialSummary, RentalPayment } from '../utils/paymentCalculations';

export interface CreatePaymentValues {
  rental_id: string;
  payment_type: PaymentType;
  amount: number;
  payment_method: PaymentMethod;
  reference_no?: string;
  receipt_img?: string;
  payment_date: string;
  notes?: string;
  related_payment_id?: string;
}

export async function getRentalPayments(rentalId: string): Promise<RentalPayment[]> {
  const { data, error } = await supabase
    .from('DBLG_RENTAL_PAYMENTS')
    .select('*')
    .eq('rental_id', rentalId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Rental payments query failed', error);
    throw error;
  }
  return (data ?? []) as RentalPayment[];
}

export async function getPaymentsForRentals(rentalIds: string[]): Promise<RentalPayment[]> {
  if (!rentalIds.length) return [];
  const { data, error } = await supabase
    .from('DBLG_RENTAL_PAYMENTS')
    .select('*')
    .in('rental_id', rentalIds);
  if (error) {
    console.error('Rental payment batch query failed', error);
    throw error;
  }
  return (data ?? []) as RentalPayment[];
}

export async function uploadPaymentReceipt(rentalId: string, file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Receipt must be an image file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Receipt image must be 5 MB or smaller.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const filePath = `rental-payments/${rentalId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('item-images').upload(filePath, file);
  if (error) {
    console.error('Payment receipt upload failed', error);
    throw error;
  }
  return supabase.storage.from('item-images').getPublicUrl(filePath).data.publicUrl;
}

export async function createPayment(values: CreatePaymentValues): Promise<RentalPayment> {
  if (!PAYMENT_TYPE_OPTIONS.includes(values.payment_type)) throw new Error('Payment type is required.');
  if (!PAYMENT_METHOD_OPTIONS.includes(values.payment_method)) throw new Error('Payment method is required.');
  if (!Number.isFinite(values.amount) || values.amount <= 0) throw new Error('Payment amount must be greater than zero.');
  if (values.payment_method !== PAYMENT_METHODS.CASH && !values.reference_no?.trim()) {
    throw new Error('A reference number is required for this payment method.');
  }
  if (values.payment_type === PAYMENT_TYPES.REFUND && !values.related_payment_id) {
    throw new Error('Select the payment being refunded.');
  }

  const { data, error } = await supabase.rpc('record_rental_payment', {
    p_rental_id: values.rental_id,
    p_payment_type: values.payment_type,
    p_amount: values.amount,
    p_payment_method: values.payment_method,
    p_reference_no: values.reference_no?.trim() || null,
    p_receipt_img: values.receipt_img || null,
    p_payment_date: values.payment_date,
    p_notes: values.notes?.trim() || null,
    p_related_payment_id: values.related_payment_id || null,
  });
  if (error) {
    console.error('Record rental payment RPC failed', error);
    throw error;
  }
  return data as RentalPayment;
}

export function getPaymentErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);
  const knownMessages = [
    'Payment exceeds', 'Deposit exceeds', 'Refund exceeds', 'Payment amount',
    'reference number', 'Select a valid', 'Select the payment', 'required', 'Only an administrator',
  ];
  return knownMessages.some((known) => message.includes(known))
    ? message
    : 'Unable to record payment. Please try again.';
}
