import { supabase } from './supabase';
import type { RentalRecord, RentalStatus } from './RentalService';

export interface BookingItem {
  id: string;
  branch_id: string;
  item_name: string;
  category: string | null;
  size: string | null;
  image_url: string | null;
  total_qty: number;
  avail_qty: number;
  branch?: { name?: string | null } | null;
}

export interface BookingBranch {
  id: string;
  name: string;
  location?: string | null;
}

export interface Booking extends RentalRecord {
  status: RentalStatus;
  item: NonNullable<RentalRecord['item']> | null;
  branch: NonNullable<RentalRecord['branch']> | null;
}

const bookingSelect = `
  id, created_at, branch_id, item_rented_id, date_rented, date_returned,
  renter_name, renter_contact_no, status, actual_returned_date, receipt_img,
  rental_amount, security_deposit_amount, discount_amount,
  item:DBLG_ITEMS!DBLG_RENTALS_item_rented_id_fkey(
    id, item_name, category, size, avail_qty, total_qty, image_url
  ),
  branch:DBLG_SHOP_BRANCH!DBLG_RENTALS_branch_id_fkey(id, name, location)
`;

export async function getBookings(startDate: string, endDate: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('DBLG_RENTALS')
    .select(bookingSelect)
    .lte('date_rented', endDate)
    .gte('date_returned', startDate)
    .order('date_rented')
    .order('renter_name');
  if (error) {
    console.error('Booking query failed', error);
    throw error;
  }
  return (data ?? []) as Booking[];
}

export async function getBookingOptions() {
  const [branchResult, itemResult] = await Promise.all([
    supabase.from('DBLG_SHOP_BRANCH').select('id, name, location').order('name'),
    supabase
      .from('DBLG_ITEMS')
      .select('id, branch_id, item_name, category, size, image_url, total_qty, avail_qty, branch:DBLG_SHOP_BRANCH(name)')
      .order('item_name'),
  ]);
  if (branchResult.error) {
    console.error('Booking branch options query failed', branchResult.error);
    throw branchResult.error;
  }
  if (itemResult.error) {
    console.error('Booking item options query failed', itemResult.error);
    throw itemResult.error;
  }
  return {
    branches: (branchResult.data ?? []) as BookingBranch[],
    items: (itemResult.data ?? []) as BookingItem[],
  };
}
