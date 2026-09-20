import { I, svg } from '../icones.js';
import { DAY } from '../fsrs.js';
import { isDue } from '../file.js';
import {
  actx, auth, booted, db, dirty, fnr, gone, prefs, prefsTimer, setActx, setBooted,
  setPrefsTimer, setTt, tt
} from '../data/etat.js';
import {
  SB, api, doUndo, esc, flush, pushUndo, refreshToken, save, saveDeck, setOnline, uid
} from '../core/coeur-sync.js';
import { norm } from './quiz.js';
import { snapVersion } from '../core/reglages-corbeille.js';

/* ---------- génération de cartes ----------
   La clé Anthropic n'est jamais ici. app.js est servi par GitHub Pages, donc
   public : la clé vit dans un secret de la fonction Supabase « ai », qui seule
   parle à l'API. L'app n'envoie que le texte, avec son jeton de session. */
export const AIERR = {
  budget: 'Budget IA atteint', quota: 'Quota du jour atteint',
  fquota: 'Quota photos et PDF du jour atteint',
  long: 'Texte trop long', short: 'Texte trop court',
  big: 'Fichier trop lourd', mime: 'Format non reconnu',
  nokey: 'IA non configurée', empty: 'Rien à extraire'
};

async function aiCall(payload) {
  if (auth && auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const call = () => fetch(SB.url + '/functions/v1/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB.key,
               Authorization: 'Bearer ' + (auth && auth.token) },
    body: JSON.stringify(payload)
  });
  let r = await call();
  if (r.status === 401 && auth && auth.refresh && await refreshToken()) r = await call();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'net');
  return (j.cards || []).map(c => ({
    f: String(c.f || '').replace(/[\t\r\n]+/g, ' ').trim(),
    b: String(c.b || '').replace(/[\t\r\n]+/g, ' ').trim()
  })).filter(c => c.f && c.b);
}

export const aiCards = (text, hint) => aiCall({ op: 'cards', text, hint: hint || '' });

/* ---------- photo d'une page, PDF ----------
   La photo est réduite avant d'être envoyée : au-delà de 1568 pixels de
   côté, l'API la réduit elle-même sans rien y gagner en lisibilité, et
   une photo de téléphone brute pèse dix fois le nécessaire — donc dix
   fois le prix. Le PDF part tel quel ; ce sont les pages demandées qui
   limitent le travail. */
const IMGMAX = 1568;

function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(1, IMGMAX / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const out = cv.toDataURL('image/jpeg', .82);
      res({ mime: 'image/jpeg', data: out.slice(out.indexOf(',') + 1) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('mime')); };
    img.src = url;
  });
}

const asB64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res({ mime: file.type, data: String(r.result).slice(String(r.result).indexOf(',') + 1) });
  r.onerror = () => rej(new Error('mime'));
  r.readAsDataURL(file);
});

export async function aiFromFile(file, hint, pages) {
  const pdf = file.type === 'application/pdf';
  const { mime, data } = pdf ? await asB64(file) : await shrink(file);
  return aiCall({ op: pdf ? 'pdf' : 'ocr', mime, data, hint: hint || '', pages: pages || '' });
}

export const dueCount = d => d.cards.filter(c => isDue(c, Date.now())).length;

/* ---------- mode simple ----------
   Le moteur est coupé : plus d'échéance, plus de note, on swipe et c'est tout.
   Rien n'est effacé. d, i, e, n, l restent inscrits dans chaque carte et
   reprennent exactement où ils en étaient le jour où le moteur revient. */
export const simpleMode = () => !!prefs.simple;

const allCards = () => db.decks.flatMap(d => d.cards.map(c => [c, d]));

/* ce qui retombera d'un coup si on rallume le moteur maintenant */
export const backlog = () => allCards().filter(([c]) => !c.x && c.n && c.d && c.d <= Date.now()).length;

/* Rallumage : sans étalement tout l'arriéré retombe le même jour et la
   reprise devient ingérable. On répartit sur autant de jours qu'il faut
   pour tenir l'objectif quotidien, les plus vieilles cartes en premier. */
export function spreadBacklog() {
  const now = Date.now();
  const late = allCards().filter(([c]) => !c.x && c.n && c.d && c.d <= now)
    .sort((a, b) => (a[0].d || 0) - (b[0].d || 0));
  const per = Math.max(5, prefs.goal || 30);
  if (late.length <= per) return 0;
  const touched = {};
  late.forEach(([c, d], i) => {
    const day = Math.floor(i / per);
    if (!day) return;
    c.d = now + day * DAY;
    touched[d.id] = 1;
  });
  Object.keys(touched).forEach(id => { dirty[id] = 1; });
  save(); flush();
  return Math.ceil(late.length / per);
}

export function savePrefs() {
  clearTimeout(prefsTimer);
  setPrefsTimer(setTimeout(() => {
    save();                                            // le cache local garde le mode
    api('/rest/v1/prefs', 'POST', [{ user_id: auth.uid, name: prefs.name || null, data: prefs }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => setOnline(false));
  }, 400));
}

/* Progression du jour, pour l'anneau d'objectif */
export function todayCount() {
  const day = new Date(); day.setHours(0, 0, 0, 0);
  return (db.today && db.today.d === +day) ? db.today.n : 0;
}

export function bumpToday() {
  const day = new Date(); day.setHours(0, 0, 0, 0);
  if (!db.today || db.today.d !== +day) db.today = { d: +day, n: 0 };
  db.today.n++;
  save();
}

/* ---------- paquets ---------- */
export function addDeck(name, cards, subject) {
  const d = { id: uid(), name: (name || '').trim() || 'Paquet', subject: subject || '',
              hidden: false, pos: -Date.now() / 1000 | 0,
              /* un identifiant fourni est gardé : c'est ainsi qu'un devoir
                 reste reconnaissable une fois chez l'élève */
              cards: cards.map(c => ({ id: c.id || uid(), f: c.f, b: c.b })) };
  db.decks.unshift(d); saveDeck(d); return d;
}

/* ---------- opérations sur les paquets ----------
   Dupliquer, fusionner, scinder. Toutes passent par pushUndo avant de
   toucher quoi que ce soit : les identifiants qui n'existaient pas encore
   sont photographiés « absents », donc annuler les retire, tandis que les
   paquets modifiés ou mis à la corbeille reviennent à l'identique.
   Copier une carte, c'est copier tout son état d'apprentissage : un
   doublon qui repartirait de zéro ferait réviser deux fois la même chose. */
const copyCards = cs => cs.map(c => ({ ...c, id: uid() }));

export const freeName = base => {
  if (!db.decks.some(d => d.name === base)) return base;
  for (let i = 2; ; i++) if (!db.decks.some(d => d.name === base + ' ' + i)) return base + ' ' + i;
};

export function cloneDeck(d) {
  const n = { id: uid(), name: freeName(d.name + ' (copie)'), subject: d.subject,
              hidden: !!d.hidden, pinned: false, pos: -Date.now() / 1000 | 0,
              meta: { ...(d.meta || {}) }, cards: copyCards(d.cards) };
  pushUndo('Duplication', [n.id]);
  db.decks.unshift(n); saveDeck(n);
  return n;
}

/* Fusion : les cartes de la source rejoignent la cible, la source part à
   la corbeille (récupérable trente jours). Une carte déjà présente des
   deux côtés — même recto et même verso — n'est pas recopiée. */
export function mergeDecks(target, src) {
  pushUndo('Fusion', [target.id, src.id]);
  snapVersion(target, 'avant fusion');
  const seen = new Set(target.cards.map(c => key2(c)));
  const add = src.cards.filter(c => !seen.has(key2(c)));
  target.cards.push(...copyCards(add));
  db.decks = db.decks.filter(x => x.id !== src.id);
  delete dirty[src.id]; gone.push(src.id);
  dirty[target.id] = 1; save(); flush();
  return { added: add.length, skipped: src.cards.length - add.length };
}

const key2 = c => norm(c.f || '') + ' ' + norm(c.b || '');

/* Scission : le paquet devient N paquets de `size` cartes, dans l'ordre
   où elles sont. L'original file à la corbeille plutôt que d'être effacé,
   pour que l'opération reste réversible même après un rechargement. */
export function splitDeck(d, size) {
  snapVersion(d, 'avant découpe');
  const parts = [];
  for (let i = 0; i < d.cards.length; i += size) parts.push(d.cards.slice(i, i + size));
  if (parts.length < 2) return null;
  const made = parts.map((cards, i) => ({
    id: uid(), name: d.name + ' · ' + (i + 1), subject: d.subject,
    hidden: !!d.hidden, pinned: false, pos: (-Date.now() / 1000 | 0) + i,
    meta: { ...(d.meta || {}) }, cards: copyCards(cards)
  }));
  pushUndo('Scission', [d.id, ...made.map(x => x.id)]);
  db.decks = db.decks.filter(x => x.id !== d.id);
  delete dirty[d.id]; gone.push(d.id);
  db.decks.unshift(...made);
  made.forEach(x => dirty[x.id] = 1);
  save(); flush();
  return made;
}

/* ---------- chercher et remplacer ----------
   Recherche littérale, jamais une expression régulière : on remplace ce
   qu'on a tapé, caractère pour caractère. Le compte des occurrences est
   fait avant tout changement, pour qu'on sache ce qu'on s'apprête à faire. */
const fnrSides = () => fnr.side === 'both' ? ['f', 'b'] : [fnr.side];

function fnrCount(txt, q) {
  if (!q) return 0;
  const h = fnr.cs ? txt : txt.toLowerCase(), n = fnr.cs ? q : q.toLowerCase();
  let c = 0, i = 0;
  while ((i = h.indexOf(n, i)) >= 0) { c++; i += n.length; }
  return c;
}

export function fnrScan(d) {
  let hits = 0, cards = 0;
  for (const c of d.cards) {
    let k = 0;
    for (const s of fnrSides()) k += fnrCount(String(c[s] || ''), fnr.q);
    if (k) { hits += k; cards++; }
  }
  return { hits, cards };
}

function fnrSwap(txt, q, r) {
  if (!fnr.cs) {
    const h = txt.toLowerCase(), n = q.toLowerCase();
    let out = '', i = 0, j;
    while ((j = h.indexOf(n, i)) >= 0) { out += txt.slice(i, j) + r; i = j + n.length; }
    return out + txt.slice(i);
  }
  return txt.split(q).join(r);
}

export const fnrNote = s => !fnr.q ? 'Tape ce que tu cherches. La recherche est littérale : aucun caractère n’a de sens particulier.'
  : !s.hits ? 'Aucune occurrence dans ce livre.'
  : `<b>${s.hits} occurrence${s.hits > 1 ? 's' : ''}</b> dans ${s.cards} carte${s.cards > 1 ? 's' : ''}`
    + (fnr.r ? ` → « ${esc(fnr.r)} »` : ', qui seront simplement retirées');

export function fnrApply(d) {
  const { hits } = fnrScan(d);
  if (!hits) return 0;
  pushUndo('Remplacement', [d.id]);
  snapVersion(d, 'avant remplacement');
  for (const c of d.cards)
    for (const s of fnrSides())
      if (c[s]) c[s] = fnrSwap(String(c[s]), fnr.q, fnr.r);
  saveDeck(d);
  return hits;
}

/* Réimporter son propre fichier doit remettre à jour le paquet du même
   nom, pas en empiler des copies. Mais un paquet qui vient d'ailleurs —
   lien, courrier, bibliothèque — n'a rien à voir avec le sien : « Italien »
   est un nom que trois comptes sur trois utilisent, et l'écraser ferait
   disparaître des cartes et toute leur progression sans un mot. D'où le
   second argument : « celui-ci arrive de l'extérieur, mets-le à côté ». */
export function importPayload(p, fresh) {
  let last = null;
  for (const k of (Array.isArray(p) ? p : [p])) {
    const cards = (k.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
    if (!cards.length) continue;
    const ex = fresh ? null : db.decks.find(d => d.name === k.name);
    if (ex) {
      snapVersion(ex, 'avant réimport');
      ex.subject = k.subject || ex.subject;      // sans matière à l'import : on garde la sienne
      ex.cards = cards.map(c => ({ id: c.id || uid(), f: c.f, b: c.b }));
      last = ex; dirty[ex.id] = 1;
    } else last = addDeck(fresh ? freeName((k.name || 'Paquet').trim() || 'Paquet') : k.name, cards, k.subject);
  }
  save(); flush(); return last;
}

/* ---------- sons ----------
   Deux notes synthétisées à la volée : rien à télécharger, rien à mettre
   en cache, et le son ne part jamais avant un vrai geste de l'utilisateur
   (iOS refuse d'ouvrir le contexte audio autrement). */
export function beep(good, force) {
  if (!prefs.sound && !force) return;
  try {
    setActx(actx || new (window.AudioContext || window.webkitAudioContext)());
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(good ? 660 : 300, t);
    o.frequency.exponentialRampToValueAtTime(good ? 880 : 220, t + .09);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.12, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + .18);
  } catch (e) { /* Web Audio indisponible ou bloquée : le bip est un bonus, pas une nécessité */ }
}

/* ---------- toast ---------- */
export function toast(icon, text, undo) {
  clearTimeout(tt); document.querySelectorAll('.toast').forEach(n => n.remove());
  const n = document.createElement('div'); n.className = 'toast';
  n.setAttribute('role', 'status'); n.setAttribute('aria-live', 'polite');
  n.innerHTML = svg(icon) + (text ? `<span>${esc(text)}</span>` : '')
    + (undo ? `<button class="tun">${svg(I.redo)}Annuler</button>` : '');
  if (undo) n.querySelector('.tun').onclick = () => { n.remove(); doUndo(); };
  /* Il se pose au-dessus de ce qui occupe déjà le bas — barre de
     sélection, ou rien. Sauf si une feuille est ouverte : là il passe en
     haut, sinon il se met pile sur son bouton principal et on croit lire
     le bouton (« Envoi impossible » à la place d'« Enregistrer »). */
  if (document.querySelector('.menu')) {
    n.classList.add('up');
    n.style.top = 'calc(12px + env(safe-area-inset-top))';
    n.style.bottom = 'auto';
  } else if (document.querySelector('.selb')) n.style.bottom = 'calc(84px + env(safe-area-inset-bottom))';
  else if (document.querySelector('.tabs')) n.style.bottom = 'calc(80px + env(safe-area-inset-bottom))';
  else n.style.bottom = 'calc(22px + env(safe-area-inset-bottom))';
  document.body.appendChild(n); setTt(setTimeout(() => n.remove(), undo ? 5200 : 1600));
}

/* ---------- rendu ---------- */
/* .fade porte l'entrée en douceur des listes (tuiles, lignes, boutons…) —
   voir app.css. Elle n'est présente qu'au moment exact où le contenu neuf
   est inséré lors d'une vraie navigation (animate === true) ; retirée
   avant toute reconstruction en place (un réglage qu'on bascule, une
   carte qu'on suspend) pour qu'aucun élément ne rejoue son apparition. */
/* La taille du texte des cartes est un réglage de confort : les articles
   du CPC sont longs, les mots italiens courts. Une seule variable, posée
   sur la racine, que les tailles des faces multiplient. */
export function applyFont() {
  document.documentElement.style.setProperty('--fs', prefs.font || 1);
}

/* Le voile de démarrage s'efface à la première vue dessinée, mais pas
   avant que son animation ait eu le temps d'exister. */
/* L'ouverture tient trois secondes, quoi qu'il arrive. Si le compte et
   les livres sont là en 200 ms tant mieux : le reste du temps sert à
   finir de charger en silence, et l'animation se regarde en entier au
   lieu d'être coupée au milieu. */
const BOOTMS = 3000;

export function dropBoot() {
  const n = document.getElementById('boot');
  if (!n || booted) return;
  setBooted(1);
  const rest = Math.max(0, BOOTMS - performance.now());
  setTimeout(() => { n.classList.add('off'); setTimeout(() => n.remove(), 520); }, rest);
}

/* filet de sécurité : si le premier écran ne vient jamais (script en
   erreur, réseau coupé au mauvais moment), l'ouverture s'efface quand
   même au lieu de rester plantée là. */
setTimeout(dropBoot, 6000);
