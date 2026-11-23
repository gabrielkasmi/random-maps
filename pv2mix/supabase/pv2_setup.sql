-- PV2Mix — Supabase schema (same project as DeepPVMapper / PV Check / PV Explorer; tables prefixed pv2_).
-- Replayable: run the whole file again in the SQL editor after any change.
-- Needs "Allow anonymous sign-ins" (Authentication → Sign In / Providers), already on for PV Check and PV Explorer.
--
-- Existing collective self-consumption (ACC) operations, reported by visitors on a site's view.
--   pv2_acc_reports  one row per (site, visitor): 'active' (operation in service) or 'project' (being set up), with an
--                    optional note (operation name, organiser). Written by the page under RLS, by an anonymous
--                    auth.uid(); a visitor can change or withdraw their own report, never see anyone else's.
--   pv2_acc_sites    public summary per site: counts by status. No user id, no note.
--
-- A site is keyed on its Enedis address (site_key = '<insee>|<address>'), which survives a rebuild of sites.json
-- with another year of Enedis data; site_id (row number in that year's file) and label are kept for moderation.

create table if not exists public.pv2_acc_reports (
    site_key    text not null check (char_length(site_key) between 7 and 300),
    user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    site_id     integer,
    label       text check (label is null or char_length(label) <= 200),
    status      text not null check (status in ('active', 'project')),
    note        text check (note is null or char_length(note) <= 200),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    primary key (site_key, user_id)
);

-- At most 30 new reports per visitor and day (anonymous sign-ins are themselves rate-limited per IP by Supabase Auth).
create or replace function public.pv2_acc_reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    new.updated_at := now();
    if tg_op = 'INSERT' then
        new.created_at := now();
        if (select count(*) from public.pv2_acc_reports
            where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
            raise exception 'pv2: too many reports today' using errcode = 'P0001';
        end if;
    end if;
    new.note := nullif(btrim(new.note), '');
    return new;
end $$;
drop trigger if exists pv2_acc_reports_guard on public.pv2_acc_reports;
create trigger pv2_acc_reports_guard before insert or update on public.pv2_acc_reports
    for each row execute function public.pv2_acc_reports_guard();

alter table public.pv2_acc_reports enable row level security;

drop policy if exists "pv2: insert own report" on public.pv2_acc_reports;
create policy "pv2: insert own report" on public.pv2_acc_reports
    for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "pv2: read own report" on public.pv2_acc_reports;
create policy "pv2: read own report" on public.pv2_acc_reports
    for select to authenticated using (auth.uid() = user_id);
drop policy if exists "pv2: change own report" on public.pv2_acc_reports;
create policy "pv2: change own report" on public.pv2_acc_reports
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "pv2: withdraw own report" on public.pv2_acc_reports;
create policy "pv2: withdraw own report" on public.pv2_acc_reports
    for delete to authenticated using (auth.uid() = user_id);

revoke all on public.pv2_acc_reports from anon;
grant select, insert, update, delete on public.pv2_acc_reports to authenticated;

-- Public summary. A view runs with its owner's rights (security_invoker off), so it reads every report while
-- exposing only the counts.
create or replace view public.pv2_acc_sites as
    select site_key,
           count(*) filter (where status = 'active')::int  as active,
           count(*) filter (where status = 'project')::int as project,
           max(updated_at) as last_at
    from public.pv2_acc_reports
    group by site_key;
revoke all on public.pv2_acc_sites from public;
grant select on public.pv2_acc_sites to anon, authenticated;

-- ─── moderation (by hand, in the SQL editor) ──────────────────────────────────────
-- Latest reports, with notes:
--   select site_key, label, status, note, created_at, user_id from public.pv2_acc_reports order by updated_at desc limit 100;
-- Remove one visitor's reports (spam):
--   delete from public.pv2_acc_reports where user_id = '<uuid>';
