// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import {
  DAY, D_MAX, D_MIN, MIN, S_MAX, S_MIN, W6, cl, dayNo, fsrsR, fsrsReplayAll, fsrsStates
} from '../fsrs.js';
import {
  auth, db, dirty, mediaCache, player, prefs, recChunks, recorder,
  setPlayer, setRecChunks, setRecorder, stats
} from '../data/etat.js';
import {
  SB, esc, refreshToken, save, scheduleFlush
} from '../core/coeur-sync.js';
import { fsrsTune } from '../core/carte-media.js';
import { norm } from './quiz.js';

/* ---------- rendu du contenu d'une carte ----------
   Sous-ensemble volontairement étroit : ce qu'on écrit vraiment sur une fiche.
   **gras**, *italique*, __souligné__, retours à la ligne, listes à puces,
   et $formule$ pour les matières scientifiques. Aucune dépendance : l'app
   doit continuer de démarrer hors ligne et de tenir dans un cache.          */
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };

const OPS = { times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '∗',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  infty: '∞', to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐',
  leftrightarrow: '↔', Leftrightarrow: '⇔', mapsto: '↦', sum: '∑', prod: '∏', int: '∫',
  oint: '∮', partial: '∂', nabla: '∇', in: '∈', notin: '∉', ni: '∋', subset: '⊂',
  subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅',
  varnothing: '∅', forall: '∀', exists: '∃', nexists: '∄', angle: '∠', perp: '⊥',
  parallel: '∥', circ: '∘', deg: '°', prime: '′', ldots: '…', cdots: '⋯', dots: '…',
  neg: '¬', land: '∧', lor: '∨', therefore: '∴', because: '∵', propto: '∝', sim: '∼',
  simeq: '≃', cong: '≅', hbar: 'ℏ', ell: 'ℓ', aleph: 'ℵ', star: '⋆', bullet: '•',
  oplus: '⊕', otimes: '⊗', bot: '⊥', top: '⊤' };

/* Les commandes qui ne touchent pas à la position de lecture (`i`) — tout
   sauf \sqrt, dont le [indice] optionnel doit avancer `i` avant l'appel à
   grp(), et le cas « rien reconnu », géré dans mathHtml lui-même. */
function mathCommandHtml(name, grp) {
  if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
    const a = grp(), b = grp();
    return `<span class="fr"><i>${a}</i><i>${b}</i></span>`;
  }
  if (name === 'text' || name === 'mathrm' || name === 'mbox') return `<span class="tx">${grp()}</span>`;
  if (name === 'left' || name === 'right' || name === 'displaystyle') return '';   // le délimiteur suit
  if (GREEK[name]) return GREEK[name];
  if (OPS[name]) return OPS[name];
  return esc(name);
}

/* LaTeX → HTML sur le sous-ensemble scolaire : fractions, racines, indices,
   exposants, lettres grecques et opérateurs. Ce qui n'est pas reconnu est
   rendu tel quel plutôt que perdu. */
function mathHtml(src) {
  let i = 0, out = '';
  const grp = () => {
    while (src[i] === ' ') i++;
    if (src[i] === '{') {
      const start = ++i;
      let depth = 1;
      while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
      return mathHtml(src.slice(start, i - 1));
    }
    if (src[i] === '\\') {
      const j = i++;
      while (/[a-zA-Z]/.test(src[i] || '')) i++;
      return mathHtml(src.slice(j, i));
    }
    return esc(src[i++] || '');
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      let j = i + 1, name = '';
      while (/[a-zA-Z]/.test(src[j] || '')) name += src[j++];
      i = j;
      if (!name) { out += esc(src[i] || ''); i++; }
      else if (name === 'sqrt') {
        let idx = '';
        const k = src[i] === '[' ? src.indexOf(']', i) : -1;
        if (k > 0) { idx = mathHtml(src.slice(i + 1, k)); i = k + 1; }
        out += `<span class="rt">${idx ? `<i class="ri">${idx}</i>` : ''}<i class="rs">√</i><i class="rb">${grp()}</i></span>`;
      } else out += mathCommandHtml(name, grp);
      continue;
    }
    if (ch === '^') { i++; out += `<sup>${grp()}</sup>`; continue; }
    if (ch === '_') { i++; out += `<sub>${grp()}</sub>`; continue; }
    i++;
    out += esc(ch);
  }
  return out;
}

