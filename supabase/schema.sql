-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  source text,               -- 'windows_notification' | 'baileys' | 'manual_test'
  group_name text,
  raw_text text,

  pickup text,
  drop_location text,        -- named drop_location, not "drop" (reserved word)
  date_text text,
  time_text text,
  vehicle text,
  passengers text,
  price text,
  contact text,
  other_details text,

  matched boolean not null default false,
  matched_filter_labels text[] not null default '{}'
);

-- Index for the analytics dashboard later (queries by time, by route)
create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_matched_idx on public.messages (matched) where matched = true;

create table if not exists public.push_tokens (
  token text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_filters (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  pickup text not null default '',
  drop_location text not null default '',
  vehicle text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- The phone app connects with the ANON key and should only ever be able
-- to READ matched rows — never write, never see non-matched rows (some
-- of which may be junk/spam messages you don't want cluttering his view).
drop policy if exists "Public can read matched messages" on public.messages;
create policy "Public can read matched messages"
  on public.messages for select
  using (matched = true);
grant select on public.messages to anon;

alter table public.trip_filters enable row level security;
grant select on public.trip_filters to anon;
grant select, insert, update, delete on public.trip_filters to service_role;
drop policy if exists "Public can read trip filters" on public.trip_filters;
create policy "Public can read trip filters"
  on public.trip_filters for select
  to anon
  using (true);

create or replace function public.create_trip_filter(
  p_label text, p_pickup text, p_drop_location text, p_vehicle text
)
returns public.trip_filters
language plpgsql
security definer
set search_path = public
as $$
declare created public.trip_filters;
begin
  insert into public.trip_filters (label, pickup, drop_location, vehicle)
  values (trim(p_label), trim(p_pickup), trim(p_drop_location), trim(p_vehicle))
  returning * into created;
  return created;
end;
$$;
revoke all on function public.create_trip_filter(text, text, text, text) from public;
grant execute on function public.create_trip_filter(text, text, text, text) to anon;

create or replace function public.set_trip_filter_enabled(p_id uuid, p_enabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trip_filters set enabled = p_enabled where id = p_id;
$$;
revoke all on function public.set_trip_filter_enabled(uuid, boolean) from public;
grant execute on function public.set_trip_filter_enabled(uuid, boolean) to anon;

create or replace function public.delete_trip_filter(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trip_filters where id = p_id;
$$;
revoke all on function public.delete_trip_filter(uuid) from public;
grant execute on function public.delete_trip_filter(uuid) to anon;

-- Keep writes server-only. The explicit grant/policy also repairs projects
-- where table privileges were changed after this schema was first run.
grant usage on schema public to service_role;
grant insert on public.messages to service_role;
drop policy if exists "Server can insert messages" on public.messages;
create policy "Server can insert messages"
  on public.messages for insert
  to service_role
  with check (true);

alter table public.push_tokens enable row level security;
grant insert, update on public.push_tokens to anon;
grant select, delete on public.push_tokens to service_role;
drop policy if exists "Public can register push tokens" on public.push_tokens;
create policy "Public can register push tokens"
  on public.push_tokens for insert
  to anon
  with check (length(token) > 20);
drop policy if exists "Public can refresh push tokens" on public.push_tokens;
create policy "Public can refresh push tokens"
  on public.push_tokens for update
  to anon
  using (true)
  with check (length(token) > 20);

-- Register tokens through a controlled function so the public client never
-- needs SELECT access to this table or direct upsert privileges.
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_token) <= 20 then
    raise exception 'Invalid push token';
  end if;

  insert into public.push_tokens (token, updated_at)
  values (p_token, now())
  on conflict (token) do update set updated_at = now();
end;
$$;
revoke all on function public.register_push_token(text) from public;
grant execute on function public.register_push_token(text) to anon;

-- No insert/update/delete policy is created for the anon/public role,
-- which means the public key used by the phone app cannot write rows.

-- Enable realtime broadcasts for this table (Supabase-specific), but keep
-- this script safe to rerun when the table is already published.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_filters'
  ) then
    alter publication supabase_realtime add table public.trip_filters;
  end if;
end
$$;
