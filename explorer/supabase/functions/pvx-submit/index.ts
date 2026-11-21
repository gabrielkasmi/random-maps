// PV Explorer — pvx-submit: records a finished game after replaying it with the same rules as the page.
//
// POST { action: 'start', day }                                → 200 { ok, node, ticket }   (draws a new start)
// POST { day: 'YYYY-MM-DD', path: number[], data: string, ticket }   Authorization: Bearer <user access token>
// → 200 { ok, attempt, best, bestFinal, score, mult, suns, batteries, quests, km, factor, final, rank, players, facts }
//   facts: album ids found by this trace (also saved in pvx_facts)
//   best: this game is the player's best of the day (the ranked one); rank / players: rank of that best game
// → 4xx { ok: false, reason }   reasons: auth, pseudo, body, data, day, start, length, node, edge, attempts
//
// The start is drawn here, anew for each game, and returned with a ticket = HMAC(user:day:node), keyed with the
// service role key (already in the function's environment, never sent out). A game is accepted only if its first
// node comes with a valid ticket: the start was drawn, not chosen. Rerolling (asking for starts until one looks
// good) is allowed by design, like playing again. Games are unlimited (MAX_ATTEMPTS is only a safety cap); the best
// one of the day is ranked.
//
// game.js, nodes.json, config.json and facts.json are COPIES of ../../../js/game.js and ../../../data/*.json, made by
// ../../sync.sh before each deploy (gitignored). The page sends config.json's "data" id; a mismatch means the
// function and the site were deployed with different nodes: redeploy after running sync.sh.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { prepareNodes, dailyBonuses, dailyBatteries, dailyQuests, scoreTrace, traceKm, distanceFactor, finalScore, parisDay, startNode, factsFound } from './game.js';
import nodesJson from './nodes.json' with { type: 'json' };
import cfg from './config.json' with { type: 'json' };
import factsJson from './facts.json' with { type: 'json' };

const N = prepareNodes(nodesJson);
// facts found by a trace (game.js factsFound): curated ones (radius or département) and the départements crossed
const factsOf = (path: number[]) => factsFound(N, factsJson.f, path);
const G = cfg.game;
const MAX_ATTEMPTS = 500;            // per player and day: a safety cap, not a game rule
const GRACE_MS = 2 * 3600 * 1000;    // a game started before midnight (Paris) can still be sent for 2 h
// the day's suns, batteries and quests (same draw as the page)
type Day = { bonuses: ReturnType<typeof dailyBonuses>; batteries: ReturnType<typeof dailyBatteries>; quests: ReturnType<typeof dailyQuests> };
const dayCache = new Map<string, Day>();
const dayOf = (day: string): Day => {
  if (!dayCache.has(day)) {
    if (dayCache.size > 4) dayCache.clear();
    const bonuses = dailyBonuses(N, G.bonus, day);
    dayCache.set(day, { bonuses, batteries: dailyBatteries(N, G.battery, day, bonuses), quests: dailyQuests(G.quests, day) });
  }
  return dayCache.get(day)!;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',  // auth is a bearer token, not a cookie: any origin is fine
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, reason: string, extra = {}) => reply(status, { ok: false, reason, ...extra });

// ticket = hex HMAC-SHA256 of `${uid}:${day}:${node}`
const hmacKey = crypto.subtle.importKey('raw', new TextEncoder().encode('pvx-start:' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sign = async (s: string) => [...new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey, new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

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
  let body: { action?: unknown; day?: unknown; path?: unknown; data?: unknown; ticket?: unknown };
  try { body = await req.json(); } catch { return fail(400, 'body'); }
  const { day, path, data, ticket } = body;
  const now = Date.now();
  if (body.action === 'start') {        // a new game: draw its start for today
    const today = parisDay(new Date(now));
    if (day !== today) return fail(422, 'day');
    const node = startNode(N, crypto.randomUUID(), dayOf(today).bonuses, G.startMin, G.startBand);
    return reply(200, { ok: true, node, ticket: await sign(`${uid}:${today}:${node}`) });
  }
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(path)) return fail(400, 'body');
  if (data !== cfg.data) return fail(409, 'data', { expected: cfg.data });
  if (day !== parisDay(new Date(now)) && day !== parisDay(new Date(now - GRACE_MS))) return fail(422, 'day');

  // previous games of the day (the same trace sent twice, e.g. after a reload, is not a new attempt)
  const { data: prev, error: pe } = await admin.from('pvx_games').select('attempt, path').eq('user_id', uid).eq('day', day);
  if (pe) return fail(500, 'db');
  const same = prev!.find(r => r.path.length === path.length && r.path.every((v: number, i: number) => v === path[i]));
  // the start must have been drawn here (for this player and day)
  if (!same && (typeof ticket !== 'string' || ticket !== await sign(`${uid}:${day}:${path[0]}`))) return fail(422, 'start');

  // replay: same rules as the page
  const D = dayOf(day);
  const res = scoreTrace(N, G.steps, D.bonuses, path as number[], G.startMin, D.batteries, D.quests, G.combo);
  if (!res.ok) return fail(422, res.reason, res.at !== undefined ? { at: res.at } : {});
  const km = Math.round(traceKm(N, path as number[]) * 10) / 10;
  const factor = distanceFactor(N, path as number[], G.distance);
  const final = finalScore(res.score, factor, res.quests, G.quests?.bonus ?? 1);

  let attempt = same?.attempt;
  if (!attempt) {
    if (prev!.length >= MAX_ATTEMPTS) return fail(429, 'attempts');
    attempt = Math.max(0, ...prev!.map(r => r.attempt)) + 1;
    const { error: ie } = await admin.from('pvx_games').insert({
      user_id: uid, day, attempt, data: cfg.data, path, score: res.score, mult: res.mult, suns: res.bonuses,
      batteries: res.batteries, quests: res.quests, km, factor, final,
    });
    if (ie) return fail(ie.code === '23505' ? 409 : 500, ie.code === '23505' ? 'race' : 'db');  // 23505: two sends at once
  }

  // album (best effort: a failure here does not lose the game)
  const facts = factsOf(path as number[]);
  if (facts.length) {
    const { error: fe } = await admin.from('pvx_facts').upsert(facts.map(fact => ({ user_id: uid, fact, day })), { onConflict: 'user_id,fact', ignoreDuplicates: true });
    if (fe) console.error('pvx_facts', fe);
  }

  // rank of the player's best game of the day
  const { data: rk, error: re } = await admin.rpc('pvx_rank', { p_day: day, p_user: uid });
  if (re) console.error('pvx_rank', re);
  const r = rk?.[0];
  return reply(200, {
    ok: true, attempt, best: r ? r.best === final : true, bestFinal: r?.best ?? final,
    score: res.score, mult: res.mult, suns: res.bonuses, batteries: res.batteries, quests: res.quests, km, factor, final,
    rank: r?.rank ?? null, players: r?.players ?? null, facts,
  });
});
