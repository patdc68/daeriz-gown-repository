import dayjs, { type Dayjs } from 'dayjs';
import { supabase } from './supabase';

export type AnalyticsScope = 'today' | 'yearToDate';

interface AnalyticsRentalRow {
  id: string;
  branch_id: string | null;
  item_rented_id: string | null;
  date_rented: string;
}

interface AnalyticsBranchRow {
  id: string;
  name: string | null;
}

interface AnalyticsItemRow {
  id: string;
  item_name: string | null;
  image_url: string | null;
}

export interface BranchRentalSummary {
  branchId: string;
  branchName: string;
  rentalCount: number;
  percentage: number;
}

export interface TopItemSummary {
  branchId: string;
  branchName: string;
  itemId: string;
  itemName: string;
  imageUrl: string | null;
  rentalCount: number;
  branchShare: number;
}

export interface RentalAnalytics {
  totalRentals: number;
  branches: BranchRentalSummary[];
  topItems: TopItemSummary[];
}

export function getAnalyticsDateRange(scope: AnalyticsScope, now: Dayjs = dayjs()) {
  const end = now.endOf('day');
  const start = scope === 'today' ? now.startOf('day') : now.startOf('year');

  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    label: scope === 'today'
      ? `Today: ${now.format('MMMM D, YYYY')}`
      : `Year to Date: ${start.format('MMM D, YYYY')} - ${now.format('MMMM D, YYYY')}`,
  };
}

function branchName(branchId: string, branches: Map<string, AnalyticsBranchRow>) {
  return branches.get(branchId)?.name || `Branch #${branchId}`;
}

function itemName(itemId: string, items: Map<string, AnalyticsItemRow>) {
  return items.get(itemId)?.item_name || `Item #${itemId}`;
}

export function summarizeRentalAnalytics(
  rentals: AnalyticsRentalRow[],
  branchRows: AnalyticsBranchRow[],
  itemRows: AnalyticsItemRow[],
): RentalAnalytics {
  const branches = new Map(branchRows.map((branch) => [branch.id, branch]));
  const items = new Map(itemRows.map((item) => [item.id, item]));
  const rentalsPerBranch = new Map<string, number>();
  const rentalsPerBranchItem = new Map<string, Map<string, number>>();

  rentals.forEach((rental) => {
    const branchId = rental.branch_id || 'unassigned';
    rentalsPerBranch.set(branchId, (rentalsPerBranch.get(branchId) ?? 0) + 1);

    if (!rental.item_rented_id) return;
    const itemCounts = rentalsPerBranchItem.get(branchId) ?? new Map<string, number>();
    itemCounts.set(rental.item_rented_id, (itemCounts.get(rental.item_rented_id) ?? 0) + 1);
    rentalsPerBranchItem.set(branchId, itemCounts);
  });

  const totalRentals = rentals.length;
  const branchSummaries = Array.from(rentalsPerBranch, ([branchId, rentalCount]) => ({
    branchId,
    branchName: branchName(branchId, branches),
    rentalCount,
    percentage: totalRentals ? (rentalCount / totalRentals) * 100 : 0,
  })).sort((a, b) => b.rentalCount - a.rentalCount || a.branchName.localeCompare(b.branchName));

  const topItems = Array.from(rentalsPerBranchItem, ([branchId, itemCounts]) => {
    const [itemId, rentalCount] = Array.from(itemCounts).sort(([aId, aCount], [bId, bCount]) =>
      bCount - aCount || itemName(aId, items).localeCompare(itemName(bId, items)),
    )[0];
    const item = items.get(itemId);
    const branchRentalCount = rentalsPerBranch.get(branchId) ?? 0;

    return {
      branchId,
      branchName: branchName(branchId, branches),
      itemId,
      itemName: itemName(itemId, items),
      imageUrl: item?.image_url ?? null,
      rentalCount,
      branchShare: branchRentalCount ? (rentalCount / branchRentalCount) * 100 : 0,
    };
  }).sort((a, b) => b.rentalCount - a.rentalCount || a.branchName.localeCompare(b.branchName));

  return { totalRentals, branches: branchSummaries, topItems };
}

export async function getRentalAnalytics(scope: AnalyticsScope): Promise<RentalAnalytics> {
  const { startDate, endDate } = getAnalyticsDateRange(scope);
  const { data: rentals, error: rentalError } = await supabase
    .from('DBLG_RENTALS')
    .select('id, branch_id, item_rented_id, date_rented')
    .gte('date_rented', startDate)
    .lte('date_rented', endDate);

  if (rentalError) throw rentalError;

  const [{ data: branches, error: branchError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from('DBLG_SHOP_BRANCH').select('id, name'),
    supabase.from('DBLG_ITEMS').select('id, item_name, image_url'),
  ]);

  if (branchError) throw branchError;
  if (itemError) throw itemError;

  return summarizeRentalAnalytics(
    (rentals ?? []) as AnalyticsRentalRow[],
    (branches ?? []) as AnalyticsBranchRow[],
    (items ?? []) as AnalyticsItemRow[],
  );
}