/* Texte d'une carte → HTML. Toujours passer par ici, jamais par esc() seul :
   c'est le seul endroit qui échappe et met en forme d'un coup. */
const MK = '\u0001';

export function rt(s) {
  s = String(s == null ? '' : s);
  const math = [];
  s = s.replace(/\$([^$\n]+)\$/g, (_, m) => MK + (math.push(mathHtml(m)) - 1) + MK);
  const inl = t => esc(t)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    .replace(new RegExp(MK + '(\\d+)' + MK, 'g'), (_, k) => `<span class="mth">${math[+k]}</span>`);
  const out = [];
  let list = null;
  for (const raw of s.split(/\r?\n/)) {
    const m = /^\s*(?:[-*•·–]|\d+[.)])\s+(.+)$/.exec(raw);
    if (m) { (list = list || []).push(`<li>${inl(m[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (raw.trim()) out.push(inl(raw));
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('<br>').replace(/<br>(?=<ul>)/g, '').replace(/<\/ul><br>/g, '</ul>');
}

/* Version texte brut : comparaison de réponses, recherche, synthèse vocale.
   Les symboles connus sont traduits plutôt que supprimés, sinon « πr² » se
   lirait « r ». */
export const plain = s => String(s == null ? '' : s)
  .replace(/\$([^$\n]+)\$/g, '$1')
  .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
  .replace(/\\sqrt\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, '√($1)')
  .replace(/\\(?:text|mathrm|mbox)\s*\{([^{}]*)\}/g, '$1')
  .replace(/\\([a-zA-Z]+)/g, (m, n) => GREEK[n] || OPS[n] || n)
  .replace(/[*_`{}]/g, '')
  .replace(/\s+/g, ' ').trim();

/* ---------- médias ----------
   Les fichiers partent dans le seau « media » du projet, sous un dossier au
   nom du compte : les règles d'accès n'autorisent ni l'écriture ni la
   lecture ailleurs.

   Le seau n'est plus public. Il l'était, et c'était le trou le plus net
   du projet : la photo d'un cours ou l'enregistrement de la voix d'un
   élève se lisait sans compte, par simple URL, indéfiniment — un
   identifiant illisible n'a jamais été un contrôle d'accès.

   Ce qu'on range dans la carte est donc un chemin, plus une adresse.
   L'adresse est signée au moment de l'affichage et ne vaut que quelques
   heures. Une valeur absolue (http…) est laissée telle quelle : une
   carte écrite avant ce changement continue de s'afficher. */
/* Une adresse du seau, quelle que soit sa forme, redonne son chemin. On
   reconnaît aussi les anciennes adresses publiques : les cartes écrites
   avant la fermeture du seau pointaient vers /object/public/…, qui ne
   répond plus rien — plutôt que de les laisser cassées, on en extrait le
   chemin et on les relit comme les autres. Une adresse étrangère au seau
   (data:, blob:, un autre site) rend une chaîne vide : elle s'affiche
   telle quelle, sans passer par ici. */
const MOBJ = /\/storage\/v1\/object\/(?:public|authenticated|sign)\/media\/(.+?)(?:\?|$)/;

const mediaPath = r => {
  if (!r) return '';
  const m = String(r).match(MOBJ);
  if (m) return decodeURIComponent(m[1]);
  return /^(https?:|data:|blob:)/i.test(r) ? '' : String(r);
};

/* Le seau est privé : un <img src> ne sait pas porter d'en-tête
   d'autorisation. On récupère donc l'octet avec le jeton du compte, et on
   donne à la balise une adresse locale. Un seul mécanisme, sans durée de
   validité à surveiller — et le navigateur garde l'objet tant que
   l'onglet vit. */
async function mediaUrl(path) {
  const hit = mediaCache.get(path);
  if (hit) return hit;
  if (!auth) throw new Error('auth');
  if (auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const h = { apikey: SB.key, Authorization: 'Bearer ' + auth.token };
  /* Deux chemins vers le même octet. Le direct d'abord ; si le serveur ne
     le sert pas, on demande une adresse signée et on la suit. Garder les
     deux coûte six lignes et évite de faire dépendre l'affichage d'une
     seule route — celle-là, je ne peux pas l'essayer avant de livrer. */
  let r = await fetch(`${SB.url}/storage/v1/object/authenticated/media/${path}`, { headers: h });
  if (!r.ok) {
    const s = await fetch(`${SB.url}/storage/v1/object/sign/media/${path}`, {
      method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    if (!s.ok) throw new Error('media:' + r.status + '/' + s.status);
    const j = await s.json().catch(() => null);
    /* la casse du champ a changé entre les versions de l'API : on accepte
       les deux plutôt que de parier sur celle d'aujourd'hui */
    const rel = j && (j.signedURL || j.signedUrl);
    if (!rel) throw new Error('media:sign');
    r = await fetch(SB.url + '/storage/v1' + (rel[0] === '/' ? rel : '/' + rel), { headers: h });
    if (!r.ok) throw new Error('media:' + r.status);
  }
  const url = URL.createObjectURL(await r.blob());
  mediaCache.set(path, url);
  return url;
}

/* L'écran se peint d'un coup, la récupération prend un aller-retour :
   l'image part donc sans adresse et la reçoit dès qu'elle arrive. */
export const mimg = (cls, r) => {
  if (!r) return '';
  const p = mediaPath(r);
  return p ? `<img class="${cls}" data-m="${esc(p)}" alt="">`
           : `<img class="${cls}" src="${esc(r)}" alt="">`;
};

export function paintMedia(root) {
  (root || document).querySelectorAll('img[data-m]').forEach(el => {
    const p = el.dataset.m;
    delete el.dataset.m;                   // une seule tentative par image
    /* Une image qu'on n'a pas pu chercher s'efface au lieu de laisser le
       carré cassé du navigateur : la fiche se lit encore, et le texte
       reprend la place. La cause part dans la console, pas à l'écran. */
    mediaUrl(p).then(u => { el.src = u; },
                     e => { console.warn('média', p, String(e && e.message)); el.remove(); });
  });
}

/* Le seau n'accepte qu'une liste de types. Safari ne rend pas « audio/mp4 »
   mais « audio/mp4;codecs=… » : le seau comparait la chaîne entière, ne
   reconnaissait rien, et refusait tous les enregistrements du micro sur
   iPhone. On ne garde donc que le type, sans ses paramètres.
   L'extension se déduit du type et non du nom : un enregistrement n'a pas
   de nom de fichier, et celui qu'on lui inventait annonçait « .webm »
   pour un contenu qui n'en était pas un. */
/* Dire ce qui a été refusé, et par qui. Un même « envoi impossible »
   couvrait le type rejeté, le jeton périmé et la coupure réseau : trois
   causes, trois gestes différents pour s'en sortir. */
export function upErr(x) {
  const m = String((x && x.message) || '');
  if (m === 'big') return 'Fichier trop lourd';
  if (m === 'auth') return 'Reconnecte-toi pour envoyer';
  const code = (m.match(/^up:(\d+)$/) || [])[1];
  if (code === '415') return 'Ce format de fichier n’est pas accepté';
  if (code === '413') return 'Fichier trop lourd pour le serveur';
  if (code === '401' || code === '403') return 'Session expirée, reconnecte-toi';
  return code ? `Envoi refusé (${code})` : 'Envoi impossible — réseau ?';
}

/* Choisit un fichier sans laisser d'input traîner dans le DOM. */
export function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.style.display = 'none';
    i.onchange = () => { res(i.files && i.files[0]); i.remove(); };
    document.body.appendChild(i); i.click();
  });
}

export const REC = typeof MediaRecorder !== 'undefined' &&
            typeof navigator !== 'undefined' && !!(navigator.mediaDevices || {}).getUserMedia;

export async function recStart() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  setRecChunks([]);
  setRecorder(new MediaRecorder(stream));
  recorder.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => stream.getTracks().forEach(t => t.stop());
  recorder.start();
}

