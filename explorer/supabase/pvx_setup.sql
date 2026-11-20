-- PV Explorer — Supabase schema (same project as DeepPVMapper / PV Check, tables prefixed pvx_).
-- Replayable: run the whole file again in the SQL editor after any change.
--
-- Who writes what
--   pvx_players  the player's pseudo, keyed on auth.uid() (anonymous sign-in). Written by the page itself (RLS: own row).
--   pvx_games    one row per finished game. Written ONLY by the Edge Function pvx-submit (service role), which replays
--                the trace with js/game.js and recomputes the score: the page cannot insert a score of its own.
--   pvx_leaderboard(day)  public read of the day's ranking (first game of each player only).
--
-- Ranking rule: a player's FIRST finished game of the day is ranked; later games ("Rejouer") are stored too
-- (attempt 2, 3…, useful for the trace visualisation) but not ranked, since the suns seen in game 1 are no longer hidden.

-- ─── players ───────────────────────────────────────────────────────────────
create table if not exists public.pvx_players (
    id          uuid primary key references auth.users(id) on delete cascade,
    pseudo      text not null check (char_length(pseudo) between 2 and 24 and pseudo = btrim(pseudo)),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index if not exists pvx_players_pseudo_ci on public.pvx_players (lower(pseudo));

-- Pseudo filter: a short list of insults and hate terms, FR + EN. The pseudo is normalised first (lower case, accents
-- and separators removed, common digit swaps 0→o 1→i 3→e 4→a 5→s 7→t), so « S.a.l.0.p.e » is caught too.
-- Long words are matched anywhere; short ambiguous ones (con, pd, pute, fdp…) only as a whole word.
-- Not exhaustive: an offensive pseudo that gets through is renamed by hand (see « moderation » at the end).
create or replace function public.pvx_pseudo_ok(p text) returns boolean
language sql immutable as $$
    with n as (
        select translate(lower(unaccent_text), '013457', 'oieast') as w,
               regexp_replace(translate(lower(unaccent_text), '013457', 'oieast'), '[^a-z]', '', 'g') as glued
        from (select translate(p, 'ÀÂÄÁÃÇÉÈÊËÍÎÏÌÑÓÔÖÒÕÚÛÜÙÝàâäáãçéèêëíîïìñóôöòõúûüùýÿŒœÆæ',
                                  'AAAAACEEEEIIIINOOOOOUUUUYaaaaaceeeeiiiinooooouuuuyyOoAa') as unaccent_text) u
    )
    select not (
        n.glued ~ '(connard|connasse|salope|salaud|encule|enculer|batard|bougnoul|negro|negre|youpin|tapette|tarlouze|nazi|hitler|fuhrer|nigger|nigga|faggot|cunt|whore|bitch|asshole|motherfuck|fuck|shit|merdeux|pouffiasse|niquetamere|suceur|couille|pornhub|porno|kkk|siegheil|heilhitler|jihad|terroris)'
        or n.w ~ '(^|[^a-z])(con|cons|conne|connes|pd|pede|pute|putes|fdp|tg|ntm|nique|bite|chatte|viol|pedale|retard|ass|sex|cul|merde)([^a-z]|$)'
    ) from n;
$$;
alter table public.pvx_players drop constraint if exists pvx_players_pseudo_ok;
alter table public.pvx_players add constraint pvx_players_pseudo_ok check (public.pvx_pseudo_ok(pseudo));

alter table public.pvx_players enable row level security;

drop policy if exists "pvx: insert own player" on public.pvx_players;
create policy "pvx: insert own player" on public.pvx_players
    for insert to authenticated with check (auth.uid() = id);

drop policy if exists "pvx: read own player" on public.pvx_players;
create policy "pvx: read own player" on public.pvx_players
    for select to authenticated using (auth.uid() = id);

drop policy if exists "pvx: rename own player" on public.pvx_players;
create policy "pvx: rename own player" on public.pvx_players
    for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ─── games ─────────────────────────────────────────────────────────────────
create table if not exists public.pvx_games (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    day         date not null,                       -- Paris date of the daily suns
    attempt     smallint not null check (attempt >= 1),
    data        text not null,                       -- config.json "data": id of the nodes.json the trace refers to
    path        integer[] not null,                  -- node ids, start first
    score       integer not null,                    -- collected power (kWc × multipliers)
    mult        smallint not null,                   -- multiplier at the end
    suns        smallint not null,                   -- suns collected
    km          real not null,                       -- distance walked
    factor      real not null,                       -- distance factor (1 … 1.5)
    final       integer not null,                    -- round(score × factor): the ranked value
    created_at  timestamptz not null default now(),
    unique (user_id, day, attempt)
);
create index if not exists pvx_games_rank on public.pvx_games (day, final desc) where attempt = 1;

alter table public.pvx_games enable row level security;
-- no insert / update / delete policy: only the service role (Edge Function) writes.
drop policy if exists "pvx: read own games" on public.pvx_games;
create policy "pvx: read own games" on public.pvx_games
    for select to authenticated using (auth.uid() = user_id);

-- ─── leaderboard ───────────────────────────────────────────────────────────
-- Top p_limit of the day + the caller's own row (wherever it ranks). Pseudos of other players are only readable here.
drop function if exists public.pvx_leaderboard(date, integer);
create function public.pvx_leaderboard(p_day date, p_limit integer default 100)
returns table (rank bigint, pseudo text, final integer, mult smallint, factor real, km real, me boolean, players bigint)
language sql stable security definer set search_path = public as $$
    with r as (
        select g.user_id, p.pseudo, g.final, g.mult, g.factor, g.km,
               row_number() over (order by g.final desc, g.created_at) as rank,
               count(*) over () as players
        from pvx_games g join pvx_players p on p.id = g.user_id
        where g.day = p_day and g.attempt = 1
    )
    select r.rank, r.pseudo, r.final, r.mult, r.factor, r.km, r.user_id = auth.uid(), r.players
    from r
    where r.rank <= least(greatest(p_limit, 1), 500) or r.user_id = auth.uid()
    order by r.rank;
$$;
revoke all on function public.pvx_leaderboard(date, integer) from public;
grant execute on function public.pvx_leaderboard(date, integer) to anon, authenticated;

-- ─── telling the apps apart in auth.users (shared with PV Check) ──────────────
-- PV Explorer tags its anonymous accounts at sign-in: raw_user_meta_data->>'app' = 'pv-explorer' (js/backend.js).
-- select coalesce(u.raw_user_meta_data->>'app', case when p.id is not null then 'pv-check' else '?' end) as app,
--        u.is_anonymous, count(*)
-- from auth.users u left join public.profiles p on p.id = u.id
-- group by 1, 2 order by 1, 2;

-- ─── moderation (SQL editor) ────────────────────────────────────────────────
-- rename:  update pvx_players set pseudo = 'Joueur ' || left(id::text, 4) where lower(pseudo) = lower('…');
-- remove a player and all their games:  delete from auth.users where id = '…';   (cascades to pvx_players, pvx_games)

-- ─── for the trace visualisation (run as owner in the SQL editor, not exposed to the API) ──
-- select day, attempt, final, path from pvx_games where day = '2026-11-20' order by final desc;
