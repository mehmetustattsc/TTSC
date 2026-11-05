-- TTSC Takım: database tables and access rules for Supabase (Postgres).
-- Run once in the Supabase SQL editor. Every rule here mirrors js/store.js:
--   * only invited people get in (invites table); everyone else stays 'pending' and sees nothing
--   * coach <-> player notes and self ratings: only that player and the coaches
--   * board chat, members, fees, clubhouse: only board and admin
--   * roles can only be changed by an admin

-- ---------- people ----------
create table if not exists public.invites (
  email text primary key,
  role text not null default 'player' check (role in ('player', 'coach', 'board', 'admin')),
  name text not null,
  num int, pos text check (pos in ('TW', 'AB', 'MF', 'ST')), lang text not null default 'de',
  created_at timestamptz not null default now()
);

-- player-coach: a coach (or board member) who also plays has plays = true
alter table public.invites add column if not exists plays boolean not null default false;
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'pending' check (role in ('pending', 'player', 'coach', 'board', 'admin')),
  num int, pos text check (pos in ('TW', 'AB', 'MF', 'ST')),
  lang text not null default 'de' check (lang in ('tr', 'de', 'en', 'fr')),
  title text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists plays boolean not null default false;

-- role of the signed-in person (security definer so policies can call it without recursion)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select coalesce((select role from public.profiles where id = auth.uid()), 'none') $$;

create or replace function public.is_member() returns boolean language sql stable as $$ select public.my_role() in ('player', 'coach', 'board', 'admin') $$;
create or replace function public.is_staff()  returns boolean language sql stable as $$ select public.my_role() in ('coach', 'board', 'admin') $$;
create or replace function public.is_coach()  returns boolean language sql stable as $$ select public.my_role() = 'coach' $$;
create or replace function public.is_board()  returns boolean language sql stable as $$ select public.my_role() in ('board', 'admin') $$;
create or replace function public.is_admin()  returns boolean language sql stable as $$ select public.my_role() = 'admin' $$;

-- new login: take name/role from the invite, otherwise 'pending'
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  insert into public.profiles (id, name, role, num, pos, lang, plays)
  values (new.id, coalesce(inv.name, split_part(new.email, '@', 1)), coalesce(inv.role, 'pending'), inv.num, inv.pos, coalesce(inv.lang, 'de'), coalesce(inv.plays, false));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- nobody but an admin may change a role
create or replace function public.guard_role() returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.plays is distinct from old.plays) and not public.is_admin() then raise exception 'only admins change roles'; end if;
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles for each row execute function public.guard_role();

create table if not exists public.availability (
  player_id uuid primary key references public.profiles on delete cascade,
  status text not null default 'fit' check (status in ('fit', 'limited', 'injured')),
  updated_at timestamptz not null default now()
);

-- ---------- calendar ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('training', 'match', 'event')),
  title text, opponent text, home boolean,
  date date not null, time time not null, place text, note text,
  result_us int, result_them int,
  created_by uuid references public.profiles, created_at timestamptz not null default now()
);
create table if not exists public.rsvps (
  event_id uuid references public.events on delete cascade,
  player_id uuid references public.profiles on delete cascade,
  status text not null check (status in ('yes', 'no')),
  reason text check (reason in ('work', 'school', 'sick', 'injured', 'family', 'travel', 'other')),
  text text, updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
create table if not exists public.attendance (
  event_id uuid references public.events on delete cascade,
  player_id uuid references public.profiles on delete cascade,
  present boolean not null,
  primary key (event_id, player_id)
);
create table if not exists public.match_stats (
  event_id uuid references public.events on delete cascade,
  player_id uuid references public.profiles on delete cascade,
  minutes int not null default 0, goals int not null default 0, assists int not null default 0,
  yellow int not null default 0, red int not null default 0,
  primary key (event_id, player_id)
);

-- ---------- private development notes ----------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('coach', 'toCoach')),
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid references public.profiles on delete cascade,      -- the player for 'coach' notes, null for 'toCoach'
  event_id uuid references public.events on delete set null,
  good text[] not null default '{}', improve text[] not null default '{}', tags text[] not null default '{}',
  text text, text_lang text, translations jsonb not null default '{}',  -- filled by the translation step later
  created_at timestamptz not null default now()
);
create table if not exists public.self_ratings (
  player_id uuid references public.profiles on delete cascade,
  event_id uuid references public.events on delete cascade,
  rating int not null check (rating between 1 and 5),
  good text[] not null default '{}', improve text[] not null default '{}', text text,
  created_at timestamptz not null default now(),
  primary key (player_id, event_id)
);

-- ---------- chat ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('team', 'board')),
  from_id uuid not null references public.profiles on delete cascade,
  text text not null check (length(text) between 1 and 2000),
  text_lang text, translations jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_time on public.messages (channel, created_at);

-- ---------- board: members, fees, clubhouse ----------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null, type text not null check (type in ('active', 'passive', 'support')),
  since int, user_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.fees (
  member_id uuid references public.members on delete cascade, year int not null, paid_on date,
  primary key (member_id, year)
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  title text not null, date date not null, time time, who text, note text,
  created_by uuid references public.profiles, created_at timestamptz not null default now()
);
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  title text not null, text text, status text not null default 'open' check (status in ('open', 'doing', 'done')),
  reported_by uuid references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz
);

