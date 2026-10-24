begin;

-- 下载解锁是一类积分支出；扩展流水类型，不改动历史记录。
alter table public.point_transactions
  drop constraint if exists point_transactions_event_type_check;
alter table public.point_transactions
  add constraint point_transactions_event_type_check
  check (event_type in ('membership_opening_bonus', 'annual_daily', 'material_unlock'));

create table if not exists public.material_point_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_slug text not null,
  points_spent integer not null check (points_spent >= 0),
  point_transaction_id uuid references public.point_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, material_slug)
);

create index if not exists material_point_unlocks_user_created_idx
  on public.material_point_unlocks(user_id, created_at desc);

alter table public.material_point_unlocks enable row level security;
revoke all on public.material_point_unlocks from anon, authenticated;
grant select on public.material_point_unlocks to authenticated;
drop policy if exists "Users can read own material unlocks" on public.material_point_unlocks;
create policy "Users can read own material unlocks"
on public.material_point_unlocks for select to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- 一次请求内先锁定用户余额，再计算尚未解锁材料的总价并统一扣减。
-- 唯一键同时防住重复点击、支付/页面重试与并发批量请求。
create or replace function public.unlock_materials_with_points(
  p_user_id uuid,
  p_materials jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_required integer := 0;
  v_charged integer := 0;
  v_item record;
  v_transaction_id uuid;
  v_unlocked_slugs jsonb := '[]'::jsonb;
begin
  if p_user_id is null or jsonb_typeof(p_materials) <> 'array' then
    raise exception 'invalid_material_unlock_request';
  end if;

  select points_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  select coalesce(sum(requested.cost), 0)::integer
  into v_required
  from (
    select item ->> 'slug' as slug, max((item ->> 'cost')::integer) as cost
    from jsonb_array_elements(p_materials) item
    where nullif(btrim(item ->> 'slug'), '') is not null
      and (item ->> 'cost') ~ '^[0-9]+$'
      and (item ->> 'cost')::numeric <= 9999
    group by item ->> 'slug'
  ) requested
  where not exists (
    select 1 from public.material_point_unlocks unlocked
    where unlocked.user_id = p_user_id
      and unlocked.material_slug = requested.slug
  );

  if v_required > v_balance then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSUFFICIENT_POINTS',
      'requiredPoints', v_required,
      'pointsBalance', v_balance,
      'chargedPoints', 0,
      'unlockedSlugs', '[]'::jsonb
    );
  end if;

  for v_item in
    select requested.slug, requested.cost
    from (
      select item ->> 'slug' as slug, max((item ->> 'cost')::integer) as cost
      from jsonb_array_elements(p_materials) item
      where nullif(btrim(item ->> 'slug'), '') is not null
        and (item ->> 'cost') ~ '^[0-9]+$'
        and (item ->> 'cost')::numeric <= 9999
      group by item ->> 'slug'
    ) requested
    where not exists (
      select 1 from public.material_point_unlocks unlocked
      where unlocked.user_id = p_user_id
        and unlocked.material_slug = requested.slug
    )
  loop
    v_transaction_id := null;
    if v_item.cost > 0 then
      insert into public.point_transactions
        (user_id, amount, event_type, idempotency_key, description)
      values
        (p_user_id, -v_item.cost, 'material_unlock',
         'material-unlock:' || p_user_id::text || ':' || v_item.slug,
         '资料下载解锁：' || v_item.slug)
      on conflict (idempotency_key) do nothing
      returning id into v_transaction_id;
    end if;

    insert into public.material_point_unlocks
      (user_id, material_slug, points_spent, point_transaction_id)
    values
      (p_user_id, v_item.slug, v_item.cost, v_transaction_id)
    on conflict (user_id, material_slug) do nothing;

    if found then
      v_charged := v_charged + v_item.cost;
      v_unlocked_slugs := v_unlocked_slugs || jsonb_build_array(v_item.slug);
    end if;
  end loop;

  if v_charged > 0 then
    update public.profiles
    set points_balance = points_balance - v_charged,
      updated_at = now()
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'chargedPoints', v_charged,
    'pointsBalance', v_balance - v_charged,
    'unlockedSlugs', v_unlocked_slugs
  );
end;
$$;

revoke all on function public.unlock_materials_with_points(uuid, jsonb) from public;
grant execute on function public.unlock_materials_with_points(uuid, jsonb) to service_role;

commit;
