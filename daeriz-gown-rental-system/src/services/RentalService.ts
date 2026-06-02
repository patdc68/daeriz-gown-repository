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
    receipt_img?: string;
}

export interface RentalRecord extends CreateRentalValues {
    id: string;
    status: RentalStatus;
    actual_returned_date?: string | null;
    item?: {
        item_name?: string | null;
        avail_qty?: number | null;
        image_url?: string | null;
    } | null;
    branch?: {
        name?: string | null;
    } | null;
}

const rentalSelect = `
    *,
    item:DBLG_ITEMS(item_name, avail_qty, image_url),
    branch:branch_id(name)
`;

export async function getRentalsByStatus(status: RentalStatus) {
    const { data, error } = await supabase
        .from('DBLG_RENTALS')
        .select(rentalSelect)
        .eq('status', status);

    if (error) throw error;
    return (data ?? []) as RentalRecord[];
}

export async function uploadRentalReceipt(file: File) {
    if (!file.type.startsWith('image/')) {
        throw new Error('Receipt image must be an image file.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const filePath = `rental-receipts/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

    return data.publicUrl;
}

export async function createRental(values: CreateRentalValues) {
    const { data: item, error: itemError } = await supabase
        .from('DBLG_ITEMS')
        .select('avail_qty')
        .eq('id', values.item_rented_id)
        .single();

    if (itemError) throw itemError;
    if (!item || item.avail_qty <= 0) {
        throw new Error('Item not available');
    }

    const { error: quantityError } = await supabase
        .from('DBLG_ITEMS')
        .update({ avail_qty: item.avail_qty - 1 })
        .eq('id', values.item_rented_id);

    if (quantityError) throw quantityError;

    const { error: rentalError } = await supabase
        .from('DBLG_RENTALS')
        .insert({
            ...values,
            status: RENTAL_STATUSES.RENTING,
        });

    if (rentalError) {
        await supabase
            .from('DBLG_ITEMS')
            .update({ avail_qty: item.avail_qty })
            .eq('id', values.item_rented_id);
        throw rentalError;
    }
}

export async function updateRentalStatus(row: RentalRecord, newStatus: RentalStatus) {
    if (!RENTAL_STATUS_OPTIONS.includes(newStatus)) {
        throw new Error('Invalid rental status');
    }

    const localDate = new Date();
    const offset = localDate.getTimezoneOffset() * 60000;
    const localIso = new Date(localDate.getTime() - offset).toISOString().slice(0, -1);
    const { error: rentalError } = await supabase
        .from('DBLG_RENTALS')
        .update({
            status: newStatus,
            actual_returned_date:
                newStatus === RENTAL_STATUSES.COMPLETED ? localIso : null,
        })
        .eq('id', row.id);

    if (rentalError) throw rentalError;

    if (newStatus === RENTAL_STATUSES.COMPLETED && row.status !== RENTAL_STATUSES.COMPLETED) {
        const { data: item, error } = await supabase
            .from('DBLG_ITEMS')
            .select('avail_qty')
            .eq('id', row.item_rented_id)
            .single();

        if (error) throw error;
        if (!item) throw new Error('Item not found');

        const { error: quantityError } = await supabase
            .from('DBLG_ITEMS')
            .update({ avail_qty: item.avail_qty + 1 })
            .eq('id', row.item_rented_id);

        if (quantityError) throw quantityError;
    }
}
