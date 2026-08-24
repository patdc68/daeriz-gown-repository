-- Safe advisor remediations that do not alter application row visibility.

alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

create index if not exists dblg_fittings_branch_id_idx
  on public."DBLG_FITTINGS" (branch_id);
create index if not exists dblg_fittings_item_id_idx
  on public."DBLG_FITTINGS" (item_id);
