import dayjs from 'dayjs';
import { supabase } from './supabase';

export const RENTAL_STATUSES = {
  RENTING: 'Renting',
  IN_LAUNDRY: 'In Laundry',
  SHOP_RETURN: 'Shop Return',
  COMPLETED: 'Completed',
} as const;

export type RentalStatus = typeof RENTAL_STATUSES[keyof typeof RENTAL_STATUSES];
export const RENTAL_STATUS_OPTIONS = Object.values(RENTAL_STATUSES);

export interface CreateRentalValues {
  branch_id: string;
  item_rented_id: string;
  date_rented: string;
  date_returned: string;
  renter_name: string;
  renter_contact_no: string;
  rental_amount: number;
  security_deposit_amount: number;
  discount_amount: number;
}

export interface RentalRecord extends CreateRentalValues {
  id: string;
  created_at?: string;
  status: RentalStatus;
  actual_returned_date?: string | null;
  receipt_img?: string | null;
  item?: {
    id?: string;
    item_name?: string | null;
    category?: string | null;
    size?: string | null;
    avail_qty?: number | null;
    total_qty?: number | null;
    image_url?: string | null;
  } | null;
  branch?: { id?: string; name?: string | null; location?: string | null } | null;
}

export interface RentalHistoryRecord {
  id: string;
  rental_id: string;
  processed_by_id: string | null;
  action: string | null;
  notes: string | null;
  created_at: string;
}

const rentalSelect = `
  *,
  item:DBLG_ITEMS!DBLG_RENTALS_item_rented_id_fkey(
    id, item_name, category, size, avail_qty, total_qty, image_url
  ),
  branch:DBLG_SHOP_BRANCH!DBLG_RENTALS_branch_id_fkey(id, name, location)
`;

function validateRental(values: CreateRentalValues) {
  if (!values.branch_id || !values.item_rented_id) {
    throw new Error('Branch and item are required.');
  }
  if (!values.renter_name.trim() || !values.renter_contact_no.trim()) {
    throw new Error('Renter name and contact number are required.');
  }
  if (!values.date_rented || !values.date_returned) {
    throw new Error('Rental date and return date are required.');
  }
  if (!dayjs(values.date_rented, 'YYYY-MM-DD', true).isValid()
    || !dayjs(values.date_returned, 'YYYY-MM-DD', true).isValid()) {
    throw new Error('Enter valid rental and return dates.');
  }
  if (dayjs(values.date_returned).isBefore(dayjs(values.date_rented), 'day')) {
    throw new Error('Return date cannot be before rental date.');
  }
  if ([values.rental_amount, values.security_deposit_amount, values.discount_amount]
    .some((amount) => !Number.isFinite(Number(amount)) || Number(amount) < 0)
    || values.discount_amount > values.rental_amount) {
    throw new Error('Enter valid non-negative rental, deposit, and discount amounts.');
  }
}

export function getRentalErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('fully booked')) {
    return 'The selected item is already fully booked for these dates.';
  }
  if (message.includes('does not belong')) return message;
  if (message.includes('required') || message.includes('cannot be before')) return message;
  return 'Unable to save the rental. Please try again.';
}

export async function getRentalsByStatus(status: RentalStatus) {
  const { data, error } = await supabase
    .from('DBLG_RENTALS')
    .select(rentalSelect)
    .eq('status', status)
    .order('date_rented', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RentalRecord[];
}

export async function getRentalHistory(rentalId: string): Promise<RentalHistoryRecord[]> {
  const { data, error } = await supabase
    .from('DBLG_RENTAL_HISTORY')
    .select('id, rental_id, processed_by_id, action, notes, created_at')
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RentalHistoryRecord[];
}

export async function createRental(values: CreateRentalValues) {
  validateRental(values);
  const { data, error } = await supabase.rpc('create_rental', {
    p_branch_id: values.branch_id,
    p_item_rented_id: values.item_rented_id,
    p_date_rented: values.date_rented,
    p_date_returned: values.date_returned,
    p_renter_name: values.renter_name.trim(),
    p_renter_contact_no: values.renter_contact_no.trim(),
    p_rental_amount: values.rental_amount,
    p_security_deposit_amount: values.security_deposit_amount,
    p_discount_amount: values.discount_amount,
  });
  if (error) throw error;
  return data as RentalRecord;
}

export async function updateRental(values: RentalRecord) {
  validateRental(values);
  const { data, error } = await supabase.rpc('update_rental', {
    p_rental_id: values.id,
    p_branch_id: values.branch_id,
    p_item_rented_id: values.item_rented_id,
    p_date_rented: values.date_rented,
    p_date_returned: values.date_returned,
    p_renter_name: values.renter_name.trim(),
    p_renter_contact_no: values.renter_contact_no.trim(),
    p_rental_amount: values.rental_amount,
    p_security_deposit_amount: values.security_deposit_amount,
    p_discount_amount: values.discount_amount,
  });
  if (error) throw error;
  return data as RentalRecord;
}

export async function updateRentalStatus(row: RentalRecord, newStatus: RentalStatus) {
  if (!RENTAL_STATUS_OPTIONS.includes(newStatus)) throw new Error('Invalid rental status.');
  const { data, error } = await supabase.rpc('update_rental_status', {
    p_rental_id: row.id,
    p_status: newStatus,
  });
  if (error) throw error;
  return data as RentalRecord;
}
