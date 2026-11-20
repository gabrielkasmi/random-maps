// PV Explorer — pvx-submit: records a finished game after replaying it with the same rules as the page.
//
// POST { day: 'YYYY-MM-DD', path: number[], data: string }   Authorization: Bearer <user access token>
// → 200 { ok, attempt, ranked, score, mult, suns, km, factor, final, rank, players }
// → 4xx { ok: false, reason }   reasons: auth, pseudo, body, data, day, length, node, start, edge, attempts
//
// game.js, nodes.json and config.json are COPIES of ../../../js/game.js and ../../../data/*.json, made by
// ../../sync.sh before each deploy (gitignored). The page sends config.json's "data" id; a mismatch means the
// function and the site were deployed with different nodes: redeploy after running sync.sh.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { prepareNodes, dailyBonuses, scoreTrace, traceKm, distanceFactor, parisDay } from './game.js';
import nodesJson from './nodes.json' with { type: 'json' };
import cfg from './config.json' with { type: 'json' };

const N = prepareNodes(nodesJson);
const G = cfg.game;
const MAX_ATTEMPTS = 50;             // per player and day
const GRACE_MS = 2 * 3600 * 1000;    // a game started before midnight (Paris) can still be sent for 2 h
const bonusCache = new Map<string, ReturnType<typeof dailyBonuses>>();
const bonusesOf = (day: string) => {
  if (!bonusCache.has(day)) { if (bonusCache.size > 4) bonusCache.clear(); bonusCache.set(day, dailyBonuses(N, G.bonus, day)); }
  return bonusCache.get(day)!;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',  // auth is a bearer token, not a cookie: any origin is fine
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, reason: string, extra = {}) => reply(status, { ok: false, reason, ...extra });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method');

  // who
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u, error: ue } = token ? await admin.auth.getUser(token) : { data: null, error: true };
  if (ue || !u?.user) return fail(401, 'auth');
  const uid = u.user.id;
  const { data: player } = await admin.from('pvx_players').select('pseudo').eq('id', uid).maybeSingle();
  if (!player) return fail(403, 'pseudo');

  // what
  let body: { day?: unknown; path?: unknown; data?: unknown };
  try { body = await req.json(); } catch { return fail(400, 'body'); }
  const { day, path, data } = body;
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(path)) return fail(400, 'body');
  if (data !== cfg.data) return fail(409, 'data', { expected: cfg.data });
  const now = Date.now();
  if (day !== parisDay(new Date(now)) && day !== parisDay(new Date(now - GRACE_MS))) return fail(422, 'day');

  // replay: same rules as the page
  const res = scoreTrace(N, G.steps, bonusesOf(day), path as number[], G.startMin);
  if (!res.ok) return fail(422, res.reason, res.at !== undefined ? { at: res.at } : {});
  const km = Math.round(traceKm(N, path as number[]) * 10) / 10;
  const factor = distanceFactor(N, path as number[], G.distance);
  const final = Math.round(res.score * factor);

  // store (idempotent: the same trace sent twice, e.g. after a reload, is not a new attempt)
  const { data: prev, error: pe } = await admin.from('pvx_games').select('attempt, path').eq('user_id', uid).eq('day', day);
  if (pe) return fail(500, 'db');
  const same = prev!.find(r => r.path.length === path.length && r.path.every((v: number, i: number) => v === path[i]));
  let attempt = same?.attempt;
  if (!attempt) {
    if (prev!.length >= MAX_ATTEMPTS) return fail(429, 'attempts');
    attempt = Math.max(0, ...prev!.map(r => r.attempt)) + 1;
    const { error: ie } = await admin.from('pvx_games').insert({
      user_id: uid, day, attempt, data: cfg.data, path, score: res.score, mult: res.mult, suns: res.bonuses, km, factor, final,
    });
    if (ie) return fail(ie.code === '23505' ? 409 : 500, ie.code === '23505' ? 'race' : 'db');  // 23505: two sends at once
  }

  // rank of the player's ranked (first) game
  const { data: first } = await admin.from('pvx_games').select('final, created_at').eq('user_id', uid).eq('day', day).eq('attempt', 1).maybeSingle();
  let rank = null, players = null;
  if (first) {
    const [{ count: above }, { count: tot }] = await Promise.all([
      admin.from('pvx_games').select('id', { count: 'exact', head: true }).eq('day', day).eq('attempt', 1).gt('final', first.final),
      admin.from('pvx_games').select('id', { count: 'exact', head: true }).eq('day', day).eq('attempt', 1),
    ]);
    rank = (above ?? 0) + 1; players = tot;
  }
  return reply(200, { ok: true, attempt, ranked: attempt === 1, score: res.score, mult: res.mult, suns: res.bonuses, km, factor, final, rank, players });
});
