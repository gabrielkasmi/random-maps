// PV Explorer — game rules. Pure module (no DOM): used by the page, by the simulator (Node) and, later, by the
// server-side score check (Supabase Edge Function, Deno). Everything is integer arithmetic so that the three agree.
//
// Rules
// - A trace starts on a node and makes up to `steps` moves; a move goes to the nearest node N / S / E / W (±45°).
// - Each node counts once per trace: its power (kWc, capped offline) times the current multiplier.
// - Daily bonuses (drawn from the Paris date, same for everyone): reaching a bonus node adds (m − 1) to the
//   multiplier (×5 then ×3 gives ×7), and the bonus node itself already counts with the new multiplier. The landing node counts nothing (score starts at 0).
// - Daily batteries (same draw, other salt, mostly in between town and countryside): reaching one adds steps.
// - Daily quests (3, same for everyone): each one done adds +bonus (0.1) to the final multiplier.
// - Combo: each step onto a fresh node of at least combo.min kWc adds combo.step tenths, applied at once to that
//   step (first one: +10 %), up to combo.max tenths (×2); a step onto an already seen or a small node resets it
//   and gets no combo. The start node counts nothing and starts no combo. Following the panels pays.
// - Start: random, but within a band of "potential" (what a plain greedy walk would collect from there), so that the
//   start decides less of the score and the way one plays decides more.
// - Final score = round(score × distance factor × (1 + quests done × bonus)).

export const DIRS = ['N', 'S', 'E', 'W'];

/** 'YYYY-MM-DD' of `date` in Europe/Paris. */
export function parisDay(date = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** 32-bit FNV-1a hash of a string. */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** mulberry32: returns a function giving uint32 values. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Columnar nodes.json -> typed arrays. */
export function prepareNodes(j) {
  const n = j.x.length;
  return { count: n, x: Int32Array.from(j.x), y: Int32Array.from(j.y), k: Int32Array.from(j.k), n: Int32Array.from(j.n),
    w: Int32Array.from(j.w), nb: Int32Array.from(j.nb), dp: j.dp ? Uint8Array.from(j.dp) : null,
    dc: j.dc ? Uint8Array.from(j.dc) : new Uint8Array(n), t: j.t ? Int16Array.from(j.t) : new Int16Array(n).fill(-1),
    tk: j.tk ? Int8Array.from(j.tk) : new Int8Array(n).fill(-1) };
}

/**
 * What a player knows about today's suns, given the trace so far (path = node ids, last = current node).
 * A sun is 'seen' once a visited node came within `sense` metres (or it was taken); otherwise, within `compass`
 * metres of the current node, only a rough direction (dir8: 0 = N, clockwise, 45° steps) and heat (1 tiède,
 * 2 chaud, 3 brûlant); farther away it is 'hidden'. Pure function: the page and the simulator share it.
 */
export function sunView(N, path, taken, bonuses, { sense = 6000, compass = 40000 } = {}) {
  const a = path[path.length - 1];
  return bonuses.map(b => {
    const v = { ...b, taken: taken.has(b.node), state: 'hidden' };   // works for suns {mult} and batteries {steps}
    if (v.taken || path.some(p => (N.x[p] - N.x[b.node]) ** 2 + (N.y[p] - N.y[b.node]) ** 2 <= sense * sense)) { v.state = 'seen'; return v; }
    const dx = N.x[b.node] - N.x[a], dy = N.y[b.node] - N.y[a], d = Math.hypot(dx, dy);
    if (d <= compass) { v.state = 'near'; v.dir8 = ((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) % 8) + 8) % 8; v.heat = d < 10000 ? 3 : d < 20000 ? 2 : 1; }
    return v;
  });
}

/** Daily bonuses: weighted draw without replacement (integer weights), at least `minSpacing` metres apart.
 *  Returns [{node, mult}], same result everywhere for the same (day, salt, nodes). */
