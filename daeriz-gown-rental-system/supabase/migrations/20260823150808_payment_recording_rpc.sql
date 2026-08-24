-- Atomic, branch-aware payment recording and financial history.

create or replace function public.record_rental_payment(
  p_rental_id uuid,
  p_payment_type text,
  p_amount numeric,
  p_payment_method text,
  p_reference_no text default null,
  p_receipt_img text default null,
  p_payment_date timestamptz default now(),
  p_notes text default null,
  p_related_payment_id uuid default null
)
returns public."DBLG_RENTAL_PAYMENTS"
language plpgsql
security definer
set search_path = ''
as $$
declare
  rental_row public."DBLG_RENTALS";
  related_row public."DBLG_RENTAL_PAYMENTS";
  created_payment public."DBLG_RENTAL_PAYMENTS";
  actor_id uuid;
  actor_branch_id uuid;
  actor_is_admin boolean;
  net_rental numeric;
  rental_paid numeric;
  deposit_held numeric;
  already_refunded numeric;
  history_action text;
begin
  select u.id, u.branch_id, lower(u.role) = 'admin'
  into actor_id, actor_branch_id, actor_is_admin
  from public."DBLG_USERS" u
  where (select auth.uid()) is not null
    and u.auth_user_id = (select auth.uid())
  limit 1;

  if actor_id is null then
    raise exception using message = 'A valid staff profile is required.';
  end if;
  if p_payment_type not in (
    'Down Payment', 'Rental Payment', 'Security Deposit', 'Penalty', 'Refund'
  ) then
    raise exception using message = 'Invalid payment type.';
  end if;
  if p_payment_method not in (
    'Cash', 'GCash', 'Maya', 'Bank Transfer', 'Other'
  ) then
    raise exception using message = 'Invalid payment method.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using message = 'Payment amount must be greater than zero.';
  end if;
  if p_payment_date is null then
    raise exception using message = 'Payment date is required.';
  end if;
  if p_payment_method <> 'Cash'
     and nullif(btrim(p_reference_no), '') is null then
    raise exception using message = 'A reference number is required for this payment method.';
  end if;

  select * into rental_row
  from public."DBLG_RENTALS"
  where id = p_rental_id
  for update;
  if not found then
    raise exception using message = 'Rental not found or access denied.';
  end if;
  if not actor_is_admin
     and rental_row.branch_id is distinct from actor_branch_id then
    raise exception using message = 'Rental not found or access denied.';
  end if;

  net_rental := greatest(
    rental_row.rental_amount - rental_row.discount_amount,
    0
  );

  select coalesce(sum(case
    when p.payment_type in ('Down Payment', 'Rental Payment') then p.amount
    when p.payment_type = 'Refund'
      and original.payment_type in ('Down Payment', 'Rental Payment') then -p.amount
    else 0 end), 0)
  into rental_paid
  from public."DBLG_RENTAL_PAYMENTS" p
  left join public."DBLG_RENTAL_PAYMENTS" original
    on original.id = p.related_payment_id
  where p.rental_id = p_rental_id;

  select coalesce(sum(case
    when p.payment_type = 'Security Deposit' then p.amount
    when p.payment_type = 'Refund'
      and original.payment_type = 'Security Deposit' then -p.amount
    else 0 end), 0)
  into deposit_held
  from public."DBLG_RENTAL_PAYMENTS" p
  left join public."DBLG_RENTAL_PAYMENTS" original
    on original.id = p.related_payment_id
  where p.rental_id = p_rental_id;

  if p_payment_type in ('Down Payment', 'Rental Payment')
     and p_amount > greatest(net_rental - rental_paid, 0) then
    raise exception using message = 'Payment exceeds the remaining rental balance.';
  end if;

  if p_payment_type = 'Security Deposit'
     and p_amount > greatest(
       rental_row.security_deposit_amount - deposit_held,
       0
     ) then
    raise exception using message = 'Deposit exceeds the remaining required security deposit.';
  end if;

  if p_payment_type = 'Refund' then
    if not actor_is_admin then
      raise exception using message = 'Only an administrator can record a refund.';
    end if;

    select * into related_row
    from public."DBLG_RENTAL_PAYMENTS"
    where id = p_related_payment_id
      and rental_id = p_rental_id
    for update;
    if not found or related_row.payment_type = 'Refund' then
      raise exception using message = 'Select a valid original payment to refund.';
    end if;

    select coalesce(sum(amount), 0)
    into already_refunded
    from public."DBLG_RENTAL_PAYMENTS"
    where payment_type = 'Refund'
      and related_payment_id = related_row.id;

    if p_amount > related_row.amount - already_refunded then
      if related_row.payment_type = 'Security Deposit' then
        raise exception using message = 'Refund exceeds the remaining security deposit.';
      end if;
      raise exception using message = 'Refund exceeds the remaining refundable payment amount.';
    end if;
  elsif p_related_payment_id is not null then
    raise exception using message = 'Only refunds can reference an original payment.';
  end if;

  insert into public."DBLG_RENTAL_PAYMENTS" (
    rental_id,
    payment_type,
    amount,
    payment_method,
    reference_no,
    receipt_img,
    payment_date,
    notes,
    related_payment_id,
    processed_by_id
  ) values (
    p_rental_id,
    p_payment_type,
    p_amount,
    p_payment_method,
    nullif(btrim(p_reference_no), ''),
    nullif(p_receipt_img, ''),
    p_payment_date,
    nullif(btrim(p_notes), ''),
    p_related_payment_id,
    actor_id
  ) returning * into created_payment;

  history_action := case
    when p_payment_type = 'Security Deposit' then 'DEPOSIT_COLLECTED'
    when p_payment_type = 'Refund'
      and related_row.payment_type = 'Security Deposit' then 'DEPOSIT_REFUNDED'
    when p_payment_type = 'Refund' then 'PAYMENT_REFUND'
    else 'PAYMENT_ADDED'
  end;

  insert into public."DBLG_RENTAL_HISTORY" (
    rental_id, processed_by_id, action, notes
  ) values (
    p_rental_id,
    actor_id,
    history_action,
    p_payment_type || ' - PHP '
      || trim(to_char(p_amount, 'FM999999999990.00'))
      || ' - ' || p_payment_method
  );

  return created_payment;
end;
$$;

revoke execute on function public.record_rental_payment(
  uuid, text, numeric, text, text, text, timestamptz, text, uuid
) from public, anon;
grant execute on function public.record_rental_payment(
  uuid, text, numeric, text, text, text, timestamptz, text, uuid
) to authenticated;

notify pgrst, 'reload schema';
