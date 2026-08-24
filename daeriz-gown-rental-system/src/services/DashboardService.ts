import dayjs from 'dayjs';
import { supabase } from './supabase';
import { RENTAL_STATUSES, type RentalHistoryRecord, type RentalRecord } from './RentalService';
import {
  PAYMENT_TYPES,
  calculateFinancialSummary,
  getPaymentsForRentals,
  type RentalFinancialSummary,
  type RentalPayment,
} from './PaymentService';
import type { BookingBranch } from './BookingService';

export interface DashboardRental extends RentalRecord {
  financial: RentalFinancialSummary;
}

export interface DashboardActivity extends RentalHistoryRecord {
  rental?: {
    renter_name?: string | null;
    item?: { item_name?: string | null } | null;
  } | null;
}

export interface OperationsDashboardData {
  today: string;
  todaysPickups: DashboardRental[];
  todaysReturns: DashboardRental[];
  overdue: DashboardRental[];
  inLaundry: DashboardRental[];
  shopReturn: DashboardRental[];
  upcoming: DashboardRental[];
  unpaid: DashboardRental[];
  paymentsToday: { gross: number; refunds: number; net: number };
  outstandingBalance: number;
  depositsHeld: number;
  branches: BookingBranch[];
  recentActivity: DashboardActivity[];
  warnings: string[];
}

const dashboardRentalSelect = `
  *,
  item:DBLG_ITEMS!DBLG_RENTALS_item_rented_id_fkey(
    id, item_name, category, size, avail_qty, total_qty, image_url
  ),
  branch:DBLG_SHOP_BRANCH!DBLG_RENTALS_branch_id_fkey(id, name, location)
`;

function sumPaymentsToday(payments: RentalPayment[]) {
  const gross = payments.filter((payment) => payment.payment_type !== PAYMENT_TYPES.REFUND)
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const refunds = payments.filter((payment) => payment.payment_type === PAYMENT_TYPES.REFUND)
    .reduce((total, payment) => total + Number(payment.amount), 0);
  return { gross, refunds, net: gross - refunds };
}