export function dailyBonuses(N, bonusCfg, day) {
  const { mults } = bonusCfg;
  return draw(N, bonusCfg, day, i => N.w[i], [], r => ({ mult: mults[r() % mults.length] }));
}
/** Daily batteries: weighted by density class (cfg.weights[dc]), away from the suns. [{node, steps}] */
export function dailyBatteries(N, battCfg, day, bonuses = []) {
  if (!battCfg || !battCfg.count) return [];
  return draw(N, battCfg, day, i => battCfg.weights[N.dc[i]] || 0, bonuses, () => ({ steps: battCfg.steps }));
}
// weighted draw without replacement (integer weights), minSpacing apart (and from `avoid`); same result everywhere
function draw(N, { count, minSpacing, salt }, day, weight, avoid, extra) {
  const r = prng(hash32(`${salt}:${day}`));
  const cum = new Float64Array(N.count);
  let tot = 0;
  for (let i = 0; i < N.count; i++) { tot += weight(i); cum[i] = tot; }
  const out = [], min2 = minSpacing * minSpacing;
  for (let tries = 0; out.length < count && tries < 10000; tries++) {
    const t = Math.floor((r() / 4294967296) * tot);       // exact: tot < 2^31, r() < 2^32
    let lo = 0, hi = N.count - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] > t) hi = m; else lo = m + 1; }
    const a = lo;
    if (out.concat(avoid).some(b => (N.x[b.node] - N.x[a]) ** 2 + (N.y[b.node] - N.y[a]) ** 2 < min2)) continue;
    out.push({ node: a, ...extra(r) });
  }
  return out;
}

/* ---------------------------------------------------------------- quests
 * Three a day, the same for everyone: one "far" (go far), one "near" (dig in), one "geo" (places). Each is checked on
 * the trace alone, so the server replays it like the score. type → what counts; n → the target.
 * km: km walked · dept: départements crossed · streak: nodes in a row in the same town · big: 1 MWc nodes collected ·
 * kwc: kWc collected (no multiplier) · towns: towns (10 000+ inh., préfectures, sous-préfectures) passed · spref: sous-préfectures. */
// targets calibrated so that a good player who ignores the quest makes it ~20-30 % of the time (design/build/quest-rates.mjs)
export const QUESTS = {
  far: [{ type: 'km', n: [170, 180] }, { type: 'dept', n: [3] }],
  near: [{ type: 'streak', n: [3] }, { type: 'big', n: [4] }, { type: 'kwc', n: [14000] }],
  geo: [{ type: 'towns', n: [3] }, { type: 'spref', n: [1] }],
};
export function dailyQuests(questCfg, day) {
  if (!questCfg || !questCfg.count) return [];
  const r = prng(hash32(`${questCfg.salt}:${day}`));
  return ['far', 'near', 'geo'].slice(0, questCfg.count).map(cat => {
    const q = QUESTS[cat][r() % QUESTS[cat].length];
    return { cat, type: q.type, n: q.n[r() % q.n.length] };
  });
}
/** Progress of one quest on a game (Game instance or a replay): {v, n, done}. */
export function questState(N, g, q) {
  const p = g.path; let v = 0;
  if (q.type === 'km') v = Math.floor(traceKm(N, p));
  else if (q.type === 'dept') v = new Set(p.map(a => N.dp[a])).size;
  else if (q.type === 'towns') v = new Set(p.filter(a => N.t[a] >= 0).map(a => N.t[a])).size;
  else if (q.type === 'spref') v = new Set(p.filter(a => N.tk[a] === 1).map(a => N.t[a])).size;   // sous-préfectures
  else if (q.type === 'big') v = [...g.seen].filter(a => a !== g.path[0] && N.k[a] >= 1000).length;                   // 1 MWc installations
  else if (q.type === 'kwc') v = [...g.seen].reduce((s, a) => a === g.path[0] ? s : s + N.k[a], 0);
  else if (q.type === 'streak') {   // most nodes in a row inside the same town
    let run = 0;
    for (let i = 0; i < p.length; i++) { const t = N.t[p[i]]; run = t >= 0 && i && N.t[p[i - 1]] === t ? run + 1 : t >= 0 ? 1 : 0; v = Math.max(v, run); }
  }
  return { v, n: q.n, done: v >= q.n };
}
export const questsDone = (N, g, quests) => quests.filter(q => questState(N, g, q).done).length;
/** Final score: round(score × distance factor × (1 + quests done × bonus)), bonus in tenths (1 → +0.1). */
export const finalScore = (score, factor, done, tenths = 1) => Math.round(score * factor * (10 + done * tenths) / 10);

export class Game {
  constructor(N, steps, bonuses, batteries = [], combo = null) {
    this.N = N; this.steps = steps; this.cb = combo;
    this.bonus = new Map(bonuses.map(b => [b.node, b.mult]));
    this.batt = new Map(batteries.map(b => [b.node, b.steps]));
  }
  start(a) {
    this.path = [a]; this.seen = new Set(); this.taken = new Set(); this.charged = new Set();
    this.mult = 1; this.score = 0; this.left = this.steps; this.combo = 0;
    return this.#enter(a, true);
  }
  /** Combo level reached by stepping onto b (0 = reset). */
  #comboAt(b) { const cb = this.cb; return cb && !this.seen.has(b) && this.N.k[b] >= cb.min ? Math.min(this.combo + cb.step, cb.max) : 0; }
  #enter(a, first = false) {
    let bonus = 0, gain = 0, extra = 0;
    if (this.bonus.has(a) && !this.taken.has(a)) { bonus = this.bonus.get(a); this.taken.add(a); this.mult += bonus - 1; }
    if (this.batt.has(a) && !this.charged.has(a)) { extra = this.batt.get(a); this.charged.add(a); this.left += extra; }
    if (this.cb) this.combo = first ? 0 : this.#comboAt(a);
    // the landing node is marked as seen but does not count: the score starts at 0
    if (!this.seen.has(a)) { this.seen.add(a); gain = first ? 0 : Math.floor(this.N.k[a] * this.mult * (10 + this.combo) / 10); this.score += gain; }
    return { node: a, gain, bonus, extra, mult: this.mult, score: this.score, left: this.left, combo: this.combo };
  }
  /** Independent copy of the game in progress (used to explore other routes after a game). */
  clone() {
    const h = new Game(this.N, this.steps, [], [], this.cb);   // the constructor gives the private methods
    Object.assign(h, this);
    h.path = this.path.slice(); h.seen = new Set(this.seen); h.taken = new Set(this.taken); h.charged = new Set(this.charged);
    return h;
  }
  /** Neighbour of the current node in direction d (0 N, 1 S, 2 E, 3 W), or -1. */
  target(d) { return this.N.nb[this.node * 4 + d]; }
  get node() { return this.path[this.path.length - 1]; }
  /** Moves; returns the step result or null if impossible. */
  move(d) {
    if (this.left <= 0) return null;
    const b = this.target(d);
    if (b < 0) return null;
    this.left--; this.path.push(b);
    return { from: this.path[this.path.length - 2], dir: d, ...this.#enter(b) };
  }
  /** Gain the move would bring, without moving. */
  peek(d) {
    const b = this.target(d);
    if (b < 0 || this.left <= 0) return null;
    const m = this.mult + ((this.bonus.has(b) && !this.taken.has(b)) ? this.bonus.get(b) - 1 : 0);
    const k = this.seen.has(b) ? 0 : this.N.k[b] * m;
    return { node: b, gain: Math.floor(k * (10 + this.#comboAt(b)) / 10), mult: m };
  }
}

/**
 * Random start: a node drawn from a seed string, with at least 3 directions (no dead end). Online, pvx-submit draws
 * it with a random seed for each game and signs it; offline, the page draws it. Uniform over nodes: since nodes
 * follow the density of panels, starts land more often where panels are many (lots of power, short steps) than in
 * the countryside (long steps, suns).
 */
export function startNode(N, seed, bonuses = [], startMin = 0, band = null) {
  const r = prng(hash32(String(seed)));
  let any = 0;
  for (let i = 0; i < 10000; i++) {
    const a = r() % N.count; let k = 0;
    for (let d = 0; d < 4; d++) if (N.nb[a * 4 + d] >= 0) k++;
    if (k < 3 || !canStart(N, bonuses, a, startMin)) continue;
    if (!band) return a;
    any = any || a;
    const p = startPotential(N, a, band.steps);
    if (p >= band.min && p <= band.max) return a;
  }
  return any;
}

/** What a plain greedy walk (highest next gain, no suns) collects in `steps` moves from a: how rich a start is. */
export function startPotential(N, a, steps = 30) {
  const seen = new Set([a]); let score = N.k[a], n = a;
  for (let s = 0; s < steps; s++) {
    let best = -1, bd = -1;
    for (let d = 0; d < 4; d++) { const b = N.nb[n * 4 + d]; if (b < 0) continue; const v = seen.has(b) ? 0 : N.k[b]; if (v > best) { best = v; bd = b; } }
    if (bd < 0) break;
    n = bd; if (!seen.has(n)) { seen.add(n); score += N.k[n]; }
  }
  return score;
}

/** No start within `startMin` metres of a sun (config game.startMin). */
export function canStart(N, bonuses, a, startMin) {
  return bonuses.every(b => (N.x[b.node] - N.x[a]) ** 2 + (N.y[b.node] - N.y[a]) ** 2 >= startMin * startMin);
}

/** Server-side check: replays a path of node ids. Returns {ok, score, mult, bonuses, batteries, quests, reason}. */
export function scoreTrace(N, steps, bonuses, path, startMin = 0, batteries = [], quests = [], combo = null) {
  const maxLen = steps + 1 + batteries.reduce((s, b) => s + b.steps, 0);
  if (!Array.isArray(path) || path.length < 1 || path.length > maxLen) return { ok: false, reason: 'length' };
  if (path.some(a => !Number.isInteger(a) || a < 0 || a >= N.count)) return { ok: false, reason: 'node' };
  if (!canStart(N, bonuses, path[0], startMin)) return { ok: false, reason: 'start' };
  const g = new Game(N, steps, bonuses, batteries, combo);
  g.start(path[0]);
  for (let i = 1; i < path.length; i++) {
    let d = 0;
    while (d < 4 && N.nb[path[i - 1] * 4 + d] !== path[i]) d++;
    if (d === 4) return { ok: false, reason: 'edge', at: i };
    if (!g.move(d)) return { ok: false, reason: 'length', at: i };
  }
  return { ok: true, score: g.score, mult: g.mult, bonuses: g.taken.size, batteries: g.charged.size, quests: questsDone(N, g, quests) };
}

/**
 * Distance bonus: in sparse areas each step is longer, so the walked distance rewards leaving the cities.
 * Factor = 1 + min(km, cap) / per, rounded to 0.01 (×1.5 at most with cap 150, per 300). Final score = round(score × factor).
 * Deterministic from the trace: the server recomputes it like the rest of the score.
 */
export function traceKm(N, path) {
  let m = 0; for (let i = 1; i < path.length; i++) m += Math.hypot(N.x[path[i]] - N.x[path[i - 1]], N.y[path[i]] - N.y[path[i - 1]]);
  return m / 1000;
}
export function distanceFactor(N, path, { per = 300, cap = 150 } = {}) {
  return Math.round((1 + Math.min(traceKm(N, path), cap) / per) * 100) / 100;
}

/**
 * Album: facts found by a trace. `facts` = facts.json f rows [id, x, y, r, cat, fr, en, src, dp]: a fact is found
 * when a visited node is within r metres of it, or, when r is 0, when the trace enters its département (index dp).
 * The départements crossed are added as 'd' + index (they light up the album map).
 */
export function factsFound(N, facts, path) {
  const out = [], dps = new Set(path.map(a => N.dp[a]));
  for (const [id, x, y, r, , , , , dp] of facts)
    if (r ? path.some(a => (N.x[a] - x) ** 2 + (N.y[a] - y) ** 2 <= r * r) : dps.has(dp)) out.push(id);
  for (const d of dps) out.push('d' + d);
  return out;
}
