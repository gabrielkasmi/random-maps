// PV Explorer — page logic (direction B, "Lever de soleil"). Rules live in game.js.
import { prepareNodes, dailyBonuses, Game, parisDay, sunView, distanceFactor, traceKm } from './game.js';
import * as BE from './backend.js';

/* ================================================================ i18n */
const T = {
  fr: {
    loading: 'Chargement…', back: '← Random Maps', about: 'À propos', lede: 'Quelle puissance installée arriverez-vous à récolter avant le lever du jour ?',
    r1: '<b>Choisissez un départ</b> : les zones qui brillent ont le plus de puissance.',
    r2: '<b>30 pas</b> N, S, E ou O : chaque panneau atteint rapporte sa puissance. Des soleils ×2 et ×3, cachés là où il y a peu de panneaux, multiplient tout ce qui suit.',
    r3: '<b>À la fin</b>, votre score compte les soleils récoltés et la distance parcourue : chaque kilomètre ajoute un bonus, jusqu’à ×1,5.',
    pseudoLabel: 'Votre pseudo', pseudoPh: 'Votre pseudo', suggest: 'Suggérer un pseudo', play: 'Jouer',
    pseudoBad: 'Entre 2 et 24 caractères.', local: 'Votre pseudo apparaîtra dans le classement du jour.', pseudoTaken: 'Ce pseudo est déjà pris.', pseudoRefused: 'Ce pseudo n’est pas accepté. Essayez-en un autre.', offline: 'Hors ligne : votre partie sera envoyée plus tard.',
    pickT: 'Choisissez votre départ', pickS: 'Touchez la carte. Les zones qui brillent ont beaucoup de panneaux, mais explorer les coins moins connus rapporte : c’est là que se cachent les soleils, et les pas y sont plus longs, donc la distance parcourue compte davantage.',
    pickNone: 'Aucun panneau par ici : touchez plus près d’une zone qui brille.',
    startHere: 'Partir d’ici', change: 'Choisir ailleurs', pickAgain: 'Touchez un autre endroit de la carte.',
    node: k => `${k} kWc`,
    startInfo: 'Votre départ', choose: 'Plus une direction est orangée, plus il reste de puissance de ce côté (sur 8 km).',
    practice: 'Partie d’entraînement sur un jour passé : non classée.', newDay: 'Le jour a changé : nouveaux soleils !',
    spotted: m => `Soleil ×${m} repéré !`, lucky: m => `Départ sur un soleil ×${m} : quelle chance !`, swipeTip: 'Touchez N, S, E ou O sur la carte (ou glissez un doigt) pour avancer ; deux doigts déplacent la carte.', gis: 'gisement',
    gainTxt: g => `+${g} kWc`, already: 'Déjà visité : rien de plus.', bonusTxt: (m, t) => `Soleil ×${m} ! Tout compte ×${t} désormais.`,
    steps: 'pas', stepsLeft: n => `${n} pas restant${n > 1 ? 's' : ''}`,
    dirs: ['N', 'S', 'E', 'O'], dirNames: ['nord', 'sud', 'est', 'ouest'], dirsGroup: 'Directions', rays: n => ['', ', un peu de puissance par là', ', de la puissance par là', ', beaucoup de puissance par là'][n],
    noDir: 'Aucun panneau dans cette direction.',
    endT: 'Le jour s’est levé', endRecord: 'Record', endSub: (m, b, km) => `×${m} à l’arrivée · ${b} soleil${b > 1 ? 's' : ''} · ${km} km parcourus`,
    sCollected: 'récoltés', sExplore: 'distance', exploreNote: () => 'Bonus de distance : +1 % tous les 3 km, jusqu’à ×1,5 (150 km).',
    sPanels: 'panneaux', sInst: 'installations', sBestDay: 'record du jour',
    share: 'Partager', again: 'Rejouer', view: 'Classement', boardT: d => `Classement du ${d}`, you: 'vous',
    boardNote: 'Seule la première partie de chaque joueur compte. Les soleils changent à minuit (heure de Paris).', boardLocal: 'Hors ligne : seules les parties de ce navigateur apparaissent.', boardLoading: 'Chargement…',
    rankTxt: (r, n) => `${r}${r === 1 ? 'er' : 'e'} sur ${n} aujourd’hui.`, unranked: 'Partie hors classement : seule la première partie du jour compte.', sending: 'Envoi du score…', sendFail: r => `Score non enregistré (${r}).`, boardEmpty: 'Aucune partie terminée aujourd’hui.', result: 'Résultat',
    shareNote: 'Votre trace du jour, sur la carte du jeu.', shareGo: 'Partager l’image', download: 'Télécharger', copy: 'Copier le texte',
    copied: 'Texte et lien copiés.', shareText: s => `J’ai récolté ${s} kWc en 30 pas sur PV Explorer ☀️ Et vous ?`,
    cardSub: 'kWc en 30 pas', cardAsk: 'Et vous, combien sur votre route ?', cardSrc: 'OpenPVMapper · détections par IA',
    menuT: 'Menu', restart: 'Nouvelle partie', changePseudo: 'Changer de pseudo', close: 'Fermer', recenter: 'Recentrer', menu: 'Menu',
    aboutT: 'À propos',
    aboutHtml: `<p>Récoltez le plus de puissance solaire en 30 pas. Chaque pas mène au panneau le plus proche dans la direction choisie ; chaque panneau compte une fois. Les soleils du jour sont les mêmes pour tout le monde et changent à minuit (heure de Paris).</p>
      <p>Les lumières de la nuit montrent où la puissance installée est concentrée (floutée à une dizaine de kilomètres). Pendant la partie, les ⚡ au bord de l’écran pointent vers les deux plus gros gisements proches, et la couleur des boutons indique la puissance qui reste à récolter dans chaque direction, sur 8 km.</p>
      <p>Des soleils (×2, ×3) se cachent dans les zones où il y a le moins de panneaux, pour donner une raison d’y aller. Ils apparaissent quand votre trace passe à moins de 10 km. Les multiplicateurs s’additionnent (×2 puis ×3 donnent ×4).</p>
      <p>Score final = puissance récoltée × bonus de distance : 1 + km parcourus / 300, jusqu’à ×1,5 (150 km). Là où il y a peu de panneaux, chaque pas va plus loin : la distance rééquilibre entre villes et campagnes.</p>
      <p>Les installations sont des détections par IA (OpenPVMapper / DeepPVMapper), pas un recensement officiel. Chaque panneau du jeu regroupe les installations voisines ; sa puissance est plafonnée à 1 MWc pour que les grandes centrales ne décident pas de tout.</p>
      <p class="fine">Le classement garde votre pseudo et vos traces (identifiants des panneaux visités), sans compte ni adresse e-mail. Seule la première partie du jour est classée ; les suivantes servent d’entraînement.</p>
      <p class="fine">Données : OpenPVMapper — DeepPVMapper, Gabriel Kasmi (CC BY 4.0). Fond : Plan IGN © IGN. Polices : Unbounded, Manrope (SIL OFL).</p>`,
    adj: ['Téméraire', 'Radieux', 'Curieux', 'Vagabond', 'Lumineux', 'Intrépide', 'Matinal', 'Rayonnant', 'Nomade', 'Vif'],
    noun: ['Onduleur', 'Photon', 'Panneau', 'Rayon', 'Silicium', 'Watt', 'Zénith', 'Albédo', 'Hangar', 'Toit'],
    pseudoOrder: (n, a) => `${n} ${a}`, date: d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  },
  en: {
    loading: 'Loading…', back: '← Random Maps', about: 'About', lede: 'How much installed power can you collect before daybreak?',
    r1: '<b>Pick a start</b>: the glowing areas hold the most power.',
    r2: '<b>30 steps</b> N, S, E or W: every panel you reach adds its power. ×2 and ×3 suns, hidden where panels are scarce, multiply everything that follows.',
    r3: '<b>At the end</b>, your score counts the suns you collected and the distance you walked: every kilometre adds a bonus, up to ×1.5.',
    pseudoLabel: 'Your nickname', pseudoPh: 'Your nickname', suggest: 'Suggest a nickname', play: 'Play',
    pseudoBad: '2 to 24 characters.', local: 'Your nickname will appear in today’s leaderboard.', pseudoTaken: 'This nickname is taken.', pseudoRefused: 'This nickname is not accepted. Try another one.', offline: 'Offline: your game will be sent later.',
    pickT: 'Pick your start', pickS: 'Tap the map. Glowing areas have many panels, but exploring lesser-known places pays off: that is where the suns hide, and steps are longer there, so the distance walked counts more.',
    pickNone: 'No panel around here: tap closer to a glowing area.',
    startHere: 'Start here', change: 'Pick elsewhere', pickAgain: 'Tap another place on the map.',
    node: k => `${k} kWp`,
    startInfo: 'Your start', choose: 'The more orange a direction, the more power is left that way (over 8 km).',
    practice: 'Practice game on a past day: not ranked.', newDay: 'A new day: new suns!',
    spotted: m => `Sun ×${m} spotted!`, lucky: m => `You start on a ×${m} sun: lucky you!`, swipeTip: 'Tap N, S, E or W on the map (or swipe one finger) to move; two fingers move the map.', gis: 'hotspot',
    gainTxt: g => `+${g} kWp`, already: 'Already visited: nothing more.', bonusTxt: (m, t) => `Sun ×${m}! Everything counts ×${t} from now on.`,
    steps: 'steps', stepsLeft: n => `${n} step${n > 1 ? 's' : ''} left`,
    dirs: ['N', 'S', 'E', 'W'], dirNames: ['north', 'south', 'east', 'west'], dirsGroup: 'Directions', rays: n => ['', ', some power that way', ', power that way', ', lots of power that way'][n],
    noDir: 'No panel in that direction.',
    endT: 'The day has risen', endRecord: 'Record', endSub: (m, b, km) => `×${m} at the end · ${b} sun${b > 1 ? 's' : ''} · ${km} km walked`,
    sCollected: 'collected', sExplore: 'distance', exploreNote: () => 'Distance bonus: +1 % every 3 km, up to ×1.5 (150 km).',
    sPanels: 'panels', sInst: 'installations', sBestDay: 'best today',
    share: 'Share', again: 'Play again', view: 'Leaderboard', boardT: d => `Leaderboard, ${d}`, you: 'you',
    boardNote: 'Only each player’s first game counts. Suns change at midnight (Paris time).', boardLocal: 'Offline: only this browser’s games are listed.', boardLoading: 'Loading…',
    rankTxt: (r, n) => `${r}${[, 'st', 'nd', 'rd'][r % 100 > 10 && r % 100 < 14 ? 0 : r % 10] || 'th'} of ${n} today.`, unranked: 'Unranked game: only your first game of the day counts.', sending: 'Sending your score…', sendFail: r => `Score not saved (${r}).`, boardEmpty: 'No game finished today.', result: 'Result',
    shareNote: 'Your trace of the day, on the game map.', shareGo: 'Share the image', download: 'Download', copy: 'Copy the text',
    copied: 'Text and link copied.', shareText: s => `I collected ${s} kWp in 30 steps on PV Explorer ☀️ Can you beat it?`,
    cardSub: 'kWp in 30 steps', cardAsk: 'How much is on your way?', cardSrc: 'OpenPVMapper · AI detections',
    menuT: 'Menu', restart: 'New game', changePseudo: 'Change nickname', close: 'Close', recenter: 'Recentre', menu: 'Menu',
    aboutT: 'About',
    aboutHtml: `<p>Collect as much solar power as you can in 30 steps. Each step goes to the nearest panel in the chosen direction; each panel counts once. Today’s suns are the same for everyone and change at midnight (Paris time).</p>
      <p>The night lights show where installed power is concentrated (blurred over about ten kilometres). While playing, the ⚡ on the screen edge point to the two biggest hotspots nearby, and the colour of the buttons shows the power left to collect in each direction, over 8 km.</p>
      <p>Suns (×2, ×3) hide where panels are scarcest, to give a reason to go there. They appear when your trace comes within 10 km. Multipliers add up (×2 then ×3 make ×4).</p>
      <p>Final score = power collected × distance bonus: 1 + km walked / 300, up to ×1.5 (150 km). Where panels are scarce each step goes farther: distance rebalances cities and countryside.</p>
      <p>The installations are AI detections (OpenPVMapper / DeepPVMapper), not an official census. Each panel of the game groups nearby installations; its power is capped at 1 MWp so that large solar farms do not decide everything.</p>
      <p class="fine">The leaderboard keeps your nickname and your traces (ids of the panels visited), with no account or email address. Only your first game of the day is ranked; the next ones are practice.</p>
      <p class="fine">Data: OpenPVMapper — DeepPVMapper, Gabriel Kasmi (CC BY 4.0). Basemap: Plan IGN © IGN. Fonts: Unbounded, Manrope (SIL OFL).</p>`,
    adj: ['Bold', 'Radiant', 'Curious', 'Roaming', 'Bright', 'Fearless', 'Early', 'Beaming', 'Nomad', 'Swift'],
    noun: ['Inverter', 'Photon', 'Panel', 'Ray', 'Silicon', 'Watt', 'Zenith', 'Albedo', 'Barn', 'Rooftop'],
    pseudoOrder: (n, a) => `${a} ${n}`, date: d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  },
};
const qs = new URLSearchParams(location.search);
const LANG = qs.get('lang') === 'en' ? 'en' : 'fr';
const t = T[LANG];
document.documentElement.lang = LANG;
for (const el of document.querySelectorAll('[data-t]')) { const v = t[el.dataset.t]; if (typeof v === 'string') el.textContent = v; }
for (const el of document.querySelectorAll('[data-t-html]')) el.innerHTML = t[el.dataset.tHtml];
for (const el of document.querySelectorAll('[data-t-aria]')) el.setAttribute('aria-label', t[el.dataset.tAria]);
for (const el of document.querySelectorAll('[data-t-ph]')) el.placeholder = t[el.dataset.tPh];
for (const a of document.querySelectorAll('.lang a')) a.setAttribute('aria-current', a.dataset.l === LANG);
document.getElementById('aboutBody').innerHTML = t.aboutHtml;
document.getElementById('unit').textContent = LANG === 'fr' ? 'kWc' : 'kWp';
const $ = id => document.getElementById(id);
const NF = new Intl.NumberFormat(LANG === 'fr' ? 'fr-FR' : 'en-GB');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================ storage (this browser only) */
const KEY = 'pvx.v1';
const store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
store.best = store.best || {};
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private mode: play anyway */ } }

