-- Push notifications: database triggers call the edge function "notify".
-- Applied by .github/workflows/db.yml after schema.sql (needs pg_net; pg_cron for the daily reminder).
-- Safe to run again.

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: %', sqlerrm; end $$;

-- send one call per statement (adding 4 weekly trainings = one call), never per row
create or replace function public.notify_hook() returns trigger
language plpgsql security definer set search_path = public as $$
declare url text; secret text; rows jsonb;
begin
  select value into url from private.app_secrets where key = 'function_url';
  select value into secret from private.app_secrets where key = 'hook';
  if url is null or secret is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from new_rows r;
  if jsonb_array_length(rows) = 0 then return null; end if;
  perform net.http_post(url := url, body := jsonb_build_object('type', tg_table_name, 'rows', rows),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret));
  return null;
exception when others then
  raise warning 'notify_hook: %', sqlerrm;  -- a failed notification must never block saving
  return null;
end $$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages referencing new table as new_rows for each statement execute function public.notify_hook();
drop trigger if exists events_notify on public.events;
create trigger events_notify after insert on public.events referencing new table as new_rows for each statement execute function public.notify_hook();
drop trigger if exists notes_notify on public.notes;
create trigger notes_notify after insert on public.notes referencing new table as new_rows for each statement execute function public.notify_hook();

-- daily reminder for unanswered trainings and matches in the next two days
create or replace function public.notify_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare url text; secret text;
begin
  select value into url from private.app_secrets where key = 'function_url';
  select value into secret from private.app_secrets where key = 'hook';
  if url is null or secret is null then return; end if;
  perform net.http_post(url := url, body := jsonb_build_object('type', 'reminders'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret));
end $$;
revoke execute on function public.notify_reminders() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ttsc-reminders', '0 16 * * *', 'select public.notify_reminders()');  -- 17:00 in Buchen (winter), 18:00 (summer)
exception when others then raise notice 'pg_cron not available: %', sqlerrm; end $$;
