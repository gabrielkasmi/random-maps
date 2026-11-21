// PV Explorer — online part (Supabase, same project as DeepPVMapper / PV Check; schema: supabase/pvx_setup.sql).
// Everything here is optional: if the CDN, the network or the project is unavailable, the game stays playable and
// keeps its scores in this browser (app.js falls back to localStorage).
//
// - Identity: anonymous Supabase Auth session, created only when the player confirms a pseudo (no account for
//   visitors who never play). The session lives in localStorage under 'pvx.auth'.
// - Scores: never written from here. The page sends the trace (node ids) to the Edge Function pvx-submit, which
//   replays it with game.js and records the recomputed score.
const SUPABASE_URL = 'https://zelhliylrlktnasircwp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rKz4rtTA3hpRxPgN3C3yAg_bbT5iTBi';   // public by design (RLS does the rest)
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let sb = null, loading = null;
const OFF = new URLSearchParams(location.search).has('offline');   // ?offline: local-only mode (tests, demos)

/** Loads the SDK and restores the session if there is one. Resolves to {uid, pseudo} or null (no session yet). */
export function init() {
  if (OFF) return Promise.reject(new Error('offline'));
  return loading ??= (async () => {
    const { createClient } = await import(SDK);
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'pvx.auth', persistSession: true, autoRefreshToken: true } });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('pvx_players').select('pseudo').eq('id', session.user.id).maybeSingle();
    return { uid: session.user.id, pseudo: data?.pseudo ?? null };
  })();
}

async function session() {
  await init();
  const { data: { session: s } } = await sb.auth.getSession();
  if (s) return s;
  // the tag tells PV Explorer accounts apart from PV Check ones in the shared auth.users (raw_user_meta_data->>'app')
  const { data, error } = await sb.auth.signInAnonymously({ options: { data: { app: 'pv-explorer' } } });
  if (error) throw error;
  return data.session;
}

/** Draws the start of a new game on the server. Resolves to {ok:true, node, ticket} or {ok:false, reason}
 *  (reason 'pseudo': no pseudo registered yet; 'network': try later). The ticket goes back with submit(). */
export async function newStart(day) {
  try {
    await session();
    const { data: res, error } = await sb.functions.invoke('pvx-submit', { body: { action: 'start', day } });
    if (!error) return res;
    const body = await error.context?.json?.().catch(() => null);
    return body && body.reason ? body : { ok: false, reason: 'network', error };
  } catch (error) { return { ok: false, reason: 'network', error }; }
}

/** Saves the pseudo for this player. Resolves to {ok:true} or {ok:false, reason:'taken'|'invalid'|'error'}. */
export async function claimPseudo(pseudo) {
  const p = pseudo.trim();
  if (p.length < 2 || p.length > 24) return { ok: false, reason: 'invalid' };
  try {
    const s = await session();
    const { error } = await sb.from('pvx_players').upsert({ id: s.user.id, pseudo: p, updated_at: new Date().toISOString() });
    if (!error) return { ok: true };
    return { ok: false, reason: error.code === '23505' ? 'taken' : error.code === '23514' ? 'invalid' : 'error', error };
  } catch (error) { return { ok: false, reason: 'error', error }; }
}

/** Sends a finished trace. Resolves to the function's answer ({ok:true, final, rank, players, ranked, attempt…}
 *  or {ok:false, reason}); reason 'network' means "try again later". */
export async function submit(day, path, data, ticket) {
  try {
    await session();
    const { data: res, error } = await sb.functions.invoke('pvx-submit', { body: { day, path, data, ticket } });
    if (!error) return res;
    const body = await error.context?.json?.().catch(() => null);   // FunctionsHttpError: the function's JSON reply
    return body && body.reason ? body : { ok: false, reason: 'network', error };
  } catch (error) { return { ok: false, reason: 'network', error }; }
}

/** Ranking of the day: [{rank, pseudo, final, mult, factor, km, me, players}], every player (server cap 500). */
export async function leaderboard(day) {
  await init();
  const { data, error } = await sb.rpc('pvx_leaderboard', { p_day: day, p_limit: 500 });
  if (error) throw error;
  return data;
}

/** The player's album: [{fact, day}] (facts found in accepted games), or null when offline / no session. */
export async function album() {
  try {
    await init();
    const { data: { session: s } } = await sb.auth.getSession();
    if (!s) return null;
    const { data, error } = await sb.from('pvx_facts').select('fact, day').eq('user_id', s.user.id);
    if (error) throw error;
    return data;
  } catch (e) { console.warn('album offline', e); return null; }
}