/* ================================================================ data */
const L93 = '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const PJ = proj4('EPSG:4326', L93);
// ?day=YYYY-MM-DD replays a PAST day (practice, never sent). Future days are refused: they would show tomorrow's
// suns before tomorrow's ranked game.
const TODAY = parisDay();
const DAY = /^\d{4}-\d{2}-\d{2}$/.test(qs.get('day') || '') && qs.get('day') < TODAY ? qs.get('day') : TODAY;
const PRACTICE = DAY !== TODAY;
const REVEAL_M = 2500;
let CFG, N, LL, BON, BK, LIGHTS, GIS, VIEW = [], TGT = [], RAYS = [0, 0, 0, 0];
const bkey = (i, j) => i * 100000 + j;

async function load() {
  const [cfg, nodes, gis] = await Promise.all(['config', 'nodes', 'gisements'].map(f => fetch(`data/${f}.json`).then(r => r.json())));
  GIS = gis;
  CFG = cfg; N = prepareNodes(nodes);
  LL = new Float64Array(N.count * 2);
  BK = new Map();
  for (let a = 0; a < N.count; a++) {
    const [lo, la] = PJ.inverse([N.x[a], N.y[a]]); LL[2 * a] = lo; LL[2 * a + 1] = la;
    const k = bkey(Math.floor(N.x[a] / 5000), Math.floor(N.y[a] / 5000)); let b = BK.get(k); if (!b) BK.set(k, b = []); b.push(a);
  }
  BON = dailyBonuses(N, CFG.game.bonus, DAY);
  LIGHTS = new Image(); LIGHTS.src = 'data/lights.png';
  await LIGHTS.decode().catch(() => {});
}
const ll = a => [LL[2 * a], LL[2 * a + 1]];
function within(x, y, r, fn) {
  const s = Math.ceil(r / 5000), ci = Math.floor(x / 5000), cj = Math.floor(y / 5000);
  for (let i = -s; i <= s; i++) for (let j = -s; j <= s; j++) for (const b of BK.get(bkey(ci + i, cj + j)) || [])
    if ((N.x[b] - x) ** 2 + (N.y[b] - y) ** 2 <= r * r) fn(b);
}
function nearestNode(x, y) {
  for (const r of [3000, 10000, 30000]) { let best = -1, bd = Infinity; within(x, y, r, b => { const d = (N.x[b] - x) ** 2 + (N.y[b] - y) ** 2; if (d < bd) { bd = d; best = b; } }); if (best >= 0) return best; }
  return -1;
}

