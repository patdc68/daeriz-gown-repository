import { supabase } from './supabase';

export async function getActiveRentals() {
    const { data, error } = await supabase
        .from('DBLG_RENTALS')
        .select(`
      *,
      item:DBLG_ITEMS(item_name, avail_qty),
      branch:branch_id(name)
    `)
        .in('status', ['Renting', 'In Laundry']);

    if (error) throw error;
    return data;
}

export async function getCompletedRentals() {
    const { data, error } = await supabase
        .from('DBLG_RENTALS')
        .select(`
      *,
      item:DBLG_ITEMS(item_name),
      branch:branch_id(name)
    `)
        .eq('status', 'Completed');

    if (error) throw error;
    return data;
}

export async function createRental(values: any) {
    // 1️⃣ Deduct quantity
    const { data: item } = await supabase
        .from('DBLG_ITEMS')
        .select('avail_qty')
        .eq('id', values.item_rented_id)
        .single();

    if (!item || item.avail_qty <= 0) {
        throw new Error('Item not available');
    }

    await supabase
        .from('DBLG_ITEMS')
        .update({ avail_qty: item.avail_qty - 1 })
        .eq('id', values.item_rented_id);

    // 2️⃣ Insert rental
    const { error } = await supabase
        .from('DBLG_RENTALS')
        .insert({
            branch_id: values.branch_id,
            item_rented_id: values.item_rented_id,
            date_rented: values.date_rented,
            date_returned: values.date_returned,
            renter_name: values.renter_name,
            renter_contact_no: values.renter_contact_no,
            status: 'Renting'
        });

    if (error) throw error;
}

export async function updateRentalStatus(row: any, newStatus: string) {
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset() * 60000;
    const localIso = new Date(localDate.getTime() - offset).toISOString().slice(0, -1);
    await supabase
        .from('DBLG_RENTALS')
        .update({
            status: newStatus,
            actual_returned_date:
                newStatus === 'Completed' ? localIso : null
        })
        .eq('id', row.id);

    // If completed → restore qty
    if (newStatus === 'Completed') {
        const { data: item, error } = await supabase
            .from('DBLG_ITEMS')
            .select('avail_qty')
            .eq('id', row.item_rented_id)
            .single();

        if (error) throw error;

        if (!item) {
            throw new Error('Item not found');
        }

        await supabase
            .from('DBLG_ITEMS')
            .update({ avail_qty: item.avail_qty + 1 })
            .eq('id', row.item_rented_id);
    }
}