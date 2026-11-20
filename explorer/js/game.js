// PV Explorer — game rules. Pure module (no DOM): used by the page, by the simulator (Node) and, later, by the
// server-side score check (Supabase Edge Function, Deno). Everything is integer arithmetic so that the three agree.
//
// Rules
// - A trace starts on a node and makes up to `steps` moves; a move goes to the nearest node N / S / E / W (±45°).
// - Each node counts once per trace: its power (kWc, capped offline) times the current multiplier.
// - Daily bonuses (drawn from the Paris date, same for everyone): reaching a bonus node adds (m − 1) to the
//   multiplier (×5 then ×3 gives ×7), and the bonus node itself already counts with the new multiplier.

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
    w: Int32Array.from(j.w), nb: Int32Array.from(j.nb), dp: j.dp ? Uint8Array.from(j.dp) : null };
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
    const v = { node: b.node, mult: b.mult, taken: taken.has(b.node), state: 'hidden' };
    if (v.taken || path.some(p => (N.x[p] - N.x[b.node]) ** 2 + (N.y[p] - N.y[b.node]) ** 2 <= sense * sense)) { v.state = 'seen'; return v; }
    const dx = N.x[b.node] - N.x[a], dy = N.y[b.node] - N.y[a], d = Math.hypot(dx, dy);
    if (d <= compass) { v.state = 'near'; v.dir8 = ((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) % 8) + 8) % 8; v.heat = d < 10000 ? 3 : d < 20000 ? 2 : 1; }
    return v;
  });
}

/** Daily bonuses: weighted draw without replacement (integer weights), at least `minSpacing` metres apart.
 *  Returns [{node, mult}], same result everywhere for the same (day, salt, nodes). */
export function dailyBonuses(N, bonusCfg, day) {
  const { count, mults, minSpacing, salt } = bonusCfg;
  const r = prng(hash32(`${salt}:${day}`));
  const cum = new Float64Array(N.count);
  let tot = 0;
  for (let i = 0; i < N.count; i++) { tot += N.w[i]; cum[i] = tot; }
  const out = [], min2 = minSpacing * minSpacing;
  for (let tries = 0; out.length < count && tries < 10000; tries++) {
    const t = Math.floor((r() / 4294967296) * tot);       // exact: tot < 2^31, r() < 2^32
    let lo = 0, hi = N.count - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] > t) hi = m; else lo = m + 1; }
    const a = lo;
    if (out.some(b => (N.x[b.node] - N.x[a]) ** 2 + (N.y[b.node] - N.y[a]) ** 2 < min2)) continue;
    out.push({ node: a, mult: mults[r() % mults.length] });
  }
  return out;
}

export class Game {
  constructor(N, steps, bonuses) {
    this.N = N; this.steps = steps;
    this.bonus = new Map(bonuses.map(b => [b.node, b.mult]));
  }
  start(a) {
    this.path = [a]; this.seen = new Set(); this.taken = new Set();
    this.mult = 1; this.score = 0; this.left = this.steps;
    return this.#enter(a);
  }
  #enter(a) {
    let bonus = 0, gain = 0;
    if (this.bonus.has(a) && !this.taken.has(a)) { bonus = this.bonus.get(a); this.taken.add(a); this.mult += bonus - 1; }
    if (!this.seen.has(a)) { this.seen.add(a); gain = this.N.k[a] * this.mult; this.score += gain; }
    return { node: a, gain, bonus, mult: this.mult, score: this.score, left: this.left };
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
    return { node: b, gain: this.seen.has(b) ? 0 : this.N.k[b] * m, mult: m };
  }
}

/**
 * Random start: a node drawn from a seed string, with at least 3 directions (no dead end). Online, pvx-submit draws
 * it with a random seed for each game and signs it; offline, the page draws it. Uniform over nodes: since nodes
 * follow the density of panels, starts land more often where panels are many (lots of power, short steps) than in
 * the countryside (long steps, suns).
 */
export function startNode(N, seed) {
  const r = prng(hash32(String(seed)));
  for (let i = 0; i < 10000; i++) {
    const a = r() % N.count; let k = 0;
    for (let d = 0; d < 4; d++) if (N.nb[a * 4 + d] >= 0) k++;
    if (k >= 3) return a;
  }
  return 0;
}

/** Optional rule: no start within `startMin` metres of a bonus. Off in the current config (startMin 0: start anywhere). */
export function canStart(N, bonuses, a, startMin) {
  return bonuses.every(b => (N.x[b.node] - N.x[a]) ** 2 + (N.y[b.node] - N.y[a]) ** 2 >= startMin * startMin);
}

/** Server-side check: replays a path of node ids. Returns {ok, score, reason}. */
export function scoreTrace(N, steps, bonuses, path, startMin = 0) {
  if (!Array.isArray(path) || path.length < 1 || path.length > steps + 1) return { ok: false, reason: 'length' };
  if (path.some(a => !Number.isInteger(a) || a < 0 || a >= N.count)) return { ok: false, reason: 'node' };
  if (!canStart(N, bonuses, path[0], startMin)) return { ok: false, reason: 'start' };
  const g = new Game(N, steps, bonuses);
  g.start(path[0]);
  for (let i = 1; i < path.length; i++) {
    let d = 0;
    while (d < 4 && N.nb[path[i - 1] * 4 + d] !== path[i]) d++;
    if (d === 4) return { ok: false, reason: 'edge', at: i };
    g.move(d);
  }
  return { ok: true, score: g.score, mult: g.mult, bonuses: g.taken.size };
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