/* ================================================================ map + night canvas */
let map, cv, ctx, W = 0, H = 0, DPR = 1;
let mode = 'intro', g = null, cand = -1, anim = null, shown = 0;
const open = new Set();   // nodes uncovered by the trace (drawn as dots)

function initMap() {
  map = new maplibregl.Map({ container: 'map', style: 'data/style.json', bounds: [[-5.2, 41.3], [9.6, 51.1]], fitBoundsOptions: { padding: 20 },
    attributionControl: false, dragRotate: false, pitchWithRotate: false, maxZoom: 14, minZoom: 4.5, maxBounds: [[-12, 38], [17, 54]] });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Plan IGN © IGN · OpenPVMapper (CC BY 4.0)' }), 'bottom-left');
  cv = $('fx'); ctx = cv.getContext('2d');
  map.on('render', draw);
  map.on('click', e => {
    if (mode === 'pick') return pickAt(e.lngLat);
    if (mode !== 'play') return;
    const h = TGT.find(q => Math.hypot(q.x - e.point.x, q.y - e.point.y) <= q.r + 12);   // tap a N / S / E / W marker
    if (h) step(h.d);
  });
  swipeSetup();
  addEventListener('resize', size); size();
}
function size() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; draw(); }
const P = a => map.project(ll(a));
const mpx = () => 40075016.686 * Math.cos(map.getCenter().lat * Math.PI / 180) / (512 * 2 ** map.getZoom());
let raf = 0;
function kick() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); if (anim || mode === 'pick' || mode === 'play' || mode === 'intro') kick(); }); }

function trailPts(step) {
  if (!g) return [];
  const path = g.path.map(P); if (anim) path[path.length - 1] = anim.pos;
  const out = [];
  for (let i = 0; i < path.length; i++) {
    if (i) { const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(step, 2)); for (let s = 1; s < n; s++) out.push([a.x + (b.x - a.x) * s / n, a.y + (b.y - a.y) * s / n]); }
    out.push([path[i].x, path[i].y]);
  }
  return out;
}
function sun(x, y, m, alpha = 1, r = 14) {
  const tt = REDUCED ? 0 : performance.now() / 700;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + tt / 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3)); ctx.lineTo(Math.cos(a) * (r + 8 + Math.sin(tt) * 1.5), Math.sin(a) * (r + 8 + Math.sin(tt) * 1.5)); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = '#ffcf3f'; ctx.fill();
  ctx.fillStyle = '#0e1631'; ctx.font = `900 ${Math.round(r * .8)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×' + m, 0, 1);
  ctx.restore();
}
// the explorer: a little walker carrying a solar panel; hops on each step, looks where it goes
const FACE = [[0, -1], [0, 1], [1, 0], [-1, 0]];
let facing = 2;
function avatar(x, y, hop) {
  const [fx, fy] = FACE[facing];
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y + 1, 9 - hop * .25, 3.2 - hop * .08, 0, 0, 7); ctx.fillStyle = 'rgba(14,22,49,.45)'; ctx.fill();
  ctx.translate(x, y - 12 - hop);
  ctx.save(); ctx.rotate(-.28 + fx * .12);                                           // panel on the head
  ctx.fillStyle = '#18234a'; ctx.strokeStyle = '#ffb22e'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(-11, -18, 22, 8, 1.5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,178,46,.7)'; ctx.lineWidth = 1; ctx.beginPath();
  for (const u of [-5.5, 0, 5.5]) { ctx.moveTo(u, -18); ctx.lineTo(u, -10); } ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 7); ctx.fillStyle = '#fff4dc'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#0e1631'; ctx.stroke();
  ctx.fillStyle = '#0e1631';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(fx * 3 + sx * (fy ? 3.2 : 2.4) + (fx ? sx * .4 : 0), fy * 2.5 - 1 + (fx ? 0 : 0), 1.7, 0, 7); ctx.fill(); }
  ctx.restore();
}
function edgePoint(dx, dy, top, bot) {   // where a direction from the screen centre meets the play area's edge
  const cx = W / 2, cy = (top + H - bot) / 2;
  const s = Math.min((W / 2 - 34) / Math.abs(dx || 1e-6), ((H - top - bot) / 2 - 22) / Math.abs(dy || 1e-6));
  return [cx + dx * s, cy + dy * s];
}
function bolt(x, y, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fillStyle = 'rgba(14,22,49,.9)'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffcf6b'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.5, -7); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-1.5, 7); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fillStyle = '#ffcf6b'; ctx.fill();
  ctx.restore();
}
function label(x, y, s) { ctx.font = '700 10px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(14,22,49,.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = '#fff4dc'; ctx.fillText(s, x, y); }
// the two richest hotspots around, discounted by what the trace already collected there
function gisements() {
  const a = g.node, R = GIS.r, out = [];
  for (const [x, y, v] of GIS.g) {
    const d = Math.hypot(x - N.x[a], y - N.y[a]); if (d > 80000) continue;
    let left = v; for (const b of g.seen) if ((N.x[b] - x) ** 2 + (N.y[b] - y) ** 2 <= R * R) left -= N.k[b];
    out.push({ x, y, d, sc: left * Math.exp(-d / 25000) });
  }
  return out.sort((p, q) => q.sc - p.sc).slice(0, 2);
}

function draw() {
  if (!map || !W || !BON) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  const r = REVEAL_M / mpx();
  // night
  ctx.fillStyle = 'rgba(14,22,49,.86)'; ctx.fillRect(0, 0, W, H);
  // night lights (power density), fading out when zoomed in
  if (LIGHTS && LIGHTS.complete) {
    const b = CFG.lights.bounds, nw = map.project([b[0], b[3]]), se = map.project([b[2], b[1]]), z = map.getZoom();
    ctx.globalAlpha = Math.max(.12, Math.min(1, 1 - (z - 6) * .18));   // a guide from afar, a hint up close
    ctx.drawImage(LIGHTS, nw.x, nw.y, se.x - nw.x, se.y - nw.y); ctx.globalAlpha = 1;
  }
  const pts = trailPts(r / 3);
  if (pts.length) {
    for (const [x, y] of pts) { const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 1.7); gr.addColorStop(0, 'rgba(255,159,28,.32)'); gr.addColorStop(1, 'rgba(255,159,28,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r * 1.7, y - r * 1.7, r * 3.4, r * 3.4); }
    ctx.globalCompositeOperation = 'destination-out';
    for (const [x, y] of pts) { const gr = ctx.createRadialGradient(x, y, r * .55, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // uncovered panels
  if (g) for (const a of open) {
    const p = P(a); if (p.x < -6 || p.y < -6 || p.x > W + 6 || p.y > H + 6) continue;
    const rr = 1.6 + Math.min(3.2, Math.sqrt(N.k[a]) / 9);
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7);
    if (g.seen.has(a)) { ctx.fillStyle = '#ffcf6b'; ctx.fill(); } else { ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  // trace
  if (g) {
    const path = g.path.map(P); if (anim) path[path.length - 1] = anim.pos;
    const line = () => { ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); };
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.save(); ctx.shadowColor = '#ff8a00'; ctx.shadowBlur = 12; line(); ctx.strokeStyle = '#ffb22e'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
    const head = path[path.length - 1];
    TGT = [];
    if (mode === 'play' && !anim && g.left > 0) for (let d = 0; d < 4; d++) {
      const b = g.target(d); if (b < 0) continue; let p = P(b);
      const R = COARSE ? 17 : 10, m = R + 8;            // on touch screens these markers are the buttons: keep them on screen
      if (COARSE) {   // keep the four touch targets apart: at least 58 px from the walker, in their true direction
        let vx = p.x - head.x, vy = p.y - head.y, L = Math.hypot(vx, vy);
        if (L < 1) { [vx, vy] = FACE[d]; L = 1; }
        if (L < 58) p = { x: head.x + vx / L * 58, y: head.y + vy / L * 58 };
      }
      p = { x: Math.min(W - m, Math.max(m, p.x)), y: Math.min(H - m - 20, Math.max(150 + m, p.y)) };
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,207,107,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
      const seen = g.seen.has(b), lit = RAYS[d] || 0;   // warmer = more power left that way
      if (lit) { const gl = ctx.createRadialGradient(p.x, p.y, R * .8, p.x, p.y, R * (1.6 + lit * .35)); gl.addColorStop(0, `rgba(255,159,28,${.18 * lit})`); gl.addColorStop(1, 'rgba(255,159,28,0)'); ctx.fillStyle = gl; ctx.fillRect(p.x - R * 3, p.y - R * 3, R * 6, R * 6); }
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7);
      ctx.fillStyle = ['rgba(14,22,49,.92)', '#5a3f1c', '#b86f12', '#ffb22e'][lit]; ctx.fill();
      ctx.strokeStyle = seen ? 'rgba(255,207,107,.4)' : '#ffcf6b'; ctx.lineWidth = 1.5; if (seen) ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = lit === 3 ? '#0e1631' : seen ? 'rgba(255,207,107,.55)' : '#fff4dc'; ctx.font = `800 ${COARSE ? 14 : 11}px Unbounded, Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.dirs[d], p.x, p.y + 1);
      TGT.push({ d, x: p.x, y: p.y, r: R });
    }
    const hop = anim ? Math.sin(Math.PI * anim.f) * 16 : REDUCED ? 0 : (1 + Math.sin(performance.now() / 320)) * 1.2;
    avatar(head.x, head.y, hop);
  }
  // candidate start
  if (mode === 'pick' && cand >= 0) {
    const p = P(cand), s = REDUCED ? 0 : (performance.now() / 900) % 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10 + s * 18, 0, 7); ctx.strokeStyle = `rgba(255,207,107,${1 - s})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fillStyle = '#ffb22e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff4dc'; ctx.stroke();
  }
  if (!g || mode === 'pick') return;
  const top = 150, bot = mode === 'play' ? 200 : 300, inside = p => p.x > 16 && p.y > top && p.x < W - 16 && p.y < H - bot;
  // hotspots (⚡): a soft circle on screen, a pin on the edge otherwise
  if (mode === 'play') for (const h of gisements()) {
    const [lo, la] = PJ.inverse([h.x, h.y]), p = map.project([lo, la]);
    if (inside(p)) {
      ctx.setLineDash([2, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,207,107,.55)';
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(24, GIS.r / mpx()), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      bolt(p.x, p.y, .9); label(p.x, p.y + 26, t.gis);
    } else {
      const [x, y] = edgePoint(p.x - W / 2, p.y - (top + H - bot) / 2, top, bot);
      bolt(x, y); label(x, y + 26, Math.round(h.d / 1000) + ' km');
    }
  }
  // suns: only once seen (within 10 km of the trace), pinned to the edge when off screen
  for (const v of VIEW) {
    if (v.state === 'seen') {
      const p = P(v.node);
      if (inside(p)) { sun(p.x, p.y, v.mult, v.taken ? .35 : 1, 14); continue; }
      if (v.taken || mode !== 'play') continue;
      const [x, y] = edgePoint(p.x - W / 2, p.y - (top + H - bot) / 2, top, bot);
      sun(x, y, v.mult, .95, 11); label(x, y + 31, Math.round(Math.hypot(N.x[v.node] - N.x[g.node], N.y[v.node] - N.y[g.node]) / 1000) + ' km');
    }
  }
}

/* ================================================================ screens */
function setMode(m) {
  mode = m; touchMode(m === 'play');
  document.body.classList.toggle('playing', m === 'play' || m === 'end');
  $('intro').hidden = m !== 'intro';
  $('pickHud').hidden = $('pickBot').hidden = m !== 'pick';
  $('playHud').hidden = $('playBot').hidden = $('sideBtns').hidden = !(m === 'play' || m === 'end');
  $('end').hidden = m !== 'end';
  $('playBot').hidden = m !== 'play';
  kick();
}
function suggestPseudo() {
  const r = a => a[Math.floor(Math.random() * a.length)];
  return t.pseudoOrder(r(t.noun), r(t.adj));
}
function showIntro() {
  $('pseudoIn').value = store.pseudo || suggestPseudo();
  setMode('intro');
}
$('dice').onclick = () => { $('pseudoIn').value = suggestPseudo(); $('pseudoErr').textContent = ''; };
$('pseudoForm').onsubmit = async e => {
  e.preventDefault();
  const v = $('pseudoIn').value.trim().replace(/\s+/g, ' ');
  if (v.length < 2 || v.length > 24) { $('pseudoErr').textContent = t.pseudoBad; return; }
  const btn = e.submitter || $('pseudoForm').querySelector('button[type=submit]');
  if (btn) btn.disabled = true;
  const r = await BE.claimPseudo(v);
  if (btn) btn.disabled = false;
  if (!r.ok && r.reason === 'taken') { $('pseudoErr').textContent = t.pseudoTaken; return; }
  if (!r.ok && r.reason === 'invalid') { $('pseudoErr').textContent = t.pseudoRefused; return; }   // length is checked above: 'invalid' = refused by the filter
  if (!r.ok) console.warn('pseudo not saved online', r.error);   // offline: play anyway, sent later
  store.pseudo = v; store.pseudoOnline = r.ok; save(); startPick();
};

function startPick() {
  g = null; cand = -1; open.clear(); if (!PRACTICE) store.game = null; save();
  $('pickInfo').innerHTML = '';
  $('pickBot').hidden = true;
  setMode('pick'); $('pickBot').hidden = true;
  if (map.getZoom() > 7) map.flyTo({ zoom: 5.4, center: [2.6, 46.6], duration: REDUCED ? 0 : 900 });
}
function pickAt(lngLat) {
  const [x, y] = PJ.forward([lngLat.lng, lngLat.lat]);
  const a = nearestNode(x, y);
  if (a < 0) { toast(t.pickNone); return; }
  cand = a;
  $('pickBot').hidden = false;
  $('pickInfo').innerHTML = `<b>${t.startInfo}</b>${t.node(NF.format(N.k[a]))}<div class="act"><button class="cta" id="goBtn" type="button">${t.startHere}</button><button class="ghost" id="elseBtn" type="button">${t.change}</button></div>`;
  $('goBtn').onclick = () => begin(cand);
  $('elseBtn').onclick = () => { cand = -1; $('pickBot').hidden = true; toast(t.pickAgain); map.flyTo({ zoom: Math.min(map.getZoom(), 6.5), duration: REDUCED ? 0 : 800 }); kick(); };
  if (map.getZoom() < 9) map.flyTo({ center: ll(a), zoom: 9.5, duration: REDUCED ? 0 : 1100 });
  kick();
}

function begin(a, replay = []) {
  g = new Game(N, CFG.game.steps, BON);
  g.start(a);
  for (let i = 1; i < replay.length; i++) { const d = [0, 1, 2, 3].find(e => N.nb[replay[i - 1] * 4 + e] === replay[i]); if (d === undefined || !g.move(d)) break; }
  open.clear(); g.path.forEach(uncover); VIEW = [];
  if (g.path.length > 1) { const p = g.path, i = p.length - 1, f = [0, 1, 2, 3].find(e => N.nb[p[i - 1] * 4 + e] === p[i]); if (f !== undefined) facing = f; }
  if (!PRACTICE) store.game = { day: DAY, path: g.path }; save();
  shown = g.score; $('score').textContent = NF.format(shown);
  $('who').textContent = '☀ ' + (store.pseudo || '');
  setMode('play'); hud();
  if (replay.length <= 1 && g.taken.size) toast(t.lucky(g.mult));
  map.flyTo({ center: ll(g.node), zoom: Math.max(map.getZoom(), 10.5), duration: REDUCED ? 0 : 1000 });
  if (g.left <= 0) finish(true);
}
function uncover(a) { within(N.x[a], N.y[a], REVEAL_M + 400, b => open.add(b)); }

/* ---------------- hints: power left to collect within 8 km, per sector ---------------- */
function rays(d) {
  const a = g.node, R = CFG.game.hint.radius; let sum = 0;
  within(N.x[a], N.y[a], R, b => {
    if (b === a || g.seen.has(b)) return;
    const dx = N.x[b] - N.x[a], dy = N.y[b] - N.y[a];
    const s = (dy >= Math.abs(dx) && dy > 0) ? 0 : (-dy >= Math.abs(dx) && dy < 0) ? 1 : dx > 0 ? 2 : 3;
    if (s === d) sum += N.k[b];
  });
  const q = CFG.game.hint.rays; return sum >= q[2] ? 3 : sum >= q[1] ? 2 : sum >= q[0] ? 1 : 0;
}
function hud(last) {
  const before = new Set(VIEW.filter(v => v.state === 'seen').map(v => v.node));
  VIEW = sunView(N, g.path, g.taken, BON, CFG.game.bonus);
  if (last) for (const v of VIEW) if (v.state === 'seen' && !v.taken && !before.has(v.node)) toast(t.spotted(v.mult));
  if (last && last.bonus) toast(t.bonusTxt(last.bonus, g.mult));
  if (!last && COARSE && !store.swipeTip) { store.swipeTip = 1; save(); setTimeout(() => toast(t.swipeTip), g.taken.size && g.path.length === 1 ? 3200 : 1200); }
  $('steps').textContent = t.stepsLeft(g.left);
  $('left').textContent = g.left;
  const m = $('mult'); m.textContent = '×' + g.mult; m.classList.toggle('x1', g.mult === 1);
  if (last && last.bonus) { m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); }
  const a = g.node;
  $('info').innerHTML = `<b>${t.node(NF.format(N.k[a]))}</b>` +
    (last ? (last.bonus ? t.bonusTxt(last.bonus, g.mult) : last.gain ? t.gainTxt(NF.format(last.gain)) : t.already) : t.choose);
  for (const b of document.querySelectorAll('.pad button')) {
    const d = +b.dataset.d, ok = g.left > 0 && !anim && g.target(d) >= 0, n = ok ? rays(d) : 0;
    RAYS[d] = n;
    b.disabled = !ok;
    b.classList.toggle('seen', ok && g.seen.has(g.target(d)));   // next panel already collected
    b.dataset.r = n;
    b.innerHTML = `${t.dirs[d]}<i class="rays r${n}" aria-hidden="true"><b></b><b></b><b></b></i>`;
    b.setAttribute('aria-label', t.dirNames[d] + t.rays(n));
  }
  countUp();
}
function countUp() {
  const from = shown, to = g.score, t0 = performance.now();
  if (REDUCED || from === to) { shown = to; $('score').textContent = NF.format(to); return; }
  const tick = now => { const f = Math.min(1, (now - t0) / 600); shown = Math.round(from + (to - from) * (1 - (1 - f) ** 3)); $('score').textContent = NF.format(shown); if (f < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function step(d) {
  if (mode !== 'play' || anim || !g || g.left <= 0) return;
  if (g.target(d) < 0) { toast(t.noDir); return; }
  const a = g.node, b = g.target(d), pa = P(a), pb = P(b), t0 = performance.now();
  const dur = REDUCED ? 0 : Math.min(650, 260 + Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.2);
  const res = g.move(d);
  facing = d; anim = { pos: pa, f: 0 }; hud(); // buttons disabled during the jump
  const run = now => {
    const f = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - (1 - f) ** 3;
    anim.pos = { x: pa.x + (pb.x - pa.x) * e, y: pa.y + (pb.y - pa.y) * e }; anim.f = f;
    if (f < 1) { draw(); return requestAnimationFrame(run); }
    anim = null; uncover(b);
    if (!PRACTICE) store.game = { day: DAY, path: g.path }; save();
    hud(res); flash(res);
    const p = P(b);
    if (p.x < 60 || p.x > W - 60 || p.y < 190 || p.y > H - 240) map.easeTo({ center: ll(b), duration: REDUCED ? 0 : 450 });
    draw();
    if (g.left <= 0) setTimeout(() => finish(), REDUCED ? 0 : 700);
  };
  requestAnimationFrame(run);
}
function flash(res) {
  const el = $('gain');
  el.textContent = res.bonus ? `☀ ×${res.bonus}` : res.gain ? `+${NF.format(res.gain)}` : '+0';
  el.classList.toggle('bonus', !!res.bonus);
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(flash.t); flash.t = setTimeout(() => el.classList.remove('on'), 900);
}
for (const b of document.querySelectorAll('.pad button')) b.addEventListener('click', () => step(+b.dataset.d));
const KEYS = { ArrowUp: 0, ArrowDown: 1, ArrowRight: 2, ArrowLeft: 3, w: 0, z: 0, s: 1, d: 2, a: 3, q: 3 };
addEventListener('keydown', e => {
  if (mode !== 'play' || e.target.closest('input,dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
  const d = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (d !== undefined) { e.preventDefault(); step(d); }
});
// touch: a one-finger swipe = one step (screen up = north); two fingers move and zoom the map
const COARSE = matchMedia('(pointer: coarse)').matches;
let sw = null;
function swipeSetup() {
  const el = map.getCanvasContainer();
  el.addEventListener('touchstart', e => { sw = mode === 'play' && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() } : null; }, { passive: true });
  el.addEventListener('touchmove', e => { if (e.touches.length > 1) sw = null; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!sw || mode !== 'play') return;
    const c = e.changedTouches[0], dx = c.clientX - sw.x, dy = c.clientY - sw.y, ax = Math.abs(dx), ay = Math.abs(dy);
    const quick = performance.now() - sw.t < 900; sw = null;
    if (!quick || Math.max(ax, ay) < 28 || Math.max(ax, ay) < 1.4 * Math.min(ax, ay)) return;
    step(ax > ay ? (dx > 0 ? 2 : 3) : (dy < 0 ? 0 : 1));
  }, { passive: true });
}
function touchMode(play) { if (!COARSE || !map) return; play ? map.dragPan.disable() : map.dragPan.enable(); }
$('recenter').onclick = () => g && map.easeTo({ center: ll(g.node), zoom: Math.max(map.getZoom(), 10.5), duration: REDUCED ? 0 : 500 });

/* ---------------- end ---------------- */
function finish(silent) {
  const km = Math.round(traceKm(N, g.path));
  const ex = distanceFactor(N, g.path, CFG.game.distance), final = Math.round(g.score * ex);
  const prev = store.best[DAY]?.score || 0, rec = final > prev;
  if (rec) store.best[DAY] = { score: final, path: g.path };
  if (!store.bestAll || final > store.bestAll.score) store.bestAll = { score: final, day: DAY };
  const sc = ((store.scores || {})[DAY] || []).filter(r => r.path !== g.path.join(','));
  store.scores = { [DAY]: sc.concat([{ pseudo: store.pseudo, score: final, mult: g.mult, ex, path: g.path.join(',') }]) };
  if (!PRACTICE) store.game = { day: DAY, path: g.path, done: true }; save();
  g.final = final; g.explore = ex;
  const U = LANG === 'fr' ? 'kWc' : 'kWp', XF = v => '×' + v.toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 2 });
  $('endT').innerHTML = t.endT + (rec && prev ? ` <span class="record">${t.endRecord}</span>` : '');
  $('endScore').textContent = `${NF.format(final)} ${U}`;
  $('endSub').textContent = t.endSub(g.mult, g.taken.size, NF.format(km));
  $('endStats').innerHTML = `<div><b>${NF.format(g.score)}</b>${U} ${t.sCollected}</div><div><b>${XF(ex)}</b>${t.sExplore}</div><div><b>${NF.format(Math.max(prev, final))}</b>${t.sBestDay}</div>`;
  $('endNote').textContent = t.exploreNote(NF.format(km)); $('endRank').textContent = '';
  setMode('end');
  if (!PRACTICE) { queue(DAY, g.path); sendPending(g.path); } else $('endRank').textContent = t.practice;
  if (!silent) fitTrace();
}
function fitTrace() {
  const b = g.path.reduce((bb, a) => bb.extend(ll(a)), new maplibregl.LngLatBounds(ll(g.path[0]), ll(g.path[0])));
  map.fitBounds(b, { padding: { top: 170, bottom: Math.min(H * .5, 360), left: 40, right: 40 }, maxZoom: 12, duration: REDUCED ? 0 : 1000 });
}
$('againBtn').onclick = () => { if (dayChanged()) reloadDay(); else startPick(); };
const dayChanged = () => !PRACTICE && parisDay() !== DAY;
function reloadDay() { const q = new URLSearchParams(location.search); q.delete('day'); try { sessionStorage.setItem('pvx.newDay', '1'); } catch {} location.search = q.toString(); }
function checkDay() { if (dayChanged() && (mode === 'intro' || mode === 'pick')) reloadDay(); }
setInterval(checkDay, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
// leaderboard of the day: Supabase (pvx_leaderboard), this browser's games when offline
$('viewBtn').onclick = async () => {
  $('boardT').textContent = t.boardT(t.date(DAY));
  $('boardList').innerHTML = `<li class="empty">${t.boardLoading}</li>`; $('boardNote').textContent = t.boardNote;
  $('board').showModal();
  try {
    const rows = await BE.leaderboard(DAY);
    $('boardList').innerHTML = rows.length ? rows.map((r, i) => `${i && r.rank > rows[i - 1].rank + 1 ? '<li class="gap">…</li>' : ''}<li${r.me ? ' class="me"' : ''}><span class="rk">${r.rank}</span><span class="who">${esc(r.pseudo)}${r.me ? ` <em>(${t.you})</em>` : ''}</span><span class="pts">${NF.format(r.final)}</span></li>`).join('') : `<li class="empty">${t.boardEmpty}</li>`;
  } catch (err) { console.warn('leaderboard offline', err); localBoard(); }
};
function localBoard() {
  const rows = [...((store.scores || {})[DAY] || [])].sort((p, q) => q.score - p.score).slice(0, 50), mine = g && g.path.join(',');
  $('boardT').textContent = t.boardT(t.date(DAY));
  $('boardList').innerHTML = rows.length ? rows.map((r, i) => `<li${r.path === mine ? ' class="me"' : ''}><span class="rk">${i + 1}</span><span class="who">${esc(r.pseudo)}${r.path === mine ? ` <em>(${t.you})</em>` : ''}</span><span class="pts">${NF.format(r.score)}</span></li>`).join('') : `<li class="empty">${t.boardEmpty}</li>`;
  $('boardNote').textContent = t.boardLocal;
}
// online scores: finished traces wait in store.pending until pvx-submit accepted (or refused) them
const sendable = day => day === parisDay() || day === parisDay(new Date(Date.now() - 2 * 3600e3));   // same 2 h grace as the server
function queue(day, path) {
  const k = path.join(',');
  store.pending = (store.pending || []).filter(p => sendable(p.day) && p.path.join(',') !== k).concat([{ day, path: [...path] }]); save();
}
let sending = false;
async function sendPending(cur) {
  store.pending = (store.pending || []).filter(p => sendable(p.day));
  if (sending || !store.pending.length) return;
  sending = true;
  const ck = cur && cur.join(',');
  try {
    for (const p of [...store.pending]) {
      const isCur = p.path.join(',') === ck;
      if (isCur) $('endRank').textContent = t.sending;
      let r = await BE.submit(p.day, p.path, CFG.data);
      if (!r.ok && r.reason === 'pseudo' && store.pseudo) {        // pseudo chosen offline or before the backend existed
        const c = await BE.claimPseudo(store.pseudo);
        r = c.ok ? await BE.submit(p.day, p.path, CFG.data) : { ok: false, reason: c.reason === 'taken' ? 'taken' : 'network' };
      }
      const retry = !r.ok && ['network', 'taken', 'race', 'db'].includes(r.reason);
      if (!retry) { store.pending = store.pending.filter(q => q !== p); save(); }
      if (!r.ok) console.warn('score not saved', r);
      if (isCur) $('endRank').textContent = r.ok ? (r.ranked ? t.rankTxt(r.rank, r.players) : t.unranked)
        : r.reason === 'network' ? t.offline : r.reason === 'taken' ? t.pseudoTaken : t.sendFail(r.reason);
    }
  } finally { sending = false; }
}
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- share (story card: the trace on the game map) ---------------- */
let shareBlob = null;
const nextRender = () => new Promise(res => { map.once('render', res); map.triggerRepaint(); });
// frame the trace in the middle of the screen, then copy the map + night canvases (same frame) into a 960×1040 picture
async function snapshot(w, h) {
  const b = g.path.reduce((bb, a) => bb.extend(ll(a)), new maplibregl.LngLatBounds(ll(g.path[0]), ll(g.path[0])));
  const bw = Math.min(W - 40, (H - 40) * w / h), bh = bw * h / w, ox = (W - bw) / 2, oy = (H - bh) / 2;
  map.fitBounds(b, { padding: { left: ox + bw * .1, right: ox + bw * .1, top: oy + bh * .1, bottom: oy + bh * .1 }, maxZoom: 12.5, duration: 0 });
  await new Promise(res => map.once('idle', res));
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  await new Promise(res => { map.once('render', () => {
    const o = out.getContext('2d'), mc = map.getCanvas(), k = mc.width / W;
    o.drawImage(mc, ox * k, oy * k, bw * k, bh * k, 0, 0, w, h);
    o.drawImage(cv, ox * DPR, oy * DPR, bw * DPR, bh * DPR, 0, 0, w, h);
    res();
  }); map.triggerRepaint(); });
  return out;
}
async function card() {
  await document.fonts.ready;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const x = c.getContext('2d'), Wc = c.width, Hc = c.height;
  x.fillStyle = '#0e1631'; x.fillRect(0, 0, Wc, Hc);
  x.textAlign = 'center'; x.fillStyle = '#ffcf6b'; x.font = '900 64px Unbounded'; x.fillText('PV Explorer', Wc / 2, 150);
  x.fillStyle = '#fff4dc'; x.globalAlpha = .8; x.font = '700 40px Manrope'; x.fillText(`${store.pseudo} · ${t.date(DAY)}`, Wc / 2, 215); x.globalAlpha = 1;
  try {
    const shot = await snapshot(960, 1040);
    x.save(); x.beginPath(); x.rect(60, 270, 960, 1040); x.clip(); x.drawImage(shot, 60, 270); x.restore();
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,178,46,.5)'; x.beginPath(); x.rect(60, 270, 960, 1040); x.stroke();
  } catch (e) { console.warn('map snapshot failed', e); }
  x.fillStyle = '#ffcf6b'; x.font = '900 150px Unbounded'; x.fillText(NF.format(g.final ?? g.score), Wc / 2, 1500);
  x.fillStyle = '#fff4dc'; x.font = '700 50px Unbounded'; x.fillText(t.cardSub, Wc / 2, 1580);
  x.globalAlpha = .8; x.font = '700 40px Manrope';
  x.fillText(`☀ ×${g.mult} · ${t.sExplore} ×${(g.explore ?? 1).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-GB')}`, Wc / 2, 1670);
  x.globalAlpha = .65; x.font = '600 36px Manrope'; x.fillText(t.cardAsk, Wc / 2, 1780); x.fillText(t.cardSrc, Wc / 2, 1835); x.globalAlpha = 1;
  return new Promise(res => c.toBlob(res, 'image/png'));
}
const shareUrl = () => location.origin + location.pathname;
$('shareBtn').onclick = async () => {
  $('share').hidden = false; $('shareMsg').textContent = '';
  $('shareImgBox').replaceChildren(); shareBlob = await card(); fitTrace();
  const box = $('shareImgBox'); box.replaceChildren();
  const img = new Image(); img.alt = t.shareNote; img.width = 1080; img.height = 1920; img.src = URL.createObjectURL(shareBlob); box.appendChild(img);
};
$('shareClose').onclick = () => { $('share').hidden = true; };
$('shareGo').onclick = async () => {
  const file = new File([shareBlob], 'pv-explorer.png', { type: 'image/png' }), text = t.shareText(NF.format(g.final ?? g.score));
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text, url: shareUrl() }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  download();
};
function download() { const a = document.createElement('a'); a.href = URL.createObjectURL(shareBlob); a.download = 'pv-explorer.png'; document.body.appendChild(a); a.click(); a.remove(); }
$('shareDl').onclick = download;
$('shareCopy').onclick = async () => { try { await navigator.clipboard.writeText(`${t.shareText(NF.format(g.final ?? g.score))} ${shareUrl()}`); $('shareMsg').textContent = t.copied; } catch { $('shareMsg').textContent = shareUrl(); } };