export function recStop() {
  return new Promise(res => {
    if (!recorder) return res(null);
    const r = recorder; setRecorder(null);
    r.addEventListener('stop', () => {
      const b = new Blob(recChunks, { type: r.mimeType || 'audio/webm' });
      b.name = 'voix.webm';
      res(b);
    }, { once: true });
    r.stop();
  });
}

/* Dictée : le navigateur transcrit, l'app corrige comme une réponse tapée. */
export const ASRC = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function listen(lang, done) {
  if (!ASRC) return null;
  try {
    const r = new ASRC();
    r.lang = lang || 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = e => done([...e.results[0]].map(x => x.transcript));
    r.onerror = () => done(null);
    r.onend = () => done(undefined);
    r.start();
    return r;
  } catch (e) { return null; }
}

/* ---------- son ----------
   Deux sources : un enregistrement attaché à la carte, ou la synthèse vocale
   du navigateur quand le paquet déclare une langue. Aucun fichier à héberger
   dans le second cas. */
export const TTS = typeof speechSynthesis !== 'undefined';

export const LANGS = [['', 'Aucune'], ['fr-FR', 'Français'], ['it-IT', 'Italien'],
               ['en-GB', 'Anglais'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand']];

/* Le son porte un chemin comme l'image : on le signe avant de le jouer.
   L'appui est déjà passé quand l'adresse arrive, mais c'est un
   aller-retour, pas une attente — et le navigateur garde l'autorisation
   de jouer accordée par le geste. */
export async function play(ref) {
  try {
    const p = mediaPath(ref);
    const url = p ? await mediaUrl(p) : ref;
    if (player) player.pause();
    setPlayer(new Audio(url));
    player.play().catch(() => {});
  } catch (e) { /* média manquant ou URL signée expirée : la carte reste utilisable sans le son */ }
}

export function say(text, lang) {
  const t = plain(text);
  if (!TTS || !t) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    if (lang) u.lang = lang;
    u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* TTS refusée ou indisponible : la carte reste utilisable sans voix */ }
}

/* ---------- base64url <-> unicode ---------- */
export function enc(o) {
  const b = new TextEncoder().encode(JSON.stringify(o)); let s = '';
  b.forEach(c => s += String.fromCharCode(c));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function dec(t) {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(b));
}

/* ---------- doublons ----------
   Deux cartes font doublon si leur recto se lit pareil une fois la
   ponctuation et la casse mises de côté. On les signale, on ne les jette
   jamais sans le dire : c'est parfois voulu (deux sens d'un même mot). */
/* Un paquet entier tient dans une seule ligne de base : une carte
   démesurée ne gêne pas qu'elle-même, elle fait grossir chaque envoi du
   paquet et finit par les faire échouer tous. Les bornes sont larges — un
   article de code entre sans problème — mais elles existent. */
export const MAXF = 500, MAXB = 4000;

const overLen = c => plain(c.f || '').length > MAXF ? 'f'
                   : plain(c.b || '').length > MAXB ? 'b' : '';

export function markOver(cards) {
  let n = 0;
  for (const c of cards) {
    const o = overLen(c);
    if (o) { c.big = o; n++; } else delete c.big;
  }
  return n;
}

export function markDups(cards, target) {
  const here = new Set((target ? target.cards : []).map(c => norm(c.f || '')));
  const seen = new Set();
  let inside = 0, already = 0;
  for (const c of cards) {
    const k = norm(c.f || '');
    if (seen.has(k)) { c.dup = 'inside'; inside++; }
    else if (here.has(k)) { c.dup = 'deck'; already++; }
    else delete c.dup;
    seen.add(k);
  }
  return { inside, already, total: inside + already };
}

/* ══════════ FSRS ══════════
   Le moteur lui-même est dans src/fsrs.js — voir son bandeau. Ici ne
   restent que les trois choses qu'il ne peut pas savoir : les réglages du
   compte, et ce que l'app en fait. */
const fsrsW = () => (prefs.w && (prefs.w.length === 34 || prefs.w.length === 21)) ? prefs.w : W6;

export const fsrsDR = () => cl(prefs.dr || 0.9, 0.7, 0.99);

const fsrsMax = () => Math.max(1, prefs.maxIvl || 36500);

const fsrsCfg = () => ({ w: fsrsW(), dr: fsrsDR(), maxIvl: fsrsMax() });

/* Probabilité de se rappeler la fiche à l'instant t : c'est la grandeur
   que FSRS optimise, et celle qui décide de l'échéance. */
function recall(c, at) {
  if (!c || !c.S || !c.lr) return c && c.n ? 0 : 1;
  const t = Math.max(0, Math.floor(((at || Date.now()) - c.lr) / DAY));
  return fsrsR(fsrsW(), t, { S: c.S, D: c.D || 5, F: c.F || c.S });
}

/* Les quatre boutons, calculés ensemble : l'aperçu affiché et ce qui sera
   réellement appliqué sortent du même calcul, donc ils ne peuvent pas
   diverger. */
const etats = (c, now) => fsrsStates(c, now || Date.now(), fsrsCfg());

export const cstate = c => {
  if (c.x) return 'susp';
  if (!c.n && !c.S) return 'new';
  if (c.st === 1 || c.st === 3 || !c.i || c.i < 1) return 'learn';
  return c.i < 21 ? 'young' : 'mature';
};

/* Les quatre âges d'une fiche, dans le vocabulaire du livre : on l'ouvre,
   on la travaille, on la relit, puis on la sait. */
export const STATE = { new: 'À lire', learn: 'En cours', young: 'Relue',
                mature: 'Sue', susp: 'De côté' };

export function grade(c, rating) {
  const now = Date.now();
  const p = etats(c, now)[cl(rating | 0, 0, 3)];
  if (rating === 0 && (c.st === 2 || (c.i || 0) >= 1)) c.l = (c.l || 0) + 1;
  c.S = p.S; c.D = p.D; c.F = p.F;
  c.st = p.st; if (p.sp == null) delete c.sp; else c.sp = p.sp;
  c.i = p.ivl; c.d = p.d; c.lr = now;
  c.n = (c.n || 0) + (rating > 0 ? 1 : 0);
  return c;
}

/* Formulation lisible du prochain passage */
export function nextIn(c) {
  if (!c.d) return '';
  const ms = c.d - Date.now();
  if (ms <= 0) return 'maintenant';
  if (ms < 45 * MIN) return Math.max(1, Math.round(ms / MIN)) + ' min';
  if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' h';
  const j = Math.round(ms / DAY);
  if (j < 31) return j + ' j';
  if (j < 365) return Math.round(j / 30) + ' mois';
  const an = j / 365;
  return (an < 10 ? an.toFixed(1).replace('.0', '').replace('.', ',') : Math.round(an)) + ' ans';
}

/* Ce que le moteur sait d'une page, dit en clair. La stabilité est le
   nombre de jours au bout duquel le souvenir retombe à 90 % ; la
   difficulté, la peine intrinsèque de la page sur dix. Ces deux nombres,
   plus la date du dernier passage, suffisent à placer le suivant. */
function memDays(v) {
  if (v < 1) return Math.max(1, Math.round(v * 24)) + ' h';
  if (v < 31) return Math.round(v) + ' j';
  if (v < 365) return Math.round(v / 30) + ' mois';
  const an = v / 365;
  return (an < 10 ? an.toFixed(1).replace('.0', '').replace('.', ',') : Math.round(an)) + ' ans';
}

export function memLine(c) {
  if (!c.S) return '';
  return `souvenir ${Math.round(recall(c, Date.now()) * 100)} %`
    + ` · tient ${memDays(c.S)}`
    + ` · difficulté ${(Math.round((c.D || 5) * 10) / 10).toString().replace('.', ',')}/10`;
}

/* Ce que proposerait chaque bouton, pour l'afficher dessus. Le flou étant
   dérivé de la fiche, l'aperçu dit exactement la vérité. */
export function preview(c, rating) {
  const p = etats(c)[cl(rating | 0, 0, 3)];
  return nextIn({ d: p.d });
}

/* ---------- recalcul depuis l'historique réel ----------
   Le rejeu lui-même (`fsrsReplayAll`) est dans src/fsrs.js, pur et testé
   (test/revlog.test.js) : ici ne reste que ce qu'un module pur ne peut
   pas savoir — où vivent les fiches, et comment les écritures se
   propagent (file durable, sauvegarde). */
export function fsrsReplay(rows) {
  const results = fsrsReplayAll(rows, fsrsCfg());
  const index = new Map();
  for (const d of db.decks) for (const c of d.cards) index.set(c.id, [c, d]);
  let done = 0;
  for (const [id, state] of results) {
    const hit = index.get(id); if (!hit) continue;
    const [c, d] = hit;
    c.S = state.S; c.D = state.D; c.F = state.F; c.lr = state.lr;
    c.st = state.st; delete c.sp;
    c.n = Math.max(c.n || 0, state.n);
    c.l = Math.max(c.l || 0, state.l);
    /* l'échéance n'est pas touchée : on refait la mémoire, pas le calendrier,
       exactement comme Anki qui ne replanifie que si on le lui demande */
    c.i = state.i;
    dirty[d.id] = 1; done++;
  }
  if (done) { save(); scheduleFlush(); }
  return done;
}

const OPT_EVERY = 14 * DAY;

const OPT_GROWTH = 1.25;

/* La conversion d'Anki (convert_to_fsrs_items) : chaque fiche donne un
   élément par révision — la révision et tout ce qui l'a précédée — et on
   écarte ceux dont la dernière révision tombe le jour même, qui
   n'apprennent rien sur l'oubli. */
export function fsrsItems(rows) {
  const byCard = new Map();
  for (const r of rows || []) {
    if (r.rating == null) continue;
    if (!byCard.has(r.card_id)) byCard.set(r.card_id, []);
    byCard.get(r.card_id).push({ g: cl((+r.rating | 0) + 1, 1, 4), t: +new Date(r.created_at) });
  }
  const ratings = [], deltas = [], lengths = [];
  for (const log of byCard.values()) {
    if (log.length < 2) continue;
    log.sort((a, b) => a.t - b.t);
    const g = log.map(x => x.g);
    const dt = log.map((x, i) => i ? Math.max(0, dayNo(x.t) - dayNo(log[i - 1].t)) : 0);
    for (let i = 1; i < log.length; i++) {
      if (dt[i] <= 0) continue;
      lengths.push(i + 1);
      for (let k = 0; k <= i; k++) { ratings.push(g[k]); deltas.push(dt[k]); }
    }
  }
  return { ratings: Uint32Array.from(ratings), deltas: Uint32Array.from(deltas),
           lengths: Uint32Array.from(lengths) };
}

/* Le fil de calcul : il charge le module, lui passe les tableaux, rend les
   paramètres. Aucun import dans le wasm, donc rien à lui fournir. */
const OPT_WORKER = `onmessage = async e => {
  try {
    const d = e.data, r = await fetch(d.url, { cache: 'force-cache' });
    const { instance } = await WebAssembly.instantiate(await r.arrayBuffer(), {});
    const X = instance.exports;
    const put = a => { const p = X.folio_alloc(a.length);
      new Uint32Array(X.memory.buffer, p, a.length).set(a); return p; };
    const pr = put(d.ratings), pd = put(d.deltas), pl = put(d.lengths), po = X.folio_alloc(1);
    const out = X.folio_optimize(pr, pd, pl, d.lengths.length, 1, 0xFFFFFFFF, po);
    const n = new DataView(X.memory.buffer).getUint32(po, true);
    postMessage(out && n ? Array.from(new Float32Array(X.memory.buffer, out, n)) : null);
  } catch (err) { postMessage(null); }
};`;

export function fsrsOptimize(items) {
  return new Promise(resolve => {
    let w = null, done = 0;
    const fin = v => { if (done) return; done = 1; try { w && w.terminate(); } catch (e) { /* worker déjà mort ou jamais lancé : rien à nettoyer */ } resolve(v); };
    try {
      const url = URL.createObjectURL(new Blob([OPT_WORKER], { type: 'text/javascript' }));
      w = new Worker(url);
      URL.revokeObjectURL(url);
      w.onmessage = e => fin(e.data);
      w.onerror = () => fin(null);
      setTimeout(() => fin(null), 60000);     // un calcul qui s'éternise n'aura pas lieu
      w.postMessage({ url: new URL('fsrs.wasm', location.href).href,
        ratings: items.ratings, deltas: items.deltas, lengths: items.lengths });
    } catch (e) { fin(null); }
  });
}

/* Anki réoptimise tout seul ; ici pareil, sans rien demander ni afficher :
   au calme après le démarrage, quand l'historique a assez bougé. */
export function fsrsAuto() {
  if (prefs.simple || !auth.uid) return;
  const age = Date.now() - (prefs.wAt || 0);
  const grown = !prefs.wN || (stats.rows && stats.rows.length > prefs.wN * OPT_GROWTH);
  if (prefs.wAt && age < OPT_EVERY && !grown) return;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 4000));
  idle(() => { fsrsTune(false); }, { timeout: 15000 });
}