export async function getOperationsDashboard(branchId?: string): Promise<OperationsDashboardData> {
  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const upcomingEnd = dayjs().add(7, 'day').format('YYYY-MM-DD');
  const dayStart = dayjs().startOf('day').toISOString();
  const dayEnd = dayjs().add(1, 'day').startOf('day').toISOString();

  let rentalQuery = supabase
    .from('DBLG_RENTALS')
    .select(dashboardRentalSelect)
    .neq('status', RENTAL_STATUSES.COMPLETED)
    .order('date_rented');
  if (branchId) rentalQuery = rentalQuery.eq('branch_id', branchId);
  const { data: rentalData, error: rentalError } = await rentalQuery;
  if (rentalError) {
    console.error('Dashboard rental query failed', rentalError);
    throw rentalError;
  }
  const rentals = (rentalData ?? []) as RentalRecord[];
  const rentalIds = rentals.map((rental) => rental.id);

  let todayPaymentQuery = supabase
    .from('DBLG_RENTAL_PAYMENTS')
    .select('*, rental:DBLG_RENTALS!DBLG_RENTAL_PAYMENTS_rental_id_fkey!inner(branch_id)')
    .gte('payment_date', dayStart)
    .lt('payment_date', dayEnd);
  if (branchId) todayPaymentQuery = todayPaymentQuery.eq('rental.branch_id', branchId);

  let activityQuery = supabase
    .from('DBLG_RENTAL_HISTORY')
    .select('id, rental_id, processed_by_id, action, notes, created_at, rental:DBLG_RENTALS!DBLG_RENTAL_HISTORY_rental_id_fkey!inner(renter_name, branch_id, item:DBLG_ITEMS!DBLG_RENTALS_item_rented_id_fkey(item_name))')
    .order('created_at', { ascending: false })
    .limit(8);
  if (branchId) activityQuery = activityQuery.eq('rental.branch_id', branchId);

  const [activePaymentsResult, todayPaymentResult, branchResult, activityResult] = await Promise.allSettled([
    getPaymentsForRentals(rentalIds),
    todayPaymentQuery,
    supabase.from('DBLG_SHOP_BRANCH').select('id, name, location').order('name'),
    activityQuery,
  ]);

  const warnings: string[] = [];
  let activePayments: RentalPayment[] = [];
  if (activePaymentsResult.status === 'fulfilled') {
    activePayments = activePaymentsResult.value;
  } else {
    console.error('Dashboard active payment query failed', activePaymentsResult.reason);
    warnings.push('Payment balances could not be loaded. Financial totals may be incomplete.');
  }

  let paymentsToday: RentalPayment[] = [];
  if (todayPaymentResult.status === 'rejected') {
    console.error('Dashboard payments-today query failed', todayPaymentResult.reason);
    warnings.push('Today\'s payment totals could not be loaded.');
  } else if (todayPaymentResult.value.error) {
    console.error('Dashboard payments-today query failed', todayPaymentResult.value.error);
    warnings.push('Today\'s payment totals could not be loaded.');
  } else {
    paymentsToday = (todayPaymentResult.value.data ?? []) as RentalPayment[];
  }

  let branches: BookingBranch[] = [];
  if (branchResult.status === 'rejected') {
    console.error('Dashboard branch query failed', branchResult.reason);
    warnings.push('Branch options could not be loaded.');
  } else if (branchResult.value.error) {
    console.error('Dashboard branch query failed', branchResult.value.error);
    warnings.push('Branch options could not be loaded.');
  } else {
    branches = (branchResult.value.data ?? []) as BookingBranch[];
  }

  let recentActivity: DashboardActivity[] = [];
  if (activityResult.status === 'rejected') {
    console.error('Dashboard recent activity query failed', activityResult.reason);
    warnings.push('Recent activity could not be loaded.');
  } else if (activityResult.value.error) {
    console.error('Dashboard recent activity query failed', activityResult.value.error);
    warnings.push('Recent activity could not be loaded.');
  } else {
    recentActivity = (activityResult.value.data ?? []) as DashboardActivity[];
  }

  const paymentsByRental = new Map<string, RentalPayment[]>();
  activePayments.forEach((payment) => paymentsByRental.set(payment.rental_id, [...(paymentsByRental.get(payment.rental_id) ?? []), payment]));
  const enriched: DashboardRental[] = rentals.map((rental) => ({
    ...rental,
    financial: calculateFinancialSummary(rental, paymentsByRental.get(rental.id) ?? []),
  }));
  const byDate = (a: DashboardRental, b: DashboardRental) => a.date_rented.localeCompare(b.date_rented);

  return {
    today,
    todaysPickups: enriched.filter((rental) => rental.status === RENTAL_STATUSES.RENTING && rental.date_rented === today),
    todaysReturns: enriched.filter((rental) => rental.status === RENTAL_STATUSES.RENTING && rental.date_returned === today),
    overdue: enriched.filter((rental) => rental.status === RENTAL_STATUSES.RENTING && rental.date_returned < today),
    inLaundry: enriched.filter((rental) => rental.status === RENTAL_STATUSES.IN_LAUNDRY),
    shopReturn: enriched.filter((rental) => rental.status === RENTAL_STATUSES.SHOP_RETURN),
    upcoming: enriched.filter((rental) => rental.status === RENTAL_STATUSES.RENTING && rental.date_rented >= tomorrow && rental.date_rented <= upcomingEnd).sort(byDate).slice(0, 8),
    unpaid: enriched.filter((rental) => rental.financial.rentalBalance > 0),
    paymentsToday: sumPaymentsToday(paymentsToday),
    outstandingBalance: enriched.reduce((total, rental) => total + rental.financial.rentalBalance, 0),
    depositsHeld: enriched.reduce((total, rental) => total + rental.financial.depositHeld, 0),
    branches,
    recentActivity,
    warnings: [...new Set(warnings)],
  };
}
