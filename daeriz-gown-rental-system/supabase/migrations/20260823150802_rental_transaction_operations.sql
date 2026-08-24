-- Transactional booking validation, inventory recalculation, and rental history.
-- This intentionally does not change global RLS or Storage policies.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."DBLG_RENTALS"'::regclass
      and conname = 'dblg_rentals_valid_dates'
  ) then
    alter table public."DBLG_RENTALS"
      add constraint dblg_rentals_valid_dates
      check (date_returned >= date_rented);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."DBLG_RENTALS"'::regclass
      and conname = 'dblg_rentals_valid_status'
  ) then
    alter table public."DBLG_RENTALS"
      add constraint dblg_rentals_valid_status
      check (status in ('Renting', 'In Laundry', 'Shop Return', 'Completed'));
  end if;
end
$$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_dblg_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public."DBLG_USERS" u
  where (select auth.uid()) is not null
    and u.auth_user_id = (select auth.uid())
  limit 1
$$;

revoke execute on function private.current_dblg_user_id()
  from public, anon;
grant execute on function private.current_dblg_user_id()
  to authenticated;

create or replace function private.validate_rental_booking()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_total numeric;
  item_branch uuid;
  overlapping_count bigint;
begin
  if new.date_rented is null or new.date_returned is null then
    raise exception using message = 'Rental date and return date are required.';
  end if;
  if new.date_returned < new.date_rented then
    raise exception using message = 'Return date cannot be before rental date.';
  end if;
  if new.status not in ('Renting', 'In Laundry', 'Shop Return', 'Completed') then
    raise exception using message = 'Invalid rental status.';
  end if;

  if new.status = 'Completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'Completed' then
      new.actual_returned_date := coalesce(new.actual_returned_date, now());
    end if;
  else
    new.actual_returned_date := null;
  end if;

  perform 1
  from public."DBLG_ITEMS" i
  where i.id in (
    new.item_rented_id,
    case when tg_op = 'UPDATE' then old.item_rented_id end
  )
  order by i.id
  for update;

  select i.total_qty, i.branch_id
  into item_total, item_branch
  from public."DBLG_ITEMS" i
  where i.id = new.item_rented_id;

  if not found then
    raise exception using message = 'The selected item no longer exists.';
  end if;
  if new.branch_id is distinct from item_branch then
    raise exception using message = 'The selected item does not belong to this branch.';
  end if;
  if item_total is null or item_total < 1 then
    raise exception using message = 'This item has no rentable quantity.';
  end if;

  if new.status <> 'Completed' then
    select count(*)
    into overlapping_count
    from public."DBLG_RENTALS" r
    where r.item_rented_id = new.item_rented_id
      and r.status <> 'Completed'
      and r.date_rented <= new.date_returned
      and r.date_returned >= new.date_rented
      and (tg_op = 'INSERT' or r.id <> new.id);

    if overlapping_count >= item_total then
      raise exception using
        message = 'This item is already fully booked for the selected date range.',
        errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.recalculate_item_availability(p_item_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public."DBLG_ITEMS" i
  set avail_qty = greatest(
    i.total_qty - (
      select count(*)
      from public."DBLG_RENTALS" r
      where r.item_rented_id = i.id
        and r.status <> 'Completed'
    ),
    0
  )
  where i.id = p_item_id
$$;

create or replace function private.audit_rental_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := private.current_dblg_user_id();
  old_label text;
  new_label text;
begin
  if tg_op = 'INSERT' then
    insert into public."DBLG_RENTAL_HISTORY" (
      rental_id, processed_by_id, action, notes
    ) values (
      new.id, actor_id, 'RENTAL_CREATED', 'Rental created with status ' || new.status
    );
    perform private.recalculate_item_availability(new.item_rented_id);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public."DBLG_RENTAL_HISTORY" (
      rental_id, processed_by_id, action, notes
    ) values (
      new.id, actor_id, 'STATUS_CHANGED', old.status || ' -> ' || new.status
    );
  end if;
  if old.date_rented is distinct from new.date_rented
     or old.date_returned is distinct from new.date_returned then
    insert into public."DBLG_RENTAL_HISTORY" (
      rental_id, processed_by_id, action, notes
    ) values (
      new.id,
      actor_id,
      'DATES_CHANGED',
      old.date_rented || ' - ' || old.date_returned || ' -> '
        || new.date_rented || ' - ' || new.date_returned
    );
  end if;
  if old.item_rented_id is distinct from new.item_rented_id then
    select item_name into old_label
    from public."DBLG_ITEMS" where id = old.item_rented_id;
    select item_name into new_label
    from public."DBLG_ITEMS" where id = new.item_rented_id;
    insert into public."DBLG_RENTAL_HISTORY" (
      rental_id, processed_by_id, action, notes
    ) values (
      new.id,
      actor_id,
      'ITEM_CHANGED',
      coalesce(old_label, 'Unknown item') || ' -> ' || coalesce(new_label, 'Unknown item')
    );
  end if;
  if old.branch_id is distinct from new.branch_id then
    select name into old_label
    from public."DBLG_SHOP_BRANCH" where id = old.branch_id;
    select name into new_label
    from public."DBLG_SHOP_BRANCH" where id = new.branch_id;
    insert into public."DBLG_RENTAL_HISTORY" (
      rental_id, processed_by_id, action, notes
    ) values (
      new.id,
      actor_id,
      'BRANCH_CHANGED',
      coalesce(old_label, 'Unknown branch') || ' -> ' || coalesce(new_label, 'Unknown branch')
    );
  end if;
  if old.rental_amount is distinct from new.rental_amount
     or old.security_deposit_amount is distinct from new.security_deposit_amount
     or old.discount_amount is distinct from new.discount_amount then
    insert into public."DBLG_RENTAL_HISTORY" (
      rental_id, processed_by_id, action, notes
    ) values (
      new.id,
      actor_id,
      'FINANCIAL_TERMS_CHANGED',
      'Rental amount, discount, or required security deposit updated'
    );
  end if;

  perform private.recalculate_item_availability(old.item_rented_id);
  if new.item_rented_id is distinct from old.item_rented_id then
    perform private.recalculate_item_availability(new.item_rented_id);
  end if;
  return new;
end;
$$;

drop trigger if exists validate_rental_booking_before_write
  on public."DBLG_RENTALS";
create trigger validate_rental_booking_before_write
before insert or update of item_rented_id, branch_id, date_rented, date_returned, status
on public."DBLG_RENTALS"
for each row execute function private.validate_rental_booking();

drop trigger if exists audit_rental_after_insert
  on public."DBLG_RENTALS";
create trigger audit_rental_after_insert
after insert on public."DBLG_RENTALS"
for each row execute function private.audit_rental_change();

drop trigger if exists audit_rental_after_update
  on public."DBLG_RENTALS";
create trigger audit_rental_after_update
after update of item_rented_id, branch_id, date_rented, date_returned, status,
  rental_amount, security_deposit_amount, discount_amount
on public."DBLG_RENTALS"
for each row execute function private.audit_rental_change();

create or replace function public.create_rental(
  p_branch_id uuid,
  p_item_rented_id uuid,
  p_date_rented date,
  p_date_returned date,
  p_renter_name text,
  p_renter_contact_no text,
  p_rental_amount numeric,
  p_security_deposit_amount numeric,
  p_discount_amount numeric default 0
)
returns public."DBLG_RENTALS"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_rental public."DBLG_RENTALS";
begin
  if nullif(btrim(p_renter_name), '') is null then
    raise exception using message = 'Renter name is required.';
  end if;
  if nullif(btrim(p_renter_contact_no), '') is null then
    raise exception using message = 'Contact number is required.';
  end if;
  if p_rental_amount is null or p_rental_amount < 0
     or p_security_deposit_amount is null or p_security_deposit_amount < 0
     or p_discount_amount is null or p_discount_amount < 0
     or p_discount_amount > p_rental_amount then
    raise exception using message = 'Enter valid non-negative rental, deposit, and discount amounts.';
  end if;

  insert into public."DBLG_RENTALS" (
    branch_id, item_rented_id, date_rented, date_returned, status,
    renter_name, renter_contact_no, rental_amount,
    security_deposit_amount, discount_amount
  ) values (
    p_branch_id, p_item_rented_id, p_date_rented, p_date_returned, 'Renting',
    btrim(p_renter_name), btrim(p_renter_contact_no), p_rental_amount,
    p_security_deposit_amount, p_discount_amount
  ) returning * into created_rental;
  return created_rental;
end;
$$;

create or replace function public.update_rental_status(
  p_rental_id uuid,
  p_status text
)
returns public."DBLG_RENTALS"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_rental public."DBLG_RENTALS";
  updated_rental public."DBLG_RENTALS";
begin
  if p_status not in ('Renting', 'In Laundry', 'Shop Return', 'Completed') then
    raise exception using message = 'Invalid rental status.';
  end if;

  select * into current_rental
  from public."DBLG_RENTALS"
  where id = p_rental_id
  for update;
  if not found then
    raise exception using message = 'Rental not found or access denied.';
  end if;
  if current_rental.status = p_status then
    return current_rental;
  end if;

  update public."DBLG_RENTALS"
  set status = p_status,
      actual_returned_date = case
        when p_status = 'Completed' then coalesce(current_rental.actual_returned_date, now())
        else null
      end
  where id = p_rental_id
  returning * into updated_rental;
  return updated_rental;
end;
$$;

create or replace function public.update_rental(
  p_rental_id uuid,
  p_branch_id uuid,
  p_item_rented_id uuid,
  p_date_rented date,
  p_date_returned date,
  p_renter_name text,
  p_renter_contact_no text,
  p_rental_amount numeric,
  p_security_deposit_amount numeric,
  p_discount_amount numeric
)
returns public."DBLG_RENTALS"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_paid numeric;
  updated_rental public."DBLG_RENTALS";
begin
  if nullif(btrim(p_renter_name), '') is null
     or nullif(btrim(p_renter_contact_no), '') is null then
    raise exception using message = 'Renter name and contact number are required.';
  end if;
  if p_rental_amount is null or p_rental_amount < 0
     or p_security_deposit_amount is null or p_security_deposit_amount < 0
     or p_discount_amount is null or p_discount_amount < 0
     or p_discount_amount > p_rental_amount then
    raise exception using message = 'Enter valid non-negative rental, deposit, and discount amounts.';
  end if;

  select coalesce(sum(case
    when p.payment_type in ('Down Payment', 'Rental Payment') then p.amount
    when p.payment_type = 'Refund'
      and original.payment_type in ('Down Payment', 'Rental Payment') then -p.amount
    else 0 end), 0)
  into current_paid
  from public."DBLG_RENTAL_PAYMENTS" p
  left join public."DBLG_RENTAL_PAYMENTS" original
    on original.id = p.related_payment_id
  where p.rental_id = p_rental_id;

  if greatest(p_rental_amount - p_discount_amount, 0) < current_paid then
    raise exception using message = 'Rental total cannot be reduced below the amount already paid.';
  end if;

  update public."DBLG_RENTALS"
  set branch_id = p_branch_id,
      item_rented_id = p_item_rented_id,
      date_rented = p_date_rented,
      date_returned = p_date_returned,
      renter_name = btrim(p_renter_name),
      renter_contact_no = btrim(p_renter_contact_no),
      rental_amount = p_rental_amount,
      security_deposit_amount = p_security_deposit_amount,
      discount_amount = p_discount_amount
  where id = p_rental_id
  returning * into updated_rental;
  if not found then
    raise exception using message = 'Rental not found or access denied.';
  end if;
  return updated_rental;
end;
$$;

revoke execute on function public.create_rental(
  uuid, uuid, date, date, text, text, numeric, numeric, numeric
) from public, anon;
revoke execute on function public.update_rental_status(uuid, text)
  from public, anon;
revoke execute on function public.update_rental(
  uuid, uuid, uuid, date, date, text, text, numeric, numeric, numeric
) from public, anon;
grant execute on function public.create_rental(
  uuid, uuid, date, date, text, text, numeric, numeric, numeric
) to authenticated;
grant execute on function public.update_rental_status(uuid, text)
  to authenticated;
grant execute on function public.update_rental(
  uuid, uuid, uuid, date, date, text, text, numeric, numeric, numeric
) to authenticated;

notify pgrst, 'reload schema';
