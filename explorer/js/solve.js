// PV Explorer — after a game: a route only a little better than the player's (≈ +20 %), branching off as late as
// possible, so that the lesson is close and reachable ("at step 18, going east, you made 12,400"). Beam search on
// the real rules (game.js), run in small slices so that the page stays responsive.
import { Game, questsDone, finalScore, distanceFactor } from './game.js?v=20261123a';

/**
 * path: the player's trace. Returns { at, path, final } — the trace equals the player's up to path[at], then turns
 * another way at step at + 1 — or { best, final } with the best route found when none reaches `gain` × the player's
 * score (best: null when nothing beats it), or null if cancelled (signal.stop).
 */
export async function betterRoute(N, cfg, bonuses, batteries, quests, path, { gain = 1.2, width = 250, signal = {} } = {}) {
  const G = cfg.game, fin = g => finalScore(g.score, distanceFactor(N, g.path, G.distance), questsDone(N, g, quests), G.quests?.bonus ?? 1);
  const g0 = new Game(N, G.steps, bonuses, batteries, G.combo); g0.start(path[0]);
  const states = [g0.clone()];
  for (let i = 1; i < path.length; i++) { const d = [0, 1, 2, 3].find(e => N.nb[path[i - 1] * 4 + e] === path[i]); g0.move(d); states.push(g0.clone()); }
  const mine = fin(g0), target = Math.ceil(mine * gain);
  let best = null;
  for (let at = path.length - 2; at >= 0; at--) {   // latest branching first
    await new Promise(r => setTimeout(r));
    if (signal.stop) return null;
    const done = [];
    let front = [];
    for (let d = 0; d < 4; d++) {   // the first move must leave the player's route
      const b = states[at].target(d); if (b < 0 || b === path[at + 1]) continue;
      const h = states[at].clone(); if (h.move(d)) front.push(h);
    }
    while (front.length) {
      const next = [];
      for (const g of front) {
        if (g.left <= 0) { done.push(g); continue; }
        let moved = false;
        for (let d = 0; d < 4; d++) { if (g.target(d) < 0) continue; const h = g.clone(); if (h.move(d)) { next.push(h); moved = true; } }
        if (!moved) done.push(g);
      }
      const seen = new Set(), v = g => g.score + g.combo * 40 + g.left * 60;
      front = next.sort((p, q) => v(q) - v(p)).filter(g => { const k = g.node * 1e7 + g.score; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, width);
    }
    let pick = null, pf = Infinity;
    for (const g of done) { const f = fin(g); if (f > mine && (!best || f > best.final)) best = { path: g.path, final: f, at }; if (f >= target && f < pf) { pf = f; pick = g; } }
    if (pick) return { at, path: pick.path, final: pf, mine };
  }
  return { best, mine };
}
