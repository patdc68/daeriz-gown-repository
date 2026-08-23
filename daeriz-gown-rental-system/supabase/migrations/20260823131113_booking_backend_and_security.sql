-- Booking, rental consistency, audit history, tenant isolation, and query indexes.

alter table public."DBLG_RENTALS"
  alter column renter_contact_no type text using renter_contact_no::text;

alter table public."DBLG_RENTALS"
  add constraint dblg_rentals_valid_dates
    check (date_returned >= date_rented),
  add constraint dblg_rentals_valid_status
    check (status in ('Renting', 'In Laundry', 'Shop Return', 'Completed'));

alter table public."DBLG_ITEMS"
  add constraint dblg_items_valid_quantities
    check (
      total_qty >= 0
      and avail_qty >= 0
      and avail_qty <= total_qty
      and total_qty = trunc(total_qty)
      and avail_qty = trunc(avail_qty)
    ) not valid;

create unique index dblg_users_auth_user_id_uidx
  on public."DBLG_USERS" (auth_user_id)
  where auth_user_id is not null;
create index dblg_users_branch_id_idx on public."DBLG_USERS" (branch_id);
create index dblg_items_branch_id_idx on public."DBLG_ITEMS" (branch_id);
create index dblg_rentals_branch_dates_idx
  on public."DBLG_RENTALS" (branch_id, date_rented, date_returned);
create index dblg_rentals_item_dates_active_idx
  on public."DBLG_RENTALS" (item_rented_id, date_rented, date_returned)
  where status <> 'Completed';
create index dblg_rentals_status_date_idx
  on public."DBLG_RENTALS" (status, date_rented);
create index dblg_rental_history_rental_id_idx
  on public."DBLG_RENTAL_HISTORY" (rental_id);
create index dblg_rental_history_processed_by_id_idx
  on public."DBLG_RENTAL_HISTORY" (processed_by_id);
create index dblg_fittings_branch_id_idx on public."DBLG_FITTINGS" (branch_id);
create index dblg_fittings_item_id_idx on public."DBLG_FITTINGS" (item_id);

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

create or replace function private.current_dblg_branch_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.branch_id
  from public."DBLG_USERS" u
  where (select auth.uid()) is not null
    and u.auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function private.is_dblg_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select lower(u.role) = 'admin'
    from public."DBLG_USERS" u
    where (select auth.uid()) is not null
      and u.auth_user_id = (select auth.uid())
    limit 1
  ), false)
$$;

revoke all on function private.current_dblg_user_id() from public, anon;
revoke all on function private.current_dblg_branch_id() from public, anon;
revoke all on function private.is_dblg_admin() from public, anon;
grant execute on function private.current_dblg_user_id() to authenticated;
grant execute on function private.current_dblg_branch_id() to authenticated;
grant execute on function private.is_dblg_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_branch uuid;
begin
  begin
    requested_branch := nullif(new.raw_user_meta_data ->> 'branch_id', '')::uuid;
  exception when invalid_text_representation then
    requested_branch := null;
  end;

  if requested_branch is not null and not exists (
    select 1 from public."DBLG_SHOP_BRANCH" where id = requested_branch
  ) then
    requested_branch := null;
  end if;

  insert into public."DBLG_USERS" (auth_user_id, role, branch_id, username, name)
  values (
    new.id,
    'staff',
    requested_branch,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), new.email)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

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
  where i.id in (new.item_rented_id, case when tg_op = 'UPDATE' then old.item_rented_id end)
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

create or replace function private.recalculate_item_availability(item_id uuid)
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
      where r.item_rented_id = i.id and r.status <> 'Completed'
    ),
    0
  )
  where i.id = item_id
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
    insert into public."DBLG_RENTAL_HISTORY" (rental_id, processed_by_id, action, notes)
    values (new.id, actor_id, 'RENTAL_CREATED', 'Rental created with status ' || new.status);
    perform private.recalculate_item_availability(new.item_rented_id);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public."DBLG_RENTAL_HISTORY" (rental_id, processed_by_id, action, notes)
    values (new.id, actor_id, 'STATUS_CHANGED', old.status || ' → ' || new.status);
  end if;
  if old.date_rented is distinct from new.date_rented
     or old.date_returned is distinct from new.date_returned then
    insert into public."DBLG_RENTAL_HISTORY" (rental_id, processed_by_id, action, notes)
    values (
      new.id,
      actor_id,
      'DATES_CHANGED',
      old.date_rented || ' - ' || old.date_returned || ' → ' || new.date_rented || ' - ' || new.date_returned
    );
  end if;
  if old.item_rented_id is distinct from new.item_rented_id then
    select item_name into old_label from public."DBLG_ITEMS" where id = old.item_rented_id;
    select item_name into new_label from public."DBLG_ITEMS" where id = new.item_rented_id;
    insert into public."DBLG_RENTAL_HISTORY" (rental_id, processed_by_id, action, notes)
    values (new.id, actor_id, 'ITEM_CHANGED', coalesce(old_label, 'Unknown item') || ' → ' || coalesce(new_label, 'Unknown item'));
  end if;
  if old.branch_id is distinct from new.branch_id then
    select name into old_label from public."DBLG_SHOP_BRANCH" where id = old.branch_id;
    select name into new_label from public."DBLG_SHOP_BRANCH" where id = new.branch_id;
    insert into public."DBLG_RENTAL_HISTORY" (rental_id, processed_by_id, action, notes)
    values (new.id, actor_id, 'BRANCH_CHANGED', coalesce(old_label, 'Unknown branch') || ' → ' || coalesce(new_label, 'Unknown branch'));
  end if;

  perform private.recalculate_item_availability(old.item_rented_id);
  if new.item_rented_id is distinct from old.item_rented_id then
    perform private.recalculate_item_availability(new.item_rented_id);
  end if;
  return new;
end;
$$;

create trigger validate_rental_booking_before_write
before insert or update of item_rented_id, branch_id, date_rented, date_returned, status
on public."DBLG_RENTALS"
for each row execute function private.validate_rental_booking();

create trigger audit_rental_after_insert
after insert on public."DBLG_RENTALS"
for each row execute function private.audit_rental_change();

create trigger audit_rental_after_update
after update of item_rented_id, branch_id, date_rented, date_returned, status
on public."DBLG_RENTALS"
for each row execute function private.audit_rental_change();

create or replace function public.create_rental(
  p_branch_id uuid,
  p_item_rented_id uuid,
  p_date_rented date,
  p_date_returned date,
  p_renter_name text,
  p_renter_contact_no text,
  p_receipt_img text default null
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

  insert into public."DBLG_RENTALS" (
    branch_id, item_rented_id, date_rented, date_returned, status,
    renter_name, renter_contact_no, receipt_img
  ) values (
    p_branch_id, p_item_rented_id, p_date_rented, p_date_returned, 'Renting',
    btrim(p_renter_name), btrim(p_renter_contact_no), nullif(p_receipt_img, '')
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
  p_receipt_img text default null
)
returns public."DBLG_RENTALS"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_rental public."DBLG_RENTALS";
begin
  update public."DBLG_RENTALS"
  set branch_id = p_branch_id,
      item_rented_id = p_item_rented_id,
      date_rented = p_date_rented,
      date_returned = p_date_returned,
      renter_name = btrim(p_renter_name),
      renter_contact_no = btrim(p_renter_contact_no),
      receipt_img = nullif(p_receipt_img, '')
  where id = p_rental_id
  returning * into updated_rental;
  if not found then
    raise exception using message = 'Rental not found or access denied.';
  end if;
  return updated_rental;
end;
$$;

revoke execute on function public.create_rental(uuid, uuid, date, date, text, text, text) from public, anon;
revoke execute on function public.update_rental_status(uuid, text) from public, anon;
revoke execute on function public.update_rental(uuid, uuid, uuid, date, date, text, text, text) from public, anon;
grant execute on function public.create_rental(uuid, uuid, date, date, text, text, text) to authenticated;
grant execute on function public.update_rental_status(uuid, text) to authenticated;
grant execute on function public.update_rental(uuid, uuid, uuid, date, date, text, text, text) to authenticated;

alter table public."DBLG_SHOP_BRANCH" enable row level security;
alter table public."DBLG_USERS" enable row level security;
alter table public."DBLG_ITEMS" enable row level security;
alter table public."DBLG_RENTALS" enable row level security;
alter table public."DBLG_RENTAL_HISTORY" enable row level security;
alter table public."DBLG_FITTINGS" enable row level security;

create policy "Public can list registration branches"
on public."DBLG_SHOP_BRANCH" for select to anon using (true);
create policy "Users can view permitted branches"
on public."DBLG_SHOP_BRANCH" for select to authenticated
using ((select private.is_dblg_admin()) or id = (select private.current_dblg_branch_id()));
create policy "Admins can manage branches"
on public."DBLG_SHOP_BRANCH" for all to authenticated
using ((select private.is_dblg_admin()))
with check ((select private.is_dblg_admin()));

create policy "Users can view their profile"
on public."DBLG_USERS" for select to authenticated
using (auth_user_id = (select auth.uid()) or (select private.is_dblg_admin()));
create policy "Admins can manage profiles"
on public."DBLG_USERS" for all to authenticated
using ((select private.is_dblg_admin()))
with check ((select private.is_dblg_admin()));

create policy "Users can view branch items"
on public."DBLG_ITEMS" for select to authenticated
using ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Users can insert branch items"
on public."DBLG_ITEMS" for insert to authenticated
with check ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Users can update branch items"
on public."DBLG_ITEMS" for update to authenticated
using ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()))
with check ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Admins can delete items"
on public."DBLG_ITEMS" for delete to authenticated
using ((select private.is_dblg_admin()));

create policy "Users can view branch rentals"
on public."DBLG_RENTALS" for select to authenticated
using ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Users can insert branch rentals"
on public."DBLG_RENTALS" for insert to authenticated
with check ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Users can update branch rentals"
on public."DBLG_RENTALS" for update to authenticated
using ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()))
with check ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Admins can delete rentals"
on public."DBLG_RENTALS" for delete to authenticated
using ((select private.is_dblg_admin()));

create policy "Users can view branch rental history"
on public."DBLG_RENTAL_HISTORY" for select to authenticated
using (exists (
  select 1 from public."DBLG_RENTALS" r where r.id = rental_id
));
create policy "Users can append branch rental history"
on public."DBLG_RENTAL_HISTORY" for insert to authenticated
with check (
  processed_by_id = (select private.current_dblg_user_id())
  and exists (select 1 from public."DBLG_RENTALS" r where r.id = rental_id)
);
create policy "Admins can manage rental history"
on public."DBLG_RENTAL_HISTORY" for all to authenticated
using ((select private.is_dblg_admin()))
with check ((select private.is_dblg_admin()));

create policy "Users can view branch fittings"
on public."DBLG_FITTINGS" for select to authenticated
using ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));
create policy "Users can manage branch fittings"
on public."DBLG_FITTINGS" for all to authenticated
using ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()))
with check ((select private.is_dblg_admin()) or branch_id = (select private.current_dblg_branch_id()));

revoke all on public."DBLG_SHOP_BRANCH", public."DBLG_USERS", public."DBLG_ITEMS",
  public."DBLG_RENTALS", public."DBLG_RENTAL_HISTORY", public."DBLG_FITTINGS" from anon;
grant select on public."DBLG_SHOP_BRANCH" to anon;
revoke truncate, references, trigger on public."DBLG_SHOP_BRANCH", public."DBLG_USERS",
  public."DBLG_ITEMS", public."DBLG_RENTALS", public."DBLG_RENTAL_HISTORY",
  public."DBLG_FITTINGS" from authenticated;

drop policy if exists "Allow public uploads" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;
create policy "Authenticated users can upload item images"
on storage.objects for insert to authenticated
with check (bucket_id = 'item-images');
create policy "Authenticated users can update item images"
on storage.objects for update to authenticated
using (bucket_id = 'item-images')
with check (bucket_id = 'item-images');
create policy "Admins can delete item images"
on storage.objects for delete to authenticated
using (bucket_id = 'item-images' and (select private.is_dblg_admin()));
