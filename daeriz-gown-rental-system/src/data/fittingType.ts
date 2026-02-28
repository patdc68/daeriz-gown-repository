// types.ts
export interface Fitting {
    id: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    item_id: string;
    branch_id: string;
    fitting_date: string;
    status: string;
}

export type FittingInsert = Omit<Fitting, 'id' | 'created_at'>;

export interface Item {
    id: string;
    item_name: string;
    category: string;
    branch_id: string;
    avail_qty: number;
    size?: string;
    image_url?: string;
    total_qty?: number;
}

export interface Branch {
    id: string;
    name: string;
    location: string;
}