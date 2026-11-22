// PV Explorer — page logic (direction B, "Lever de soleil"). Rules live in game.js.
// Bump ?v= (imports below and the script tag in index.html) at each release: phones keep old scripts otherwise.
import { prepareNodes, dailyBonuses, dailyBatteries, dailyQuests, questState, finalScore, factsFound, Game, parisDay, sunView, distanceFactor, traceKm, startNode } from './game.js?v=20261122d';
import * as BE from './backend.js?v=20261122d';

/* ================================================================ i18n */
const T = {
  fr: {
    loading: 'Chargement…', back: '← Random Maps', about: 'À propos', lede: 'Une nuit, 30 pas, d’installation solaire en installation solaire : suivez les panneaux, enchaînez les combos, attrapez les soleils. Quelle puissance récolterez-vous avant le lever du jour ?',
    r1: '<b>Départ tiré au sort</b> quelque part en France, un nouveau à chaque partie, jamais trop pauvre ni trop riche. En ville, beaucoup de panneaux à petits pas ; à la campagne, de grands pas, des soleils et des batteries.',
    r2: '<b>30 pas</b> N, S, E ou O : chaque pas mène vers l’installation la plus puissante toute proche dans cette direction et rapporte sa puissance. Enchaîner les installations de 100 kWc et plus fait monter un <b>combo</b> (jusqu’à ×2) ; un soleil ×2 ou ×3 multiplie tout ce qui suit ; une batterie donne 3 pas de plus.',
    r3: '<b>Un seul but</b> : récolter le plus de puissance. Score = kWc récoltés × bonus (soleils, combo, quêtes du jour).',
    comboTxt: p => `combo +${p} %`, comboMax: 'Combo au maximum : ×2 tant que vous restez sur les panneaux !',
    questsT: 'Quêtes du jour', qLong: { km: n => `Parcourir ${n} km`, dept: n => `Traverser ${n} départements`, streak: n => `Faire ${n} pas d’affilée dans une même ville`, big: n => `Récolter ${n} installations de 1 MWc`, kwc: n => `Récolter ${n.toLocaleString('fr-FR')} kWc`, towns: n => `Passer par ${n} villes`, spref: n => n > 1 ? `Passer par ${n} sous-préfectures` : 'Passer par une sous-préfecture' },
    qShort: { km: n => `${n} km`, dept: n => `${n} dépts`, streak: n => `${n} pas en ville`, big: n => `${n} × 1 MWc`, kwc: n => `${n / 1000} MWc`, towns: n => `${n} villes`, spref: () => 'sous-préf.' },
    qDone: q => `Quête accomplie : ${q} ! +0,1 au score final`, sQuests: n => `quête${n > 1 ? 's' : ''}`,
    battSpotted: s => `Batterie repérée : +${s} pas !`, battTxt: s => `Batterie : +${s} pas !`,
    factNew: 'Nouveau fait', factAlbum: (n, t) => `Ajouté à votre album · ${n}/${t}`, newDept: d => `Nouveau département exploré : ${d}`,
    album: 'Mon album', albumT: 'Mon album', albumFacts: (n, t) => `${n} faits sur ${t}`, albumDepts: (n, t) => `${n} départements explorés sur ${t}`, albumHint: 'Les points pâles sont des faits encore à découvrir : passez à proximité pendant une partie (pour une naissance dans un village, il suffit de traverser son département).', albumEmpty: 'Aucun fait pour l’instant : partez explorer !', albumLocal: 'Hors ligne : seul l’album de ce navigateur est affiché.', cat: { pv: 'Photovoltaïque', sci: 'Sciences du Soleil', art: 'Arts et culture', nat: 'Nature', dpt: 'Département' }, srcT: 'Source',
    pseudoLabel: 'Votre pseudo', pseudoPh: 'Votre pseudo', suggest: 'Suggérer un pseudo', play: 'Jouer',
    pseudoBad: 'Entre 2 et 24 caractères.', local: 'Votre pseudo apparaîtra dans le classement du jour.', pseudoTaken: 'Ce pseudo est déjà pris.', pseudoRefused: 'Ce pseudo n’est pas accepté. Essayez-en un autre.', offline: 'Hors ligne : votre partie sera envoyée plus tard.',
    startAt: d => `Départ tiré au sort : ${d}`, startGain: k => `Point de départ : +${k} points.`,
    node: k => `${k} kWc`,
    choose: 'Plus une direction est orangée, plus on peut récolter de puissance en 3 pas de ce côté.',
    practice: 'Partie d’entraînement sur un jour passé : non classée.', newDay: 'Le jour a changé : nouveaux soleils !',
    spotted: m => `Soleil ×${m} repéré !`, lucky: m => `Départ sur un soleil ×${m} : quelle chance !`, 
    gainTxt: (g, k, x) => x ? `${k} kWc → +${g} points` : `+${g} points`, already: 'Déjà visité : rien de plus.', bonusTxt: (m, t) => `Soleil ×${m} ! Tout compte ×${t} désormais.`,
    steps: 'pas', stepsLeft: n => `${n} pas restant${n > 1 ? 's' : ''}`,
    dirs: ['N', 'S', 'E', 'O'], dirNames: ['nord', 'sud', 'est', 'ouest'], dirsGroup: 'Directions', rays: n => ['', ', un peu de puissance par là', ', de la puissance par là', ', beaucoup de puissance par là'][n],
    noDir: 'Aucun panneau dans cette direction.',
    endT: 'Le jour s’est levé', endRecord: 'Record', pts: 'points', endSub: (k, f, p) => `${k} kWc récoltés ${f} de bonus (soleils, combo, quêtes) = ${p} points`,
    sCollected: 'récoltés', sWalked: 'parcourus', sSuns: n => n ? `${n} soleil${n > 1 ? 's' : ''}` : 'aucun soleil', sExplore: 'distance',
    sPanels: 'panneaux', sInst: 'installations', sBestDay: 'record du jour',
    share: 'Partager', again: 'Rejouer', view: 'Classement', boardT: d => `Classement du ${d}`, you: 'vous',
    boardNote: 'Résultats réinitialisés tous les jours à minuit (heure de Paris).', boardLocal: 'Hors ligne : seules les parties de ce navigateur apparaissent.', boardLoading: 'Chargement…',
    rankTxt: (r, n) => `${r}${r === 1 ? 'er' : 'e'} sur ${n} aujourd’hui.`, newBest: 'Nouveau record personnel !', bestKept: b => `Votre meilleure partie du jour reste à ${b} points.`, sending: 'Envoi du score…', sendFail: r => `Score non enregistré (${r}).`, boardEmpty: 'Aucune partie terminée aujourd’hui.', boardSub: (k, km) => `${km} km`, startOff: 'Partie lancée hors ligne depuis un autre départ : non classée.', result: 'Résultat',
    shareGo: 'Partager l’image', download: 'Télécharger', copy: 'Copier le texte',
    copied: 'Texte et lien copiés.', shareText: (k, km, r) => `${r ? `Mon itinéraire PV Explorer : ${r}. ` : ''}J’ai récolté ${k} kWc et parcouru ${km} km ☀️ Les installations solaires de France, détectées par IA :`, around: a => `autour de ${a}`,
    cardSub: 'points en 30 pas', cardLine: (k, km) => `J’ai récolté ${k} kWc et parcouru ${km} km`, cardRoute: 'Mon itinéraire', cardAsk: 'Et vous, jusqu’où irez-vous ?', cardSrc: 'OpenPVMapper · détections par IA',
    menuT: 'Menu', credits: 'Sources et crédits de la carte', help: 'Comment jouer', restart: 'Nouvelle partie', changePseudo: 'Changer de pseudo', close: 'Fermer', recenter: 'Recentrer', menu: 'Menu',
    aboutT: 'À propos', shareGame: 'Partager le jeu', linkCopied: 'Lien copié', gameText: 'PV Explorer : 30 pas de nuit, d’installation solaire en installation solaire ☀️',
    aboutHtml: `<p>Votre départ est tiré au sort à chaque partie, parmi des départs ni trop pauvres ni trop riches : c’est votre façon de jouer qui fait la différence. En 30 pas, récoltez le plus de puissance solaire. Chaque pas mène, dans la direction choisie, vers l’installation la plus puissante parmi les plus proches ; chacune compte une fois. Enchaîner les installations de 100 kWc et plus fait monter un combo (+10 % dès le premier pas, puis +10 % par pas, jusqu’à ×2) ; un pas sur une petite installation ou une installation déjà visitée le remet à zéro. Les soleils du jour sont les mêmes pour tout le monde et changent à minuit (heure de Paris).</p>
      <p>Les lumières de la nuit montrent où la puissance installée est concentrée (floutée à une dizaine de kilomètres). Les ⚡ montrent les trois installations les plus puissantes à moins de 30 km que vous n’avez pas encore récoltées (au bord de l’écran quand elles sont hors champ), avec leur puissance et leur distance. La couleur des directions indique ce que vous pouvez récolter au mieux en 3 pas de ce côté.</p>
      <p>Chaque jour, trois quêtes communes à tous (aller loin, creuser sur place, passer par des lieux) ajoutent chacune +0,1 au bonus final. Des batteries, cachées surtout entre ville et campagne, donnent 3 pas de plus. En passant près de certains lieux (ou dans le département natal d’un savant), vous découvrez des faits sur le soleil et le solaire : ils remplissent votre album, avec la carte des départements explorés (menu ⋯, ou votre ligne du classement).</p>
      <p>Des soleils (×2, ×3) se cachent dans les zones où il y a le moins de panneaux, pour donner une raison d’y aller. Ils apparaissent quand votre trace passe à moins de 10 km. Les multiplicateurs s’additionnent (×2 puis ×3 donnent ×4).</p>
      <p>Score = kWc récoltés × bonus. Les kWc récoltés sont la vraie puissance installée des panneaux visités (chacun compte une fois). Le bonus réunit tout le reste : les soleils et le combo, qui multiplient les pas suivants, puis les quêtes (+0,1 chacune à la fin). En cours de partie, le grand compteur affiche les points, la ligne en dessous les kWc. En ville, on récolte beaucoup à petits pas ; à la campagne, chaque pas va plus loin et les soleils sont plus nombreux.</p>
      <p>Les installations sont des détections par IA (OpenPVMapper / DeepPVMapper), pas un recensement officiel. Chaque panneau du jeu regroupe les installations voisines ; sa puissance est plafonnée à 1 MWc pour que les grandes centrales ne décident pas de tout.</p>
      <p class="fine">Le classement garde votre pseudo et vos traces (identifiants des panneaux visités), sans compte ni adresse e-mail. Rejouez autant que vous voulez : votre meilleure partie du jour est classée.</p>
      <p class="fine">Données : OpenPVMapper — DeepPVMapper, Gabriel Kasmi (CC BY 4.0). Fond : Plan IGN © IGN. Communes et départements : INSEE, geo.api.gouv.fr, france-geojson (Licence ouverte). Polices : Unbounded, Manrope (SIL OFL).</p>`,
    tut: ['Sautez d’installation en installation : chaque pas récolte la puissance installée du panneau atteint. Un seul but : récolter le plus possible.',
      'Votre départ est tiré au sort à chaque partie, ni trop pauvre ni trop riche. En ville, beaucoup de puissance à petits pas ; à la campagne, de grands pas, des soleils et des batteries : la stratégie change selon où vous atterrissez.',
      'Glissez le doigt vers le haut, le bas, la gauche ou la droite pour avancer, ou touchez la manette en bas.',
      'Restez sur les panneaux : enchaîner les installations de 100 kWc et plus fait monter un combo jusqu’à ×2. Un soleil ×2 ou ×3 multiplie tout ce qui suit.',
      'Trois quêtes par jour : chacune ajoute +0,1 au bonus. Score = kWc récoltés × bonus (soleils, combo, quêtes). Des batteries pour 3 pas de plus, et des faits à découvrir en chemin pour remplir votre album.'],
    tutKeys: 'Flèches du clavier (ou la manette en bas) pour avancer d’un pas vers le N, le S, l’E ou l’O.',
    tutT: ['Le but', 'Votre départ', 'Avancer', 'Combo et soleils', 'Quêtes, batteries, album'], tutSkip: 'Passer', tutNext: 'Suivant', tutGo: 'C’est parti', tutCity: 'ville', tutCountry: 'campagne', tutKm: 'km',
    adj: ['Téméraire', 'Radieux', 'Curieux', 'Vagabond', 'Lumineux', 'Intrépide', 'Matinal', 'Rayonnant', 'Nomade', 'Vif'],
    noun: ['Onduleur', 'Photon', 'Panneau', 'Rayon', 'Silicium', 'Watt', 'Zénith', 'Albédo', 'Hangar', 'Toit'],
    pseudoOrder: (n, a) => `${n} ${a}`, date: d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  },
  en: {
    loading: 'Loading…', back: '← Random Maps', about: 'About', lede: 'One night, 30 steps, from solar installation to solar installation: follow the panels, chain combos, catch the suns. How much power will you collect before daybreak?',
    r1: '<b>Your start is drawn at random</b> somewhere in France, a new one for each game, never too poor nor too rich. In a city, lots of panels in small steps; in the countryside, long steps, suns and batteries.',
    r2: '<b>30 steps</b> N, S, E or W: each step goes to the most powerful installation close by in that direction and adds its power. Chaining installations of 100 kWp or more builds a <b>combo</b> (up to ×2); a ×2 or ×3 sun multiplies everything that follows; a battery gives 3 more steps.',
    r3: '<b>One goal</b>: collect as much power as you can. Score = kWp collected × bonus (suns, combo, daily quests).',
    comboTxt: p => `combo +${p}%`, comboMax: 'Combo maxed: ×2 as long as you stay on the panels!',
    questsT: 'Today’s quests', qLong: { km: n => `Walk ${n} km`, dept: n => `Cross ${n} départements`, streak: n => `Make ${n} steps in a row in the same town`, big: n => `Collect ${n} installations of 1 MWp`, kwc: n => `Collect ${n.toLocaleString('en-GB')} kWp`, towns: n => `Pass through ${n} towns`, spref: n => n > 1 ? `Pass through ${n} sous-préfectures` : 'Pass through a sous-préfecture' },
    qShort: { km: n => `${n} km`, dept: n => `${n} depts`, streak: n => `${n} in town`, big: n => `${n} × 1 MWp`, kwc: n => `${n / 1000} MWp`, towns: n => `${n} towns`, spref: () => 'sous-préf.' },
    qDone: q => `Quest done: ${q}! +0.1 on the final score`, sQuests: n => `quest${n > 1 ? 's' : ''}`,
    battSpotted: s => `Battery spotted: +${s} steps!`, battTxt: s => `Battery: +${s} steps!`,
    factNew: 'New fact', factAlbum: (n, t) => `Added to your album · ${n}/${t}`, newDept: d => `New département explored: ${d}`,
    album: 'My album', albumT: 'My album', albumFacts: (n, t) => `${n} facts of ${t}`, albumDepts: (n, t) => `${n} of ${t} départements explored`, albumHint: 'Pale dots are facts still to discover: come close to them during a game (for a birth in a village, crossing its département is enough).', albumEmpty: 'No fact yet: go and explore!', albumLocal: 'Offline: only this browser’s album is shown.', cat: { pv: 'Photovoltaics', sci: 'Science of the Sun', art: 'Arts and culture', nat: 'Nature', dpt: 'Département' }, srcT: 'Source',
    pseudoLabel: 'Your nickname', pseudoPh: 'Your nickname', suggest: 'Suggest a nickname', play: 'Play',
    pseudoBad: '2 to 24 characters.', local: 'Your nickname will appear in today’s leaderboard.', pseudoTaken: 'This nickname is taken.', pseudoRefused: 'This nickname is not accepted. Try another one.', offline: 'Offline: your game will be sent later.',
    startAt: d => `Start drawn at random: ${d}`, startGain: k => `Starting point: +${k} points.`,
    node: k => `${k} kWp`,
    choose: 'The more orange a direction, the more power you can collect in 3 steps that way.',
    practice: 'Practice game on a past day: not ranked.', newDay: 'A new day: new suns!',
    spotted: m => `Sun ×${m} spotted!`, lucky: m => `You start on a ×${m} sun: lucky you!`, 
    gainTxt: (g, k, x) => x ? `${k} kWp → +${g} points` : `+${g} points`, already: 'Already visited: nothing more.', bonusTxt: (m, t) => `Sun ×${m}! Everything counts ×${t} from now on.`,
    steps: 'steps', stepsLeft: n => `${n} step${n > 1 ? 's' : ''} left`,
    dirs: ['N', 'S', 'E', 'W'], dirNames: ['north', 'south', 'east', 'west'], dirsGroup: 'Directions', rays: n => ['', ', some power that way', ', power that way', ', lots of power that way'][n],
    noDir: 'No panel in that direction.',
    endT: 'The day has risen', endRecord: 'Record', pts: 'points', endSub: (k, f, p) => `${k} kWp collected ${f} bonus (suns, combo, quests) = ${p} points`,
    sCollected: 'collected', sWalked: 'walked', sSuns: n => n ? `${n} sun${n > 1 ? 's' : ''}` : 'no sun', sExplore: 'distance',
    sPanels: 'panels', sInst: 'installations', sBestDay: 'best today',
    share: 'Share', again: 'Play again', view: 'Leaderboard', boardT: d => `Leaderboard, ${d}`, you: 'you',
    boardNote: 'Results reset every day at midnight (Paris time).', boardLocal: 'Offline: only this browser’s games are listed.', boardLoading: 'Loading…',
    rankTxt: (r, n) => `${r}${[, 'st', 'nd', 'rd'][r % 100 > 10 && r % 100 < 14 ? 0 : r % 10] || 'th'} of ${n} today.`, newBest: 'New personal best!', bestKept: b => `Your best game today stays at ${b} points.`, sending: 'Sending your score…', sendFail: r => `Score not saved (${r}).`, boardEmpty: 'No game finished today.', boardSub: (k, km) => `${km} km`, startOff: 'Game started offline from another start: not ranked.', result: 'Result',
    shareGo: 'Share the image', download: 'Download', copy: 'Copy the text',
    copied: 'Text and link copied.', shareText: (k, km, r) => `${r ? `My PV Explorer route: ${r}. ` : ''}I collected ${k} kWp and walked ${km} km ☀️ France’s solar installations, detected by AI:`, around: a => `around ${a}`,
    cardSub: 'points in 30 steps', cardLine: (k, km) => `I collected ${k} kWp and walked ${km} km`, cardRoute: 'My route', cardAsk: 'How far will you go?', cardSrc: 'OpenPVMapper · AI detections',
    menuT: 'Menu', credits: 'Map sources and credits', help: 'How to play', restart: 'New game', changePseudo: 'Change nickname', close: 'Close', recenter: 'Recentre', menu: 'Menu',
    aboutT: 'About', shareGame: 'Share the game', linkCopied: 'Link copied', gameText: 'PV Explorer: 30 steps at night, from solar installation to solar installation ☀️',
    aboutHtml: `<p>Your start is drawn at random for each game, among starts neither too poor nor too rich: the way you play makes the difference. In 30 steps, collect as much solar power as you can. Each step goes, in the chosen direction, to the most powerful of the nearest installations; each counts once. Chaining installations of 100 kWp or more builds a combo (+10% from the first step, then +10% per step, up to ×2); a step onto a small or already visited installation resets it. Today’s suns are the same for everyone and change at midnight (Paris time).</p>
      <p>The night lights show where installed power is concentrated (blurred over about ten kilometres). The ⚡ show the three most powerful installations within 30 km that you have not collected yet (on the screen edge when off screen), with their power and distance. The colour of the directions shows the most you can collect in 3 steps that way.</p>
      <p>Every day, three quests shared by everyone (go far, dig in, pass through places) each add +0.1 to the final bonus. Batteries, hidden mostly between town and countryside, give 3 more steps. Passing close to some places (or through a scientist’s home département), you discover facts about the Sun and solar power: they fill your album, with the map of the départements explored (⋯ menu, or your row of the leaderboard).</p>
      <p>Suns (×2, ×3) hide where panels are scarcest, to give a reason to go there. They appear when your trace comes within 10 km. Multipliers add up (×2 then ×3 make ×4).</p>
      <p>Score = kWp collected × bonus. The kWp collected are the real installed power of the panels visited (each counts once). The bonus gathers the rest: suns and combo, which multiply the next steps, then quests (+0.1 each at the end). While playing, the big counter shows points, the line below the kWp. In a city you collect a lot in small steps; in the countryside every step goes farther and suns are more common.</p>
      <p>The installations are AI detections (OpenPVMapper / DeepPVMapper), not an official census. Each panel of the game groups nearby installations; its power is capped at 1 MWp so that large solar farms do not decide everything.</p>
      <p class="fine">The leaderboard keeps your nickname and your traces (ids of the panels visited), with no account or email address. Play as often as you like: your best game of the day is ranked.</p>
      <p class="fine">Data: OpenPVMapper — DeepPVMapper, Gabriel Kasmi (CC BY 4.0). Basemap: Plan IGN © IGN. Towns and départements: INSEE, geo.api.gouv.fr, france-geojson (Licence Ouverte). Fonts: Unbounded, Manrope (SIL OFL).</p>`,
    tut: ['Hop from installation to installation: each step collects the installed power of the panel you reach. One goal: collect as much as you can.',
      'Your start is drawn at random for each game, never too poor nor too rich. In a city, lots of power in small steps; in the countryside, long steps, suns and batteries: the strategy depends on where you land.',
      'Swipe up, down, left or right to move, or tap the controller at the bottom.',
      'Stay on the panels: chaining installations of 100 kWp or more builds a combo, up to ×2. A ×2 or ×3 sun multiplies everything that follows.',
      'Three quests a day: each adds +0.1 to the bonus. Score = kWp collected × bonus (suns, combo, quests). Batteries for 3 more steps, and facts to discover on the way to fill your album.'],
    tutKeys: 'Arrow keys (or the controller at the bottom) move one step N, S, E or W.',
    tutT: ['The goal', 'Your start', 'Moving', 'Combo and suns', 'Quests, batteries, album'], tutSkip: 'Skip', tutNext: 'Next', tutGo: 'Let’s go', tutCity: 'city', tutCountry: 'countryside', tutKm: 'km',
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
for (const el of document.querySelectorAll('[data-t-title]')) el.title = t[el.dataset.tTitle];
for (const a of document.querySelectorAll('.lang a')) a.setAttribute('aria-current', a.dataset.l === LANG);
document.getElementById('aboutBody').innerHTML = t.aboutHtml;
document.getElementById('unit').textContent = 'points';
const $ = id => document.getElementById(id);
const NF = new Intl.NumberFormat(LANG === 'fr' ? 'fr-FR' : 'en-GB');
const XF = v => '×' + v.toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
const VER = '20261122d';   // data cache-buster, bumped with the scripts
const TOP = 100;   // height of the floating counter: markers and pins stay below it
let CFG, N, LL, BON, BAT, QU, BK, LIGHTS, TOWNS, FACTS, VIEW = [], BVIEW = [], TGT = [], RAYS = [0, 0, 0, 0], TOPS = [];
const bkey = (i, j) => i * 100000 + j;

async function load() {
  const [cfg, nodes, towns, facts] = await Promise.all(['config', 'nodes', 'towns', 'facts'].map(f => fetch(`data/${f}.json?v=${VER}`).then(r => r.json())));
  TOWNS = towns.t.map(([name, x, y, pop, kind]) => { const [lo, la] = PJ.inverse([x, y]); return { name, pop, kind, ll: [lo, la] }; });
  FACTS = { rows: facts.f, f: facts.f.map(([id, x, y, r, cat, fr, en, src, dp]) => ({ id, x, y, r, cat, dp, txt: LANG === 'fr' ? fr : en, src, ll: PJ.inverse([x, y]) })) };
  CFG = cfg; N = prepareNodes(nodes);
  LL = new Float64Array(N.count * 2);
  BK = new Map();
  for (let a = 0; a < N.count; a++) {
    const [lo, la] = PJ.inverse([N.x[a], N.y[a]]); LL[2 * a] = lo; LL[2 * a + 1] = la;
    const k = bkey(Math.floor(N.x[a] / 5000), Math.floor(N.y[a] / 5000)); let b = BK.get(k); if (!b) BK.set(k, b = []); b.push(a);
  }
  BON = dailyBonuses(N, CFG.game.bonus, DAY);
  BAT = dailyBatteries(N, CFG.game.battery, DAY, BON);
  QU = dailyQuests(CFG.game.quests, DAY);
  LIGHTS = new Image(); LIGHTS.src = 'data/lights.png';
  await LIGHTS.decode().catch(() => {});
}
const ll = a => [LL[2 * a], LL[2 * a + 1]];
function within(x, y, r, fn) {
  const s = Math.ceil(r / 5000), ci = Math.floor(x / 5000), cj = Math.floor(y / 5000);
  for (let i = -s; i <= s; i++) for (let j = -s; j <= s; j++) for (const b of BK.get(bkey(ci + i, cj + j)) || [])
    if ((N.x[b] - x) ** 2 + (N.y[b] - y) ** 2 <= r * r) fn(b);
}

/* ================================================================ map + night canvas */
let map, cv, ctx, W = 0, H = 0, DPR = 1;
let mode = 'intro', g = null, anim = null, shown = 0;
const open = new Set();   // nodes uncovered by the trace (drawn as dots)

function initMap() {
  map = new maplibregl.Map({ container: 'map', style: 'data/style.json', bounds: [[-5.2, 41.3], [9.6, 51.1]], fitBoundsOptions: { padding: 20 },
    attributionControl: false, dragRotate: false, pitchWithRotate: false, maxZoom: 14, minZoom: 4.5, maxBounds: [[-12, 38], [17, 54]] });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');   // credits: the 'i' in index.html
  cv = $('fx'); ctx = cv.getContext('2d');
  map.on('render', draw);
  map.on('click', e => {
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
function kick() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); if (anim || mode === 'draw' || mode === 'play' || mode === 'intro') kick(); }); }

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
const AV = 1.7;   // walker scale: big enough to read its mood
function avatar(x, y, hop) {
  ctx.save(); ctx.translate(x, y); ctx.scale(AV, AV);
  walker(0, 0, hop / AV * 1.3);
  ctx.restore();
}
function walker(x, y, hop) {
  const [fx, fy] = FACE[facing], md = curMood(), age = (performance.now() - mood.t) / 1000;
  if (md === 'joy' && !anim && !REDUCED && age < 1.4) hop += Math.abs(Math.sin(age * Math.PI * 2.2)) * 9 * (1 - age / 1.4);   // jumps for joy
  ctx.save();
  if ((md === 'joy' || md === 'happy') && age < 3.2) {   // warm aura that fades
    const ga = (1 - age / 3.2) * (md === 'joy' ? .55 : .35), gr = ctx.createRadialGradient(x, y - 14 - hop, 4, x, y - 14 - hop, 30);
    gr.addColorStop(0, `rgba(255,207,63,${ga})`); gr.addColorStop(1, 'rgba(255,207,63,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 30, y - 44 - hop, 60, 60);
  }
  ctx.beginPath(); ctx.ellipse(x, y + 1, 9 - hop * .25, 3.2 - hop * .08, 0, 0, 7); ctx.fillStyle = 'rgba(14,22,49,.45)'; ctx.fill();
  ctx.translate(x, y - 12 - hop);
  ctx.save(); ctx.rotate(-.28 + fx * .12);                                           // panel on the head
  ctx.fillStyle = md === 'joy' && age < 2.5 ? '#ffb22e' : '#18234a'; ctx.strokeStyle = '#ffb22e'; ctx.lineWidth = 1.6;   // a sun lights the panel up
  ctx.beginPath(); ctx.roundRect(-11, -18, 22, 8, 1.5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,178,46,.7)'; ctx.lineWidth = 1; ctx.beginPath();
  for (const u of [-5.5, 0, 5.5]) { ctx.moveTo(u, -18); ctx.lineTo(u, -10); } ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 7); ctx.fillStyle = '#fff4dc'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#0e1631'; ctx.stroke();
  face(fx, fy, md);
  ctx.restore();
  if (!anim) moodSigns(x, y - 12 - hop, md);
}
/* mood of the walker, set by the last step (see moodOf): a face, plus a short-lived sign around the head */
let mood = { k: 'idle', t: 0 };
const BIG_K = 500, SMALL_K = 30, LONG_M = 6000;
function moodOf(res, m) {
  if (res.bonus || res.extra) return 'joy';          // a sun, a battery
  if (!res.gain) return 'bored';                     // nothing new here
  if (m >= LONG_M) return 'puff';                    // a long walk
  if (N.k[res.node] >= BIG_K) return 'happy';        // a big installation at once
  if (N.k[res.node] < SMALL_K) return 'meh';
  return 'idle';
}
function curMood() { return g && g.left > 0 && g.left <= 3 && (mood.k === 'idle' || mood.k === 'meh') ? 'panic' : mood.k; }
function face(fx, fy, md) {
  const ex = sx => fx * 3 + sx * (fy ? 3.2 : 2.4) + (fx ? sx * .4 : 0), ey = fy * 2.5 - 1, mx = fx * 3, my = ey + 4.2;
  ctx.fillStyle = ctx.strokeStyle = '#0e1631'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    if (md === 'happy' || md === 'joy') { ctx.arc(ex(sx), ey + 1, 1.9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }   // ^ ^
    else if (md === 'bored') { ctx.moveTo(ex(sx) - 1.8, ey + .4); ctx.lineTo(ex(sx) + 1.8, ey + .4); ctx.stroke(); }
    else { ctx.arc(ex(sx), ey, md === 'panic' ? 2.3 : 1.7, 0, 7); ctx.fill(); }
  }
  if (fy < 0) return;   // walking north: seen from behind, no mouth
  ctx.beginPath();
  if (md === 'joy') { ctx.arc(mx, my - .6, 2.8, 0, Math.PI); ctx.closePath(); ctx.fill(); }
  else if (md === 'happy') { ctx.arc(mx, my - 1.6, 2.8, Math.PI * .15, Math.PI * .85); ctx.stroke(); }
  else if (md === 'bored') { ctx.arc(mx, my + 1.6, 2.2, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
  else if (md === 'meh') { ctx.moveTo(mx - 2, my); ctx.lineTo(mx + 2, my); ctx.stroke(); }
  else if (md === 'panic' || md === 'puff') { ctx.arc(mx, my, 1.4, 0, 7); md === 'puff' ? ctx.fill() : ctx.stroke(); }
  else { ctx.arc(mx, my - 1.2, 2, Math.PI * .2, Math.PI * .8); ctx.stroke(); }
}
function sparkle(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }
// signs around the head (head centre at x, y): sparkles, sweat, "…", "!"; they fade after ~2.5 s, except panic
function moodSigns(x, y, md) {
  const now = performance.now(), age = (now - mood.t) / 1000, a = md === 'panic' ? 1 : Math.max(0, 1 - Math.max(0, age - 3) / .8);
  if (!a) return;
  const tw = REDUCED ? 1 : .75 + .25 * Math.sin(now / 140);
  ctx.save(); ctx.globalAlpha = a;
  if (md === 'happy' || md === 'joy') {
    ctx.fillStyle = md === 'joy' ? '#ffcf3f' : '#ffcf6b';
    const S = md === 'joy' ? [[-17, -8, 5], [16, -13, 6], [-12, -25, 4], [19, 4, 4], [2, -30, 3.5]] : [[-16, -10, 4.5], [15, -15, 5], [17, 2, 3]];
    for (const [u, v, r] of S) sparkle(x + u, y + v, r * tw);
  } else if (md === 'puff') {
    const dy = REDUCED ? 0 : (age * 6) % 6;
    ctx.fillStyle = '#9fd3ff'; ctx.strokeStyle = 'rgba(14,22,49,.8)'; ctx.lineWidth = .8;
    for (const [u, v, k] of [[13, -6, 1.3], [-14, -2, 1]]) { const X = x + u, Y = y + v + dy * k; ctx.beginPath(); ctx.moveTo(X, Y - 4 * k); ctx.quadraticCurveTo(X + 3.5 * k, Y + 2 * k, X, Y + 3 * k); ctx.quadraticCurveTo(X - 3.5 * k, Y + 2 * k, X, Y - 4 * k); ctx.fill(); ctx.stroke(); }
  } else if (md === 'bored' || md === 'panic') {
    const s = md === 'bored' ? '…' : '!', col = md === 'panic' ? '#ff6b3d' : '#c9c3b4';
    const px = x + 16, py = y - 17 + (md === 'panic' && !REDUCED ? Math.sin(now / 90) : 0);
    ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.moveTo(px - 6, py + 4); ctx.lineTo(px - 11, py + 10); ctx.lineTo(px - 2, py + 7);   // speech bubble
    ctx.fillStyle = 'rgba(14,22,49,.92)'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col; ctx.stroke();
    ctx.font = `900 ${md === 'panic' ? 11 : 10}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.fillText(s, px, py + (md === 'bored' ? -2 : .5));
  }
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
// the three most powerful installations within 30 km not collected yet (ties: the nearest); computed after each step
const TOP_R = 30000;
function bigTargets() {
  const a = g.node, out = [];
  within(N.x[a], N.y[a], TOP_R, b => { if (!g.seen.has(b)) out.push({ b, k: N.k[b], d: Math.hypot(N.x[b] - N.x[a], N.y[b] - N.y[a]) }); });
  return out.filter(o => o.d <= TOP_R).sort((p, q) => q.k - p.k || p.d - q.d).slice(0, 3);
}
const kmTxt = m => m < 950 ? (m / 1000).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 }) + ' km' : NF.format(Math.round(m / 1000)) + ' km';
function pointer(x, y, ang) {   // small triangle outside the ⚡ disc, pointing at the off-screen target
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(13, -5); ctx.lineTo(13, 5); ctx.closePath(); ctx.fillStyle = '#ffcf6b'; ctx.fill();
  ctx.restore();
}

// a battery (+n steps): green, so that it reads apart from the suns
function battery(x, y, n, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  const gl = ctx.createRadialGradient(0, 0, 6, 0, 0, 24); gl.addColorStop(0, 'rgba(126,224,161,.45)'); gl.addColorStop(1, 'rgba(126,224,161,0)'); ctx.fillStyle = gl; ctx.fillRect(-24, -24, 48, 48);
  ctx.fillStyle = '#0e1631'; ctx.strokeStyle = '#7ee0a1'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-14, -8, 26, 16, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7ee0a1'; ctx.fillRect(12, -3.5, 3.5, 7);
  ctx.font = '900 9px Unbounded, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+' + n, -1, 1);
  ctx.restore();
}
function book(x, y) {   // a fact of the album
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .9;
  ctx.fillStyle = 'rgba(14,22,49,.85)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 4.5); ctx.moveTo(0, -4); ctx.quadraticCurveTo(-3, -5.5, -5.5, -4); ctx.lineTo(-5.5, 4); ctx.quadraticCurveTo(-3, 3, 0, 4.5); ctx.quadraticCurveTo(3, 3, 5.5, 4); ctx.lineTo(5.5, -4); ctx.quadraticCurveTo(3, -5.5, 0, -4); ctx.stroke();
  ctx.restore();
}
// town names above the night: préfectures first, then the bigger towns as one zooms in
function townLabels() {
  const z = map.getZoom(); if (z < 6.5 || !TOWNS) return;
  const min = z < 7.5 ? Infinity : z < 8.5 ? 100000 : z < 9.5 ? 30000 : z < 10.5 ? 12000 : 0;
  ctx.font = '700 12px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
  const placed = [];
  for (const tw of TOWNS) {
    if (tw.pop < min && !(tw.kind === 2 && z >= 6.5) && !(tw.kind === 1 && z >= 8.5)) continue;
    const p = map.project(tw.ll); if (p.x < -40 || p.y < -20 || p.x > W + 40 || p.y > H + 20) continue;
    const w = ctx.measureText(tw.name).width / 2 + 6;
    if (placed.some(q => Math.abs(q.x - p.x) < w + q.w && Math.abs(q.y - p.y) < 16)) continue;
    placed.push({ x: p.x, y: p.y, w });
    ctx.globalAlpha = tw.kind === 2 ? .95 : .8;
    ctx.strokeStyle = 'rgba(14,22,49,.9)'; ctx.strokeText(tw.name, p.x, p.y); ctx.fillStyle = tw.kind === 2 ? '#fff4dc' : '#c9c3b4'; ctx.fillText(tw.name, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
function draw() {
  if (!map || !W || !BON) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  const r = REVEAL_M / mpx();
  // night
  ctx.fillStyle = 'rgba(14,22,49,.72)'; ctx.fillRect(0, 0, W, H);   // the IGN map shows through: roads, forests, rivers
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
  townLabels();
  // facts already in the album: a small book where they are
  if (g && mode === 'play') for (const f of FACTS.f) if (store.album[f.id]) { const p = map.project(f.ll); if (p.x > -20 && p.y > -20 && p.x < W + 20 && p.y < H + 20) book(p.x, p.y); }
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
      if (COARSE) {   // keep the four touch targets apart: at least 72 px from the walker, in their true direction
        let vx = p.x - head.x, vy = p.y - head.y, L = Math.hypot(vx, vy);
        if (L < 1) { [vx, vy] = FACE[d]; L = 1; }
        if (L < 72) p = { x: head.x + vx / L * 72, y: head.y + vy / L * 72 };
      }
      p = { x: Math.min(W - m, Math.max(m, p.x)), y: Math.min(H - m - (COARSE ? 170 : 20), Math.max(TOP + m, p.y)) };
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
  if (!g) return;
  const top = TOP, bot = mode === 'play' ? 200 : 300, inside = p => p.x > 16 && p.y > top && p.x < W - 16 && p.y < H - bot;
  // the 3 biggest installations (⚡): marked on screen, pinned to the edge with an arrow otherwise
  if (mode === 'play') {
    const pins = [];
    for (const o of TOPS) {
      const p = P(o.b), kw = t.node(NF.format(o.k)), km = kmTxt(o.d);
      if (inside(p)) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, 7); ctx.setLineDash([2, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,207,107,.7)'; ctx.stroke(); ctx.setLineDash([]);
        bolt(p.x, p.y, .95); label(p.x, p.y + 27, kw); continue;
      }
      let [x, y] = edgePoint(p.x - W / 2, p.y - (top + H - bot) / 2, top, bot);
      for (const q of pins) if (Math.hypot(q[0] - x, q[1] - y) < 40) y = y + 40 > H - bot ? y - 40 : y + 40;   // keep pins apart
      pins.push([x, y]);
      pointer(x, y, Math.atan2(p.y - y, p.x - x)); bolt(x, y); label(x, y + 25, kw); label(x, y + 37, km);
    }
  }
  // batteries: like the suns, once seen
  for (const v of BVIEW) {
    if (v.state !== 'seen') continue;
    const p = P(v.node);
    if (inside(p)) { battery(p.x, p.y, v.steps, v.taken ? .35 : 1); continue; }
    if (v.taken || mode !== 'play') continue;
    const [x, y] = edgePoint(p.x - W / 2, p.y - (top + H - bot) / 2, top, bot);
    battery(x, y, v.steps, .95); label(x, y + 24, Math.round(Math.hypot(N.x[v.node] - N.x[g.node], N.y[v.node] - N.y[g.node]) / 1000) + ' km');
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
  if (QU) questChips($('introQuests'), false);
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
  store.pseudo = v; store.pseudoOnline = r.ok; save(); newGame();
};


// The start is drawn, not chosen, anew for each game. Online, pvx-submit draws it and signs it (ticket); the ticket
// goes back with the finished trace so the server knows the start was not picked. Without a ticket (offline,
// practice day) the page draws the start itself and the game is not ranked.
const settle = (pr, ms) => Promise.race([pr, new Promise(res => setTimeout(() => res(null), ms))]);
let ticket = null;
async function drawStart() {
  const local = () => { ticket = null; return startNode(N, 'local:' + Math.random(), BON, CFG.game.startMin, CFG.game.startBand); };
  if (PRACTICE) return local();
  let r = await settle(BE.newStart(DAY), 6000);
  if (r && !r.ok && r.reason === 'pseudo' && store.pseudo) {   // pseudo chosen offline: register it, then ask again
    const c = await settle(BE.claimPseudo(store.pseudo), 6000);
    if (c?.ok) { store.pseudoOnline = true; r = await settle(BE.newStart(DAY), 6000); }
  }
  if (!r?.ok || !(r.node >= 0 && r.node < N.count)) return local();
  ticket = r.ticket; return r.node;
}
async function newGame() {
  g = null; open.clear(); if (!PRACTICE) store.game = null; save();
  setMode('draw');
  if (map.getZoom() > 7) map.flyTo({ zoom: 5.4, center: [2.6, 46.6], duration: REDUCED ? 0 : 900 });
  const [a] = await Promise.all([drawStart(), store.tuto ? null : new Promise(res => tutorial(res))]);
  begin(a, [], true);
}

function begin(a, replay = [], fresh = false) {
  g = new Game(N, CFG.game.steps, BON, BAT, CFG.game.combo);
  g.start(a);
  qDone = new Set(); factQ.length = 0;
  for (let i = 1; i < replay.length; i++) { const d = [0, 1, 2, 3].find(e => N.nb[replay[i - 1] * 4 + e] === replay[i]); if (d === undefined || !g.move(d)) break; }
  open.clear(); g.path.forEach(uncover); VIEW = []; BVIEW = [];
  QU.forEach((q, i) => { if (questState(N, g, q).done) qDone.add(i); });
  for (const f of factsOf(g.path)) seenFacts.add(f);   // a resumed game does not pop up its facts again
  mood = { k: g.taken.size ? 'joy' : 'idle', t: performance.now() };
  if (g.path.length > 1) { const p = g.path, i = p.length - 1, f = [0, 1, 2, 3].find(e => N.nb[p[i - 1] * 4 + e] === p[i]); if (f !== undefined) facing = f; }
  if (!PRACTICE) store.game = { day: DAY, path: g.path, ticket }; save();
  shown = g.score; $('score').textContent = NF.format(shown);
  setMode('play'); hud();
  const dep = CFG.depts[N.dp[a]];
  if (fresh) toast(t.startAt(dep ? dep[1] : ''));
  if (replay.length <= 1 && g.taken.size) setTimeout(() => toast(t.lucky(g.mult)), fresh ? 2800 : 0);
  if (fresh) setTimeout(() => g && discover(g.path[0]), 2400);   // facts around the start
  map.flyTo({ center: ll(g.node), zoom: Math.max(map.getZoom(), 10.5), duration: REDUCED ? 0 : fresh ? 2200 : 1000 });
  if (g.left <= 0) finish(true);
}
function uncover(a) { within(N.x[a], N.y[a], REVEAL_M + 400, b => open.add(b)); }

/* ---------------- hints: the most power one can collect in 3 steps starting that way (raw kWc: no hidden sun leaks) ---------------- */
function reach(d, depth = 3) {
  const b = g.target(d); if (b < 0) return 0;
  const used = new Set(), val = c => g.seen.has(c) || used.has(c) ? 0 : N.k[c];
  const go = (n, left) => {
    let best = 0; if (!left) return 0;
    for (let e = 0; e < 4; e++) { const c = N.nb[n * 4 + e]; if (c < 0) continue; const v = val(c); if (v) used.add(c); best = Math.max(best, v + go(c, left - 1)); if (v) used.delete(c); }
    return best;
  };
  const v0 = val(b); if (v0) used.add(b);
  return v0 + go(b, depth - 1);
}
function rays(d) {
  const sum = reach(d, CFG.game.hint.depth || 3), q = CFG.game.hint.rays;
  return sum >= q[2] ? 3 : sum >= q[1] ? 2 : sum >= q[0] ? 1 : 0;
}
function hud(last) {
  const before = new Set(VIEW.filter(v => v.state === 'seen').map(v => v.node));
  VIEW = sunView(N, g.path, g.taken, BON, CFG.game.bonus);
  TOPS = bigTargets();
  const bBefore = new Set(BVIEW.filter(v => v.state === 'seen').map(v => v.node));
  BVIEW = sunView(N, g.path, g.charged, BAT, CFG.game.battery);
  if (last) for (const v of VIEW) if (v.state === 'seen' && !v.taken && !before.has(v.node)) toast(t.spotted(v.mult));
  if (last) for (const v of BVIEW) if (v.state === 'seen' && !v.taken && !bBefore.has(v.node)) toast(t.battSpotted(v.steps));
  if (last && last.bonus) toast(t.bonusTxt(last.bonus, g.mult));
  if (last && last.extra) toast(t.battTxt(last.extra));
  quests(!!last);
  const L = g.left, col = stepColor(L), st = $('steps');
  $('stepsN').textContent = L;
  st.style.setProperty('--sc', col);
  st.classList.toggle('urgent', L > 0 && L <= 3); st.setAttribute('aria-label', t.stepsLeft(L));
  $('meta').innerHTML = `<b>${NF.format(realK())} ${LANG === 'fr' ? 'kWc' : 'kWp'}</b> · ${NF.format(Math.round(traceKm(N, g.path)))} km` +
    (g.combo ? ` <span class="combo${g.combo >= (CFG.game.combo?.max || 10) ? ' max' : ''}">${t.comboTxt(g.combo * 10)}</span>` : '');
  if (last && CFG.game.combo && g.combo === CFG.game.combo.max && last.combo !== undefined && !hud.maxed) { hud.maxed = true; toast(t.comboMax); }
  if (!g.combo) hud.maxed = false;
  const m = $('mult'); m.textContent = '×' + g.mult; m.classList.toggle('x1', g.mult === 1);
  if (last && last.bonus) { m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); }
  const a = g.node;
  $('info').innerHTML = `<b>${t.node(NF.format(N.k[a]))}</b>` +
    (last ? (last.bonus ? t.bonusTxt(last.bonus, g.mult) : last.gain ? t.gainTxt(NF.format(last.gain), NF.format(N.k[a]), last.gain !== N.k[a]) : t.already) : t.choose);
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
// steps left: daylight, then amber to red over the last 15 steps
function stepColor(L) { return L > 15 ? '' : `hsl(${Math.round(42 * Math.max(0, L - 1) / 14)} 100% ${L > 5 ? 64 : 60}%)`; }
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
    mood = { k: moodOf(res, Math.hypot(N.x[b] - N.x[a], N.y[b] - N.y[a])), t: performance.now() };
    if (!PRACTICE) store.game = { day: DAY, path: g.path, ticket }; save();
    hud(res); flash(res); discover(b);
    const p = P(b);
    if (p.x < 60 || p.x > W - 60 || p.y < TOP + 50 || p.y > H - 240) map.easeTo({ center: ll(b), duration: REDUCED ? 0 : 450 });
    draw();
    if (g.left <= 0) setTimeout(() => finish(), REDUCED ? 0 : 700);
  };
  requestAnimationFrame(run);
}
function flash(res) {
  const el = $('gain');
  el.textContent = res.bonus ? `☀ ×${res.bonus}` : res.extra ? `🔋 +${res.extra} ${t.steps}` : res.gain ? `+${NF.format(res.gain)}` : '+0';
  el.classList.toggle('bonus', !!(res.bonus || res.extra));
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(flash.t); flash.t = setTimeout(() => el.classList.remove('on'), 900);
}
for (const b of document.querySelectorAll('.pad button')) b.addEventListener('click', () => step(+b.dataset.d));
const KEYS = { ArrowUp: 0, ArrowDown: 1, ArrowRight: 2, ArrowLeft: 3, w: 0, z: 0, s: 1, d: 2, a: 3, q: 3 };
addEventListener('keydown', e => {
  if (mode !== 'play' || !$('tuto').hidden || e.target.closest('input,dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
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

/* ---------------- place, quests, facts, album ---------------- */
// where the walker is: the town of the node (data v3), else its département
const realK = () => g ? [...g.seen].reduce((s, a) => a === g.path[0] ? s : s + N.k[a], 0) : 0;   // the real installed power collected (the landing node does not count)
const placeOf = a => N.t[a] >= 0 ? TOWNS[N.t[a]].name : CFG.depts[N.dp[a]]?.[1] || '';
// quests of the day: chips under the score; a new one done pops a toast and makes the walker jump
let qDone = new Set();
function questChips(el, live) {
  el.innerHTML = QU.map(q => {
    const st = g ? questState(N, g, q) : { v: 0, n: q.n, done: false };
    const prog = q.type === 'km' || q.type === 'kwc' ? `${NF.format(Math.min(st.v, q.n))}/${NF.format(q.n)}` : `${Math.min(st.v, q.n)}/${q.n}`;
    return `<li class="q${st.done ? ' done' : ''}" title="${esc(t.qLong[q.type](q.n))}"><i aria-hidden="true">${st.done ? '✓' : ''}</i><span>${esc(live ? t.qShort[q.type](q.n) : t.qLong[q.type](q.n))}</span>${live && !st.done ? `<small>${prog}</small>` : ''}</li>`;
  }).join('');
}
function quests(after) {
  questChips($('quests'), true);
  if (!after) return;
  QU.forEach((q, i) => {
    if (qDone.has(i) || !questState(N, g, q).done) return;
    qDone.add(i); toast(t.qDone(t.qLong[q.type](q.n))); mood = { k: 'joy', t: performance.now() };
  });
}
// facts (game.js factsFound, same rule as the server): within their radius, or anywhere in their département
// (a birth in a small town); plus 'd' + index for each département entered, which lights up the album map
const factsOf = path => factsFound(N, FACTS.rows, path);
const seenFacts = new Set();   // shown during this visit (not to pop up twice)
store.album = store.album || {};
function albumAdd(id, day) { if (!store.album[id]) store.album[id] = day; }
const isDept = id => /^d\d+$/.test(id);
const factById = id => FACTS.f.find(f => f.id === id);
const factQ = [];
function discover(a) {
  for (const id of factsOf([a])) {
    if (seenFacts.has(id)) continue;
    seenFacts.add(id);
    if (store.album[id]) continue;   // already in the album: no pop-up
    albumAdd(id, DAY); save();
    if (isDept(id)) { if (Object.keys(store.album).length > 1) toast(t.newDept(CFG.depts[+id.slice(1)][1])); continue; }
    factQ.push(id); if (factQ.length === 1) showFact();
    mood = { k: 'happy', t: performance.now() };
  }
}
function showFact() {
  const id = factQ[0]; if (!id) return;
  const f = factById(id), el = $('fact'), total = FACTS.f.length;
  el.querySelector('.cat').textContent = t.cat[f.cat] || '';
  el.querySelector('h3').textContent = f.txt[0];
  el.querySelector('p').textContent = f.txt[1];
  el.querySelector('.foot').textContent = t.factAlbum(FACTS.f.filter(x => store.album[x.id]).length, total);
  el.dataset.cat = f.cat; el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(showFact.t); showFact.t = setTimeout(nextFact, 11000);
}
function nextFact() { factQ.shift(); $('fact').hidden = true; if (factQ.length) setTimeout(showFact, 250); }
$('factClose').onclick = () => { clearTimeout(showFact.t); nextFact(); };
// album: a map of France (départements found are lit, curated facts are dots) and the list of facts found
let DEPTS = null;
async function showAlbum() {
  $('albumDlg').showModal();
  $('albumMap').innerHTML = ''; $('albumList').innerHTML = `<li class="empty">${t.boardLoading}</li>`;
  const [online, shapes] = await Promise.all([BE.album(), DEPTS || fetch(`data/depts.json?v=${VER}`).then(r => r.json()).catch(() => null)]);
  DEPTS = shapes;
  if (online) for (const r of online) albumAdd(r.fact, r.day);
  save();
  const got = store.album, ids = Object.keys(got), nf = FACTS.f.filter(f => got[f.id]).length, nd = CFG.depts.filter((v, i) => got['d' + i]).length;
  $('albumSub').textContent = `${t.albumFacts(nf, FACTS.f.length)} · ${t.albumDepts(nd, CFG.depts.length)}`;
  $('albumNote').textContent = online ? t.albumHint : t.albumLocal + ' ' + t.albumHint;
  if (DEPTS) {
    const P = f => [((f.x - DEPTS.x0) * DEPTS.s).toFixed(0), ((DEPTS.y1 - f.y) * DEPTS.s).toFixed(0)];
    $('albumMap').innerHTML = `<svg viewBox="0 0 ${DEPTS.vb.join(' ')}" role="img" aria-label="${esc(t.albumT)}">` +
      DEPTS.p.map((d, i) => d ? `<path d="${d}" class="${got['d' + i] ? 'on' : ''}"><title>${esc(CFG.depts[i][1])}</title></path>` : '').join('') +
      FACTS.f.map(f => { const [x, y] = P(f); return `<circle cx="${x}" cy="${y}" r="${got[f.id] ? 9 : 6}" class="${got[f.id] ? 'got' : 'todo'}" data-id="${f.id}"><title>${got[f.id] ? esc(f.txt[0]) : '?'}</title></circle>`; }).join('') + '</svg>';
    for (const c of $('albumMap').querySelectorAll('circle.got')) c.onclick = () => { const li = $('albumList').querySelector(`[data-id="${c.dataset.id}"]`); if (li) { li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); } };
  }
  const list = ids.filter(id => !isDept(id)).map(factById).filter(Boolean).sort((p, q) => (got[q.id] > got[p.id]) - (got[q.id] < got[p.id]));
  $('albumList').innerHTML = list.length ? list.map(f => `<li data-id="${f.id}" data-cat="${f.cat}"><span class="cat">${esc(t.cat[f.cat])} · ${esc(t.date(got[f.id]))}</span><b>${esc(f.txt[0])}</b><p>${esc(f.txt[1])}</p>${f.src ? `<a href="${esc(f.src)}" target="_blank" rel="noopener">${t.srcT}</a>` : ''}</li>`).join('')
    : `<li class="empty">${t.albumEmpty}</li>`;
}
$('mAlbum').onclick = () => { $('menu').close(); showAlbum(); };

/* ---------------- end ---------------- */
function finish(silent) {
  const km = Math.round(traceKm(N, g.path));
  const ex = distanceFactor(N, g.path, CFG.game.distance), qn = QU.filter(q => questState(N, g, q).done).length;
  const qf = 1 + qn * (CFG.game.quests?.bonus ?? 1) / 10, final = finalScore(g.score, ex, qn, CFG.game.quests?.bonus ?? 1);
  const prev = store.best[DAY]?.score || 0, rec = final > prev;
  if (rec) store.best[DAY] = { score: final, path: g.path };
  if (!store.bestAll || final > store.bestAll.score) store.bestAll = { score: final, day: DAY };
  const sc = ((store.scores || {})[DAY] || []).filter(r => r.path !== g.path.join(','));
  store.scores = { [DAY]: sc.concat([{ pseudo: store.pseudo, score: final, k: g.score, km, mult: g.mult, ex, path: g.path.join(',') }]) };
  if (!PRACTICE) store.game = { day: DAY, path: g.path, ticket, done: true }; save();
  g.final = final; g.explore = ex; g.km = km;
  $('endT').innerHTML = t.endT + (rec && prev ? ` <span class="record">${t.endRecord}</span>` : '');
  $('endScore').innerHTML = `${NF.format(final)}<small>${t.pts}</small>`;
  const kr = realK();   // one global bonus: real kWc × bonus = score (suns, combo and quests together)
  $('endSub').textContent = t.endSub(NF.format(kr), kr ? XF(Math.round(final / kr * 100) / 100) : XF(1), NF.format(final));
  $('endStats').innerHTML = `<div><b>${NF.format(km)} km</b>${t.sWalked}</div><div><b>☀ ×${g.mult}</b>${t.sSuns(g.taken.size)}</div><div><b>✓ ${qn}/${QU.length}</b>${t.sQuests(qn)}</div><div><b>${NF.format(Math.max(prev, final))}</b>${t.sBestDay}</div>`;
  $('endRank').textContent = '';
  setMode('end');
  if (!PRACTICE) { queue(DAY, g.path, ticket); sendPending(g.path); } else $('endRank').textContent = t.practice;
  if (!silent) fitTrace();
}
function fitTrace() {
  const b = g.path.reduce((bb, a) => bb.extend(ll(a)), new maplibregl.LngLatBounds(ll(g.path[0]), ll(g.path[0])));
  map.fitBounds(b, { padding: { top: 170, bottom: Math.min(H * .5, 360), left: 40, right: 40 }, maxZoom: 12, duration: REDUCED ? 0 : 1000 });
}
$('againBtn').onclick = () => { if (dayChanged()) reloadDay(); else newGame(); };
const dayChanged = () => !PRACTICE && parisDay() !== DAY;
function reloadDay() { const q = new URLSearchParams(location.search); q.delete('day'); try { sessionStorage.setItem('pvx.newDay', '1'); } catch {} location.search = q.toString(); }
function checkDay() { if (dayChanged() && mode === 'intro') reloadDay(); }
setInterval(checkDay, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
// leaderboard of the day: Supabase (pvx_leaderboard), this browser's games when offline
$('viewBtn').onclick = showBoard;
$('mBoard').onclick = () => { $('menu').close(); showBoard(); };
async function showBoard() {
  $('boardT').textContent = t.boardT(t.date(DAY));
  $('boardList').innerHTML = `<li class="empty">${t.boardLoading}</li>`; $('boardNote').textContent = t.boardNote;
  $('board').showModal();
  try {
    const rows = await BE.leaderboard(DAY);   // every player of the day (server cap: 500)
    $('boardList').innerHTML = rows.length ? rows.map((r, i) => `${i && r.rank > rows[i - 1].rank + 1 ? '<li class="gap">…</li>' : ''}<li${r.me ? ' class="me"' : ''}><span class="rk">${r.rank}</span><span class="who">${esc(r.pseudo)}${r.me ? ` <em>(${t.you})</em>` : ''}${r.score != null ? `<small>${t.boardSub(NF.format(r.score), NF.format(Math.round(r.km)))}</small>` : ''}</span><span class="pts">${NF.format(r.final)}<small>${t.pts}</small></span></li>`).join('') : `<li class="empty">${t.boardEmpty}</li>`;
  } catch (err) { console.warn('leaderboard offline', err); localBoard(); }
  const me = $('boardList').querySelector('.me');
  if (me) { me.scrollIntoView({ block: 'nearest' }); me.tabIndex = 0; me.title = t.album; me.onclick = me.onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter') return; $('board').close(); showAlbum(); }; }
}
function localBoard() {
  const rows = [...((store.scores || {})[DAY] || [])].sort((p, q) => q.score - p.score), mine = g && g.path.join(',');
  $('boardT').textContent = t.boardT(t.date(DAY));
  $('boardList').innerHTML = rows.length ? rows.map((r, i) => `<li${r.path === mine ? ' class="me"' : ''}><span class="rk">${i + 1}</span><span class="who">${esc(r.pseudo)}${r.path === mine ? ` <em>(${t.you})</em>` : ''}${r.k != null ? `<small>${t.boardSub(NF.format(r.k), NF.format(r.km))}</small>` : ''}</span><span class="pts">${NF.format(r.score)}<small>${t.pts}</small></span></li>`).join('') : `<li class="empty">${t.boardEmpty}</li>`;
  $('boardNote').textContent = t.boardLocal;
}
// online scores: finished traces wait in store.pending until pvx-submit accepted (or refused) them
const sendable = day => day === parisDay() || day === parisDay(new Date(Date.now() - 2 * 3600e3));   // same 2 h grace as the server
function queue(day, path, ticket) {
  const k = path.join(',');
  store.pending = (store.pending || []).filter(p => sendable(p.day) && p.path.join(',') !== k).concat([{ day, path: [...path], ticket }]); save();
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
      let r = await BE.submit(p.day, p.path, CFG.data, p.ticket);
      if (!r.ok && r.reason === 'pseudo' && store.pseudo) {        // pseudo chosen offline or before the backend existed
        const c = await BE.claimPseudo(store.pseudo);
        r = c.ok ? await BE.submit(p.day, p.path, CFG.data, p.ticket) : { ok: false, reason: c.reason === 'taken' ? 'taken' : 'network' };
      }
      const retry = !r.ok && ['network', 'taken', 'race', 'db'].includes(r.reason);
      if (!retry) { store.pending = store.pending.filter(q => q !== p); save(); }
      if (!r.ok) console.warn('score not saved', r);
      if (r.ok && Array.isArray(r.facts)) { for (const f of r.facts) albumAdd(f, p.day); save(); }
      const rk = r.ok && r.rank ? t.rankTxt(r.rank, r.players) : '';
      if (isCur) $('endRank').textContent = r.ok ? (r.best ? (r.attempt > 1 ? t.newBest + ' ' : '') + rk : `${t.bestKept(NF.format(r.bestFinal))} ${rk}`).trim()
        : r.reason === 'network' ? t.offline : r.reason === 'taken' ? t.pseudoTaken : r.reason === 'start' ? t.startOff : t.sendFail(r.reason);
    }
  } finally { sending = false; }
}
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- share (story card: the trace on the game map) ---------------- */
// start and end towns, from geo.api.gouv.fr (commune containing the point); the department name if it does not answer
const towns = new Map();
function town(a) {
  if (!towns.has(a)) {
    const [lon, lat] = ll(a), dep = CFG.depts[N.dp[a]]?.[1] || '';
    towns.set(a, fetch(`https://geo.api.gouv.fr/communes?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&fields=nom&format=json`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.json()).then(j => j[0]?.nom || dep).catch(() => dep));
  }
  return towns.get(a);
}
async function route() {
  const [a, b] = await Promise.all([town(g.path[0]), town(g.path[g.path.length - 1])]);
  return !a ? '' : a === b || !b ? t.around(a) : `${a} → ${b}`;
}
const OPM = LANG === 'fr' ? 'https://deeppvmapper.fr/fr/' : 'https://deeppvmapper.fr/';
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
  x.fillStyle = '#ffcf6b'; x.font = '900 150px Unbounded'; x.fillText(NF.format(g.final ?? g.score), Wc / 2, 1490);
  x.fillStyle = '#fff4dc'; x.font = '700 46px Unbounded'; x.fillText(t.cardSub, Wc / 2, 1565);
  x.globalAlpha = .85; x.font = '700 40px Manrope'; x.fillText(t.cardLine(NF.format(realK()), NF.format(g.km ?? Math.round(traceKm(N, g.path)))), Wc / 2, 1650);
  const rt = await route();
  if (rt) {
    x.globalAlpha = .6; x.font = '700 30px Manrope'; x.fillText(t.cardRoute.toUpperCase(), Wc / 2, 1730);
    let fs = 48; do { x.font = `800 ${fs}px Unbounded`; fs -= 2; } while (x.measureText(rt).width > Wc - 120 && fs > 24);
    x.globalAlpha = 1; x.fillStyle = '#ffcf6b'; x.fillText(rt, Wc / 2, 1792);
  }
  x.fillStyle = '#fff4dc'; x.globalAlpha = .6; x.font = '600 32px Manrope'; x.fillText('deeppvmapper.fr', Wc / 2, 1865); x.globalAlpha = 1;
  return new Promise(res => c.toBlob(res, 'image/png'));
}
const shareUrl = () => OPM;
const shareTxt = async () => t.shareText(NF.format(realK()), NF.format(g.km ?? 0), await route());
$('shareBtn').onclick = async () => {
  $('share').hidden = false; $('shareMsg').textContent = '';
  $('shareImgBox').replaceChildren(); shareBlob = await card(); fitTrace();
  const box = $('shareImgBox'); box.replaceChildren();
  const img = new Image(); img.alt = t.share; img.width = 1080; img.height = 1920; img.src = URL.createObjectURL(shareBlob); box.appendChild(img);
};
$('shareClose').onclick = () => { $('share').hidden = true; };
$('shareGo').onclick = async () => {
  const file = new File([shareBlob], 'pv-explorer.png', { type: 'image/png' }), text = await shareTxt();
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text, url: shareUrl() }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  download();
};
function download() { const a = document.createElement('a'); a.href = URL.createObjectURL(shareBlob); a.download = 'pv-explorer.png'; document.body.appendChild(a); a.click(); a.remove(); }
$('shareDl').onclick = download;
$('shareCopy').onclick = async () => { try { await navigator.clipboard.writeText(`${await shareTxt()} ${shareUrl()}`); $('shareMsg').textContent = t.copied; } catch { $('shareMsg').textContent = shareUrl(); } };

/* ---------------- tutorial: four illustrated slides (first game, then Menu → How to play) ---------------- */
// Scenes are small SVGs animated with SMIL (one clock per scene, so the trace, the walker and the gains stay in step);
// with reduced motion they show their last frame.
const AN = !REDUCED;
const SV = (body, defs = '') => `<svg viewBox="0 0 300 150"><defs><filter id="tg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>${defs}</defs>${body}</svg>`;
const WALKER = '<ellipse cy="1" rx="6" ry="2" fill="rgba(14,22,49,.5)"/><g transform="translate(0 -9)"><rect x="-8" y="-14" width="16" height="5.5" fill="#18234a" stroke="#ffb22e" stroke-width="1.2" transform="rotate(-14)"/><circle r="6.5" fill="#fff4dc" stroke="#0e1631" stroke-width="1.5"/><circle cx="-2.3" cy=".5" r="1.2" fill="#0e1631"/><circle cx="2.3" cy=".5" r="1.2" fill="#0e1631"/></g>';
const fx = v => +v.toFixed(3);
// a trace walked in `dur` s, drawn up to `hold` of the loop then held; gains[i] pops when the walker reaches pts[i]
function tTrace(pts, dur, { gains = [], hold = .72, dot = 3, sun = null } = {}) {
  const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = c[c.length - 1], d = 'M' + pts.map(q => q.join(' ')).join('L'), rep = `dur="${dur}s" repeatCount="indefinite"`;
  const at = i => fx(c[i] / L * hold), pop = i => AN && i ? `<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${at(i)};${fx(at(i) + .02)};1" ${rep}/>` : '';
  let o = `<path d="${d}" fill="none" stroke="#ffb22e" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" filter="url(#tg)" stroke-dasharray="${fx(L)}" stroke-dashoffset="${AN ? fx(L) : 0}">${AN ? `<animate attributeName="stroke-dashoffset" values="${fx(L)};0;0" keyTimes="0;${hold};1" ${rep}/>` : ''}</path>`;
  pts.forEach(([x, y], i) => {
    o += `<circle cx="${x}" cy="${y}" r="${dot}" fill="#ffcf6b" opacity="${AN && i ? 0 : 1}">${pop(i)}</circle>`;
    if (gains[i]) o += `<text x="${x}" y="${y - 9}" text-anchor="middle" font="" style="font:800 9px Manrope,sans-serif" fill="#ffcf6b" stroke="#0e1631" stroke-width="3" paint-order="stroke" opacity="${AN ? 0 : 1}">${gains[i]}${pop(i)}</text>`;
  });
  const [ex, ey] = pts[pts.length - 1];
  o += AN ? `<g>${WALKER}<animateMotion path="${d}" keyPoints="0;1;1" keyTimes="0;${hold};1" calcMode="linear" ${rep}/></g>` : `<g transform="translate(${ex} ${ey})">${WALKER}</g>`;
  return o;
}
function tSun(x, y, m, r = 13) {
  let rays = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rays += `M${fx(Math.cos(a) * (r + 3))} ${fx(Math.sin(a) * (r + 3))}L${fx(Math.cos(a) * (r + 8))} ${fx(Math.sin(a) * (r + 8))}`; }
  return `<g transform="translate(${x} ${y})"><path d="${rays}" stroke="#ffcf3f" stroke-width="2.2" stroke-linecap="round">${AN ? '<animateTransform attributeName="transform" type="rotate" from="0" to="45" dur="3s" repeatCount="indefinite"/>' : ''}</path><circle r="${r}" fill="#ffcf3f"/><text y="1" text-anchor="middle" dominant-baseline="middle" style="font:900 ${Math.round(r * .8)}px Unbounded,sans-serif" fill="#0e1631">×${m}</text></g>`;
}
// scattered panels (seeded, so every visit draws the same scene)
function tDots(n, x0, y0, w, h, seed, rmax = 2.6) {
  let r = seed, o = ''; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) o += `<circle cx="${fx(x0 + rnd() * w)}" cy="${fx(y0 + rnd() * h)}" r="${fx(1 + rnd() * rmax)}" fill="none" stroke="#ff9f1c" stroke-width="1"/>`;
  return o;
}
const SCENES = [
  // 1. the goal: hop from installation to installation, collect the most power
  () => SV(tDots(46, 10, 14, 280, 124, 7) + tTrace([[34, 118], [72, 118], [72, 84], [122, 84], [122, 48], [178, 48], [178, 100], [236, 100], [236, 40], [272, 40]], 5,
    { gains: [0, '+85', '+40', '+120', '+60', '+210', '+95', '+150', '+70', '+35'] })),
  // 2. the drawn start: city (many panels, small steps) or countryside (long steps, suns)
  () => SV(`<line x1="150" y1="14" x2="150" y2="124" stroke="rgba(255,178,46,.3)" stroke-dasharray="3 4"/>` +
    tDots(60, 30, 30, 90, 80, 11, 2) + tTrace([[50, 98], [58, 98], [58, 88], [68, 88], [68, 78], [80, 78], [80, 68], [92, 68], [92, 56], [104, 56], [104, 46]], 4.4, { dot: 2.4 }) +
    tDots(9, 160, 18, 130, 100, 5) + tSun(256, 62, 2, 11) + tTrace([[172, 112], [214, 112], [214, 62], [256, 62], [256, 26]], 4.4) +
    `<g style="font:700 11px Manrope,sans-serif" fill="#c9c3b4" text-anchor="middle"><text x="75" y="140">${t.tutCity}</text><text x="225" y="140">${t.tutCountry}</text></g>`),
  // 3. moving: swipe on the map, or the controller
  () => {
    const C = [83, 80], seqs = [[0, 22, 0, -22], [-22, 0, 22, 0], [0, -22, 0, 22], [22, 0, -22, 0]], lab = [0, 2, 1, 3], dur = 5.6, rep = `dur="${dur}s" repeatCount="indefinite"`;
    // finger: four swipes (up, right, down, left), each over a quarter of the loop
    let kt = [0], cx = [C[0]], cy = [C[1] + 22], op = [0];
    seqs.forEach(([x1, y1, x2, y2], k) => { const s0 = k / 4; for (const [f, x, y, o] of [[.02, x1, y1, 0], [.06, x1, y1, 1], [.17, x2, y2, 1], [.21, x2, y2, 0]]) { kt.push(fx(s0 + f)); cx.push(C[0] + x); cy.push(C[1] + y); op.push(o); } });
    kt.push(1); cx.push(cx[cx.length - 1]); cy.push(cy[cy.length - 1]); op.push(0);
    const finger = AN ? `<circle r="9" fill="rgba(255,244,220,.28)" stroke="#fff4dc" stroke-width="1.5"><animate attributeName="cx" values="${cx.join(';')}" keyTimes="${kt.join(';')}" ${rep}/><animate attributeName="cy" values="${cy.join(';')}" keyTimes="${kt.join(';')}" ${rep}/><animate attributeName="opacity" values="${op.join(';')}" keyTimes="${kt.join(';')}" ${rep}/></circle>`
      : `<circle cx="${C[0]}" cy="${C[1] - 10}" r="9" fill="rgba(255,244,220,.28)" stroke="#fff4dc" stroke-width="1.5"/>`;
    const lit = k => AN ? `<animate attributeName="fill" values="#18234a;#18234a;#ffb22e;#ffb22e;#18234a;#18234a" keyTimes="0;${fx(k / 4 + .06)};${fx(k / 4 + .1)};${fx(k / 4 + .2)};${fx(k / 4 + .24)};1" ${rep}/>` : '';
    const D = [[0, -30], [0, 30], [30, 0], [-30, 0]], P0 = [222, 76];
    let pad = `<circle cx="${P0[0]}" cy="${P0[1]}" r="13" fill="rgba(14,22,49,.9)" stroke="rgba(255,178,46,.38)"/><text x="${P0[0]}" y="${P0[1] + 4}" text-anchor="middle" style="font:900 11px Unbounded,sans-serif" fill="#fff4dc">30</text>`;
    D.forEach(([dx, dy], d) => { pad += `<circle cx="${P0[0] + dx}" cy="${P0[1] + dy}" r="13" fill="#18234a" stroke="rgba(255,178,46,.6)">${lit(lab.indexOf(d))}</circle><text x="${P0[0] + dx}" y="${P0[1] + dy + 4}" text-anchor="middle" style="font:800 11px Unbounded,sans-serif" fill="#ffcf6b">${t.dirs[d]}</text>`; });
    let marks = ''; D.forEach(([dx, dy], d) => { marks += `<text x="${C[0] + dx * 1.25}" y="${C[1] + dy * 1.25 + 4}" text-anchor="middle" style="font:800 10px Unbounded,sans-serif" fill="#ffcf6b" opacity=".8">${t.dirs[d]}</text>`; });
    return SV(`<rect x="40" y="10" width="86" height="132" rx="9" fill="#18234a" stroke="#c9c3b4" stroke-width="1.5"/>` + tDots(14, 46, 18, 74, 116, 3, 1.6) + marks +
      `<g transform="translate(${C[0]} ${C[1] + 8})">${WALKER}</g>` + finger + pad +
      `<text x="164" y="80" text-anchor="middle" style="font:700 11px Manrope,sans-serif" fill="#c9c3b4">${LANG === 'fr' ? 'ou' : 'or'}</text>`);
  },
  // 4. combo, suns and score (power × quest bonus)
  () => SV(tDots(16, 10, 16, 130, 120, 9) + tTrace([[20, 120], [60, 120], [60, 74], [104, 74], [104, 34]], 4, { gains: [0, '+60', '+45', '×2', '+180'] }) + tSun(104, 74, 2, 11) +
    `<g text-anchor="end" style="font-variant-numeric:tabular-nums"><text x="284" y="44" style="font:800 15px Unbounded,sans-serif" fill="#fff4dc">${NF.format(620)} <tspan style="font-size:10px" fill="#ffcf6b">${LANG === 'fr' ? 'kWc' : 'kWp'}</tspan></text>` +
    `<text x="284" y="70" style="font:800 15px Unbounded,sans-serif" fill="#fff4dc">${XF(2.4)} <tspan style="font-size:10px" fill="#ffcf6b">bonus</tspan></text>` +
    `<line x1="170" y1="84" x2="284" y2="84" stroke="rgba(255,178,46,.5)"/><text x="284" y="114" style="font:900 24px Unbounded,sans-serif" fill="#ffcf6b">${NF.format(1488)} <tspan style="font-size:11px">${t.pts}</tspan></text></g>` +
    `<g transform="translate(150 22)"><rect x="-4" y="-12" width="${LANG === 'fr' ? 92 : 86}" height="18" rx="9" fill="rgba(255,178,46,.22)" stroke="#ffb22e"/><text x="${LANG === 'fr' ? 42 : 39}" y="1" text-anchor="middle" style="font:800 10.5px Manrope,sans-serif" fill="#ffcf6b">${t.comboTxt(30)}</text></g>`),
,
  // 5. quests, batteries, album
  () => {
    const chip = (y, txt, done) => `<g transform="translate(16 ${y})"><rect width="128" height="24" rx="12" fill="${done ? 'rgba(255,178,46,.22)' : '#18234a'}" stroke="${done ? '#ffb22e' : 'rgba(255,178,46,.38)'}"/>` +
      `<text x="14" y="16" style="font:900 11px Unbounded,sans-serif" fill="#ffcf6b">${done ? '✓' : '·'}</text><text x="28" y="16" style="font:700 11px Manrope,sans-serif" fill="#fff4dc">${txt}</text></g>`;
    const q = QU.length ? QU : [{ type: 'km', n: 150 }, { type: 'streak', n: 3 }, { type: 'towns', n: 2 }];
    const bat = `<g transform="translate(205 40)"><rect x="-16" y="-9" width="30" height="18" rx="3" fill="#0e1631" stroke="#7ee0a1" stroke-width="2"/><rect x="14" y="-4" width="4" height="8" fill="#7ee0a1"/><text x="-1" y="4" text-anchor="middle" style="font:900 10px Unbounded,sans-serif" fill="#7ee0a1">+3</text></g>`;
    const book = `<g transform="translate(205 102)"><circle r="16" fill="#18234a" stroke="#ffcf6b"/><path d="M0 -7V8M0 -7Q-5 -9.5 -9.5 -7V7Q-5 5 0 8Q5 5 9.5 7V-7Q5 -9.5 0 -7" fill="none" stroke="#ffcf6b" stroke-width="1.8"/></g>`;
    return SV(chip(22, t.qShort[q[0].type](q[0].n), true) + chip(58, t.qShort[q[1].type](q[1].n), false) + chip(94, t.qShort[q[2].type](q[2].n), true) + bat + book +
      `<g style="font:700 11px Manrope,sans-serif" fill="#c9c3b4"><text x="232" y="44">${t.steps}</text><text x="232" y="106">${LANG === 'fr' ? 'album' : 'album'}</text></g>`);
  }
];
let tutI = 0, tutThen = null;
function tutorial(then) {
  tutThen = then || null; tutI = 0; $('tuto').hidden = false;
  $('tutoDots').innerHTML = SCENES.map((_, i) => `<button type="button" aria-label="${i + 1} / ${SCENES.length}"></button>`).join('');
  [...$('tutoDots').children].forEach((b, i) => { b.onclick = () => { tutI = i; tutShow(); }; });
  tutShow(); $('tutoNext').focus();
}
function tutShow() {
  $('tutoScene').innerHTML = SCENES[tutI]();
  $('tutoT').textContent = t.tutT[tutI];
  $('tutoCap').textContent = tutI === 2 && !COARSE ? t.tutKeys : t.tut[tutI];
  [...$('tutoDots').children].forEach((b, i) => b.setAttribute('aria-current', i === tutI));
  $('tutoNext').textContent = tutI === SCENES.length - 1 ? t.tutGo : t.tutNext;
}
function tutClose() {
  $('tuto').hidden = true; $('tutoScene').innerHTML = ''; store.tuto = 1; save();
  const f = tutThen; tutThen = null; if (f) f();
}
$('tutoNext').onclick = () => { if (tutI < SCENES.length - 1) { tutI++; tutShow(); } else tutClose(); };
$('tutoSkip').onclick = tutClose;
addEventListener('keydown', e => {
  if ($('tuto').hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); tutClose(); }
  else if (e.key === 'ArrowRight' && tutI < SCENES.length - 1) { tutI++; tutShow(); }
  else if (e.key === 'ArrowLeft' && tutI > 0) { tutI--; tutShow(); }
});
{ let x0 = null;   // swipe between slides
  $('tutoCard').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('tutoCard').addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -40 && tutI < SCENES.length - 1) { tutI++; tutShow(); } else if (dx > 40 && tutI > 0) { tutI--; tutShow(); } }, { passive: true }); }

/* ---------------- menu, about, toast ---------------- */
$('menuBtn').onclick = () => $('menu').showModal();
$('mRestart').onclick = () => { $('menu').close(); if (dayChanged()) reloadDay(); else newGame(); };
$('creditsOpm').href = OPM;
$('creditsBtn').onclick = () => { const b = $('creditsBtn'), on = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', on); $('creditsTxt').hidden = !on; };
$('mHelp').onclick = () => { $('menu').close(); tutorial(); };
$('mAbout').onclick = () => { $('menu').close(); $('about').showModal(); };
$('mPseudo').onclick = () => { $('menu').close(); showIntro(); };
$('aboutBtn').onclick = () => $('about').showModal();
// About → share the game itself (its link, not a score)
$('shareGame').onclick = async () => {
  const url = location.origin + location.pathname + (LANG === 'en' ? '?lang=en' : '');
  if (navigator.share) { try { await navigator.share({ title: 'PV Explorer', text: t.gameText, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const lab = $('shareGame').querySelector('span');   // the dialog sits above the toast: confirm on the button itself
  try { await navigator.clipboard.writeText(url); lab.textContent = t.linkCopied; } catch { lab.textContent = url; }
  setTimeout(() => { lab.textContent = t.shareGame; }, 2500);
};
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
    ticket = sg.ticket || null; begin(sg.path[0], sg.path);
  } else showIntro();
} catch (err) {
  console.error(err);
  $('loading').textContent = (LANG === 'fr' ? 'Impossible de charger le jeu. ' : 'Could not load the game. ') + err.message;
}
// console / test hook
window.__pvx = { get g() { return g; }, get mode() { return mode; }, get N() { return N; }, get BON() { return BON; }, step, begin, newGame, tutorial, map: () => map, tgt: () => TGT };
