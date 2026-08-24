-- Reconcile the live rental schema with Booking, Dashboard, and Payment clients.
-- Existing rentals receive contractual amount defaults only; no payment rows are fabricated.

alter table public."DBLG_RENTALS"
  alter column renter_contact_no type text using renter_contact_no::text;

alter table public."DBLG_RENTALS"
  add column if not exists rental_amount numeric(12,2),
  add column if not exists security_deposit_amount numeric(12,2),
  add column if not exists discount_amount numeric(12,2);

update public."DBLG_RENTALS"
set rental_amount = coalesce(rental_amount, 0),
    security_deposit_amount = coalesce(security_deposit_amount, 0),
    discount_amount = coalesce(discount_amount, 0)
where rental_amount is null
   or security_deposit_amount is null
   or discount_amount is null;

alter table public."DBLG_RENTALS"
  alter column rental_amount set default 0,
  alter column rental_amount set not null,
  alter column security_deposit_amount set default 0,
  alter column security_deposit_amount set not null,
  alter column discount_amount set default 0,
  alter column discount_amount set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."DBLG_RENTALS"'::regclass
      and conname = 'dblg_rentals_nonnegative_financials'
  ) then
    alter table public."DBLG_RENTALS"
      add constraint dblg_rentals_nonnegative_financials check (
        rental_amount >= 0
        and security_deposit_amount >= 0
        and discount_amount >= 0
        and discount_amount <= rental_amount
      );
  end if;
end
$$;

create table if not exists public."DBLG_RENTAL_PAYMENTS" (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null,
  payment_type text not null,
  amount numeric(12,2) not null,
  payment_method text not null,
  reference_no text,
  receipt_img text,
  payment_date timestamptz not null default now(),
  notes text,
  related_payment_id uuid,
  processed_by_id uuid,
  created_at timestamptz not null default now(),
  constraint "DBLG_RENTAL_PAYMENTS_rental_id_fkey"
    foreign key (rental_id) references public."DBLG_RENTALS" (id),
  constraint "DBLG_RENTAL_PAYMENTS_related_payment_id_fkey"
    foreign key (related_payment_id) references public."DBLG_RENTAL_PAYMENTS" (id),
  constraint "DBLG_RENTAL_PAYMENTS_processed_by_id_fkey"
    foreign key (processed_by_id) references public."DBLG_USERS" (id),
  constraint dblg_payment_type_check check (
    payment_type in ('Down Payment', 'Rental Payment', 'Security Deposit', 'Penalty', 'Refund')
  ),
  constraint dblg_payment_amount_check check (amount > 0),
  constraint dblg_payment_method_check check (
    payment_method in ('Cash', 'GCash', 'Maya', 'Bank Transfer', 'Other')
  ),
  constraint dblg_payment_refund_relation check (
    (payment_type = 'Refund' and related_payment_id is not null)
    or (payment_type <> 'Refund' and related_payment_id is null)
  ),
  constraint dblg_payment_non_cash_reference check (
    payment_method = 'Cash' or nullif(btrim(reference_no), '') is not null
  )
);

create index if not exists dblg_rental_payments_rental_date_idx
  on public."DBLG_RENTAL_PAYMENTS" (rental_id, payment_date desc);
create index if not exists dblg_rental_payments_payment_date_idx
  on public."DBLG_RENTAL_PAYMENTS" (payment_date desc);
create index if not exists dblg_rental_payments_type_date_idx
  on public."DBLG_RENTAL_PAYMENTS" (payment_type, payment_date desc);
create index if not exists dblg_rental_payments_related_payment_idx
  on public."DBLG_RENTAL_PAYMENTS" (related_payment_id)
  where related_payment_id is not null;
create index if not exists dblg_rental_payments_processed_by_idx
  on public."DBLG_RENTAL_PAYMENTS" (processed_by_id);

create index if not exists dblg_rentals_branch_dates_idx
  on public."DBLG_RENTALS" (branch_id, date_rented, date_returned);
create index if not exists dblg_rentals_item_dates_active_idx
  on public."DBLG_RENTALS" (item_rented_id, date_rented, date_returned)
  where status <> 'Completed';
create index if not exists dblg_rentals_status_date_idx
  on public."DBLG_RENTALS" (status, date_rented);
create index if not exists dblg_rentals_date_rented_idx
  on public."DBLG_RENTALS" (date_rented);
create index if not exists dblg_rentals_customer_return_due_idx
  on public."DBLG_RENTALS" (date_returned, branch_id)
  where status = 'Renting';
create index if not exists dblg_rental_history_rental_id_idx
  on public."DBLG_RENTAL_HISTORY" (rental_id);
create index if not exists dblg_rental_history_processed_by_id_idx
  on public."DBLG_RENTAL_HISTORY" (processed_by_id);
create index if not exists dblg_users_auth_user_id_idx
  on public."DBLG_USERS" (auth_user_id)
  where auth_user_id is not null;
create index if not exists dblg_users_branch_id_idx
  on public."DBLG_USERS" (branch_id);
create index if not exists dblg_items_branch_id_idx
  on public."DBLG_ITEMS" (branch_id);

alter table public."DBLG_RENTAL_PAYMENTS" enable row level security;

drop policy if exists "Users can view branch rental payments"
  on public."DBLG_RENTAL_PAYMENTS";
create policy "Users can view branch rental payments"
on public."DBLG_RENTAL_PAYMENTS" for select to authenticated
using (
  exists (
    select 1
    from public."DBLG_RENTALS" r
    join public."DBLG_USERS" u on u.auth_user_id = (select auth.uid())
    where r.id = rental_id
      and (lower(u.role) = 'admin' or r.branch_id = u.branch_id)
  )
);

revoke all on public."DBLG_RENTAL_PAYMENTS" from anon, authenticated;
grant select on public."DBLG_RENTAL_PAYMENTS" to authenticated;

notify pgrst, 'reload schema';