/* ---------- reprise d'une bibliothèque existante ----------
   Les fiches déjà travaillées n'ont ni stabilité ni difficulté : on les
   convertit avec le pont officiel du crate. Rien n'est perdu — une fiche
   qui revenait dans 30 jours revient toujours dans 30 jours — et le moteur
   prend la suite à partir de là. C'est un point de départ approximatif :
   « Régler le moteur sur moi » rejoue ensuite l'historique réel, ce que ce
   pont ne sait pas faire. */
/* Le pont officiel vers une fiche déjà travaillée : `memory_state_from_sm2`
   (fsrs 6.6.2, src/inference.rs). Faute d'avoir jamais stocké une facilité
   par fiche, on prend 2,5 — la facilité de départ d'Anki. */
function sm2State(w, ease, ivl, ret) {
  const dec = -w[20], fac = Math.pow(0.9, 1 / dec) - 1;
  const S = Math.max(ivl, S_MIN) * fac / (Math.pow(ret, 1 / dec) - 1);
  const D = 11 - (ease - 1)
    / (Math.exp(w[8]) * Math.pow(S, -w[9]) * Math.expm1((1 - ret) * w[10]));
  return isFinite(S) && isFinite(D)
    ? { S: cl(S, S_MIN, S_MAX), D: cl(D, D_MIN, D_MAX) }
    : { S: cl(Math.max(ivl, S_MIN), S_MIN, S_MAX), D: 5 };
}

function fsrsSeed(c) {
  if (c.S || !c.n) return false;
  const ivl = +c.i || 0;
  if (ivl >= 1) {
    const m = sm2State(fsrsW(), 2.5, ivl, 0.9);
    c.S = m.S; c.D = m.D; c.F = m.S;
    c.st = 2; delete c.sp;
    c.lr = (c.d || Date.now()) - ivl * DAY;
  } else {
    c.st = 1; c.sp = 0;                      // encore en apprentissage
    c.lr = c.d ? c.d - 10 * MIN : Date.now();
  }
  return true;
}

export function fsrsMigrate() {
  let n = 0;
  for (const d of db.decks) { let touched = 0; for (const c of d.cards) if (fsrsSeed(c)) { n++; touched = 1; } if (touched) dirty[d.id] = 1; }
  if (n) { save(); scheduleFlush(); }
  return n;
}
