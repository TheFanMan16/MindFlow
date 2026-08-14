-- 006_lock_profiles_and_atomic_counters.sql
-- Locks privileged profile columns against client writes and adds atomic,
-- server-enforced counters for AI usage and focus minutes.
--
-- Why: the "Users can update own profile" policy scoped ROWS but not COLUMNS,
-- so any signed-in user could set their own is_pro / is_admin / ai_usage_count
-- via PostgREST. Metering and counters move behind SECURITY DEFINER functions;
-- the client keeps read access and cosmetic writes only.

begin;

-- ------------------------------------------------------------------
-- 1) Catch migrations up with the live schema (these columns were added
--    out-of-band in the dashboard; on the live DB these are no-ops).
--    ADD COLUMN IF NOT EXISTS does not alter an existing column, so the
--    defaults are (re)asserted explicitly below - restricted INSERTs
--    (id, email only) must succeed even if live columns lack defaults.
-- ------------------------------------------------------------------
alter table public.profiles add column if not exists is_pro boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists ai_usage_count integer not null default 0;
alter table public.profiles add column if not exists last_usage_date date;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists pro_expires_at timestamptz;
alter table public.profiles add column if not exists streak_count integer not null default 0;
alter table public.profiles add column if not exists total_focus_minutes integer not null default 0;

alter table public.profiles alter column is_pro set default false;
alter table public.profiles alter column is_admin set default false;
alter table public.profiles alter column ai_usage_count set default 0;
alter table public.profiles alter column streak_count set default 0;
alter table public.profiles alter column total_focus_minutes set default 0;

-- ------------------------------------------------------------------
-- 2) Explicit WITH CHECK on the update policy. Postgres applies USING as
--    WITH CHECK when omitted, but implicit security invites a wrong "fix".
-- ------------------------------------------------------------------
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------------
-- 3) Column-level privileges.
--    authenticated: SELECT everything, INSERT identity columns only,
--    UPDATE cosmetic columns only. anon: no writes. service_role keeps
--    table-level ALL, so the Express server and Stripe webhooks are
--    unaffected. PostgREST rejects any payload naming a revoked column
--    outright (42501) - client payloads must not send them.
-- ------------------------------------------------------------------
revoke insert, update, delete on table public.profiles from anon;
revoke insert, update on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant insert (id, email, full_name, avatar_url) on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

grant all on table public.profiles to service_role;

-- ------------------------------------------------------------------
-- 4) Atomic focus-minute recording. One UPDATE (the row lock serializes
--    concurrent writers) plus the daily_activity upsert every current
--    writer also performs. UTC date matches focusProgress.js.
-- ------------------------------------------------------------------
create or replace function public.increment_focus_minutes(p_minutes integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 480 then
    raise exception 'p_minutes out of range (1..480)' using errcode = '22003';
  end if;

  update public.profiles
     set total_focus_minutes = coalesce(total_focus_minutes, 0) + p_minutes,
         updated_at = timezone('utc', now())
   where id = v_uid
   returning total_focus_minutes into v_total;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.daily_activity (user_id, date, minutes_focused)
  values (v_uid, (now() at time zone 'utc')::date, p_minutes)
  on conflict (user_id, date) do update
    set minutes_focused = coalesce(public.daily_activity.minutes_focused, 0)
                          + excluded.minutes_focused;

  return v_total;
end;
$$;

revoke all on function public.increment_focus_minutes(integer) from public, anon;
grant execute on function public.increment_focus_minutes(integer) to authenticated;

-- ------------------------------------------------------------------
-- 5) Atomic AI credit consumption: daily reset + limit check + increment
--    in ONE guarded UPDATE. p_user_id is honored ONLY for service_role
--    callers (the edge function's backend path); authenticated callers
--    are always keyed to their own auth.uid(). UTC date matches
--    server.js checkAndIncrementAILimit.
-- ------------------------------------------------------------------
drop function if exists public.consume_ai_credit();
drop function if exists public.consume_ai_credit(uuid);

create function public.consume_ai_credit(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_today date := (now() at time zone 'utc')::date;
  v_limit constant integer := 5;
  v_is_pro boolean;
  v_count integer;
begin
  if auth.role() = 'service_role' then
    v_uid := coalesce(p_user_id, auth.uid());
  else
    v_uid := auth.uid();
  end if;
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select coalesce(is_pro, false) into v_is_pro
    from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  -- Pro bypass, parity with server.js (no metering for pro).
  if v_is_pro then
    return jsonb_build_object('allowed', true, 'is_pro', true,
                              'remaining', -1, 'limit', -1);
  end if;

  update public.profiles
     set ai_usage_count = case
           when last_usage_date is distinct from v_today then 1
           else coalesce(ai_usage_count, 0) + 1
         end,
         last_usage_date = v_today
   where id = v_uid
     and ( last_usage_date is distinct from v_today
           or coalesce(ai_usage_count, 0) < v_limit )
   returning ai_usage_count into v_count;

  if found then
    return jsonb_build_object('allowed', true, 'is_pro', false,
                              'remaining', greatest(v_limit - v_count, 0),
                              'limit', v_limit);
  end if;

  return jsonb_build_object('allowed', false, 'is_pro', false,
                            'remaining', 0, 'limit', v_limit);
end;
$$;

revoke all on function public.consume_ai_credit(uuid) from public, anon;
grant execute on function public.consume_ai_credit(uuid) to authenticated, service_role;

-- Make PostgREST pick up the new RPCs and privilege changes immediately.
notify pgrst, 'reload schema';

commit;