-- ---------- season statistics taken from fussball.de (per player name) ----------
-- Filled by the board (SQL editor); visible only to signed-in team members, never public.
create table if not exists public.season_stats (
  season text not null, name text not null,
  apps int not null default 0, minutes int not null default 0, goals int not null default 0,
  source text, updated_on date not null default current_date,
  primary key (season, name)
);

-- ---------- access rules ----------
alter table public.invites      enable row level security;
alter table public.profiles     enable row level security;
alter table public.availability enable row level security;
alter table public.events       enable row level security;
alter table public.rsvps        enable row level security;
alter table public.attendance   enable row level security;
alter table public.match_stats  enable row level security;
alter table public.notes        enable row level security;
alter table public.self_ratings enable row level security;
alter table public.messages     enable row level security;
alter table public.members      enable row level security;
alter table public.fees         enable row level security;
alter table public.bookings     enable row level security;
alter table public.repairs      enable row level security;
alter table public.season_stats enable row level security;

drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all using (public.is_admin()) with check (public.is_admin());
-- coaches and board may invite players (adding a player = inviting their email)
drop policy if exists invites_staff_read on public.invites;
create policy invites_staff_read on public.invites for select using (public.is_staff());
drop policy if exists invites_staff_add on public.invites;
create policy invites_staff_add on public.invites for insert with check (public.is_staff() and role = 'player');

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (public.is_member() or id = auth.uid());
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for update using (public.is_admin());

drop policy if exists avail_read on public.availability;
create policy avail_read on public.availability for select using (public.is_member());
drop policy if exists avail_own on public.availability;
create policy avail_own on public.availability for all using (player_id = auth.uid() or public.is_coach()) with check (player_id = auth.uid() or public.is_coach());

drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (public.is_member());
drop policy if exists events_write on public.events;
create policy events_write on public.events for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists rsvps_read on public.rsvps;
create policy rsvps_read on public.rsvps for select using (public.is_member());
drop policy if exists rsvps_own on public.rsvps;
create policy rsvps_own on public.rsvps for all using (player_id = auth.uid()) with check (player_id = auth.uid() and public.is_member());

drop policy if exists att_read on public.attendance;
create policy att_read on public.attendance for select using (public.is_member());
drop policy if exists att_coach on public.attendance;
create policy att_coach on public.attendance for all using (public.is_coach()) with check (public.is_coach());
drop policy if exists stats_read on public.match_stats;
create policy stats_read on public.match_stats for select using (public.is_member());
drop policy if exists stats_coach on public.match_stats;
create policy stats_coach on public.match_stats for all using (public.is_coach()) with check (public.is_coach());

-- notes: the board never sees them
drop policy if exists notes_read on public.notes;
create policy notes_read on public.notes for select using (
  (kind = 'coach'   and (to_id = auth.uid() or public.is_coach())) or
  (kind = 'toCoach' and (from_id = auth.uid() or public.is_coach())));
drop policy if exists notes_write_coach on public.notes;
create policy notes_write_coach on public.notes for insert with check (kind = 'coach' and from_id = auth.uid() and public.is_coach());
drop policy if exists notes_write_player on public.notes;
create policy notes_write_player on public.notes for insert with check (kind = 'toCoach' and from_id = auth.uid() and public.my_role() = 'player' and to_id is null);

drop policy if exists self_read on public.self_ratings;
create policy self_read on public.self_ratings for select using (player_id = auth.uid() or public.is_coach());
drop policy if exists self_own on public.self_ratings;
create policy self_own on public.self_ratings for all using (player_id = auth.uid()) with check (player_id = auth.uid() and (public.my_role() = 'player' or (select plays from public.profiles where id = auth.uid())));

drop policy if exists msg_read on public.messages;
create policy msg_read on public.messages for select using ((channel = 'team' and public.is_member()) or (channel = 'board' and public.is_board()));
drop policy if exists msg_write on public.messages;
create policy msg_write on public.messages for insert with check (from_id = auth.uid() and ((channel = 'team' and public.is_member()) or (channel = 'board' and public.is_board())));
drop policy if exists msg_delete_own on public.messages;
create policy msg_delete_own on public.messages for delete using (from_id = auth.uid() or public.is_admin());

drop policy if exists members_board on public.members;
create policy members_board on public.members for all using (public.is_board()) with check (public.is_board());
drop policy if exists fees_board on public.fees;
create policy fees_board on public.fees for all using (public.is_board()) with check (public.is_board());
drop policy if exists bookings_board on public.bookings;
create policy bookings_board on public.bookings for all using (public.is_board()) with check (public.is_board());
drop policy if exists season_read on public.season_stats;
create policy season_read on public.season_stats for select using (public.is_member());
drop policy if exists season_board on public.season_stats;
create policy season_board on public.season_stats for all using (public.is_board()) with check (public.is_board());
drop policy if exists repairs_board on public.repairs;
create policy repairs_board on public.repairs for all using (public.is_board()) with check (public.is_board());

-- live updates for the chat and the calendar
do $$ begin
  alter publication supabase_realtime add table public.messages, public.rsvps, public.events, public.notes;
exception when duplicate_object then null; end $$;

-- the app needs read access for signed-in users
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