/* ---------------- menu, about, toast ---------------- */
$('menuBtn').onclick = () => $('menu').showModal();
$('mRestart').onclick = () => { $('menu').close(); if (dayChanged()) reloadDay(); else startPick(); };
$('mAbout').onclick = () => { $('menu').close(); $('about').showModal(); };
$('mPseudo').onclick = () => { $('menu').close(); showIntro(); };
$('aboutBtn').onclick = () => $('about').showModal();
let toastT;
function toast(s) { const el = $('toast'); el.textContent = s; el.style.pointerEvents = 'none'; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }

/* ================================================================ boot */
try {
  initMap();
  await load();
  $('loading').remove();
  try { if (sessionStorage.getItem('pvx.newDay')) { sessionStorage.removeItem('pvx.newDay'); setTimeout(() => toast(t.newDay), 800); } } catch {}
  BE.init().then(r => { if (r?.pseudo && r.pseudo !== store.pseudo) { store.pseudo = r.pseudo; save(); } sendPending(); })
    .catch(err => console.warn('backend unavailable, local mode', err.message));
  const sg = store.game;
  if (sg && sg.day === DAY && Array.isArray(sg.path) && sg.path.length && store.pseudo) {
    begin(sg.path[0], sg.path);
  } else showIntro();
} catch (err) {
  console.error(err);
  $('loading').textContent = (LANG === 'fr' ? 'Impossible de charger le jeu. ' : 'Could not load the game. ') + err.message;
}
// console / test hook
window.__pvx = { get g() { return g; }, get mode() { return mode; }, get N() { return N; }, get BON() { return BON; }, step, begin, pickAt, startPick, map: () => map, tgt: () => TGT };
