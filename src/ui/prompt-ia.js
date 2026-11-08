// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { aiBusy, comp, setAiBusy } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { AIERR, aiCall, aiPdf, aiPhotos, toast } from './import-cartes.js';
import './prompt-ia.css';

/* ══════════ l'IA de la création (2026-11-07) ══════════
   Demandé : « l'IA n'est pas une des méthodes d'ajout, elle aide le user en
   toute circonstance, pour n'importe quoi ». Ce n'est plus un onglet : c'est
   une barre, sous la façon de créer qu'on a choisie, toujours là. On y écrit
   ce qu'on veut, et l'IA le fait avec ce qu'on lui donne :
   - des photos (huit au plus) ou un PDF, posés depuis les onglets Photo et
     Fichier : elle en fait des cartes, comme on le lui demande (« seulement
     les dates », « le chapitre 2 ») — la consigne est facultative ;
   - un texte collé (Coller, ou un fichier texte) : de même ;
   - rien du tout : elle travaille sur la liste des cartes — elle la crée
     (« 10 cartes sur la Révolution »), la complète, la retouche (« inverse
     recto et verso », « plus courtes »), cartes écrites à la main comprises.
   Ce qu'elle rend va droit dans la liste des cartes, et « Annuler » remet la
   liste d'avant. Chaque envoi est une génération du mois (la pastille).
   Chargé à la demande par ui/creation.js et, pour retoucher un paquet entier
   (2026-11-07), par ui/retouche.js — eux seuls l'importent. L'état vit dans
   `comp.prompt` (il survit à un rendu, et part avec le paquet créé) ; la
   retouche donne le sien (`ctx.etatPrompt`), ses puces (`ctx.puces`) et son
   « Annuler » (`ctx.annuler`, qui repose le paquet d'avant, état compris). */

const MAX_PIECES = 8;                 // photos d'un envoi (MAX_IMAGES de la fonction ai)
const HIST = 12;                      // les messages d'avant rappelés à l'IA

const PUCES = {
  support: ['Une question au recto', 'Seulement l’essentiel', 'Le mot au recto, la définition au verso'],
  vide: ['10 cartes sur ', 'Le vocabulaire de ', 'Les dates clés de '],
  liste: ['Inverse recto et verso', 'Plus courtes', 'Ajoute un exemple au verso', 'Ajoute 10 cartes']
};
const PLACE = {
  photo: 'Une consigne ? Ex. : seulement les dates',
  pdf: 'Une consigne ? Ex. : le chapitre 2, en questions',
  texte: 'Une consigne ? Ex. : une question au recto',
  vide: 'Ex. : 10 cartes sur la Révolution française',
  liste: 'Ex. : inverse recto et verso, ajoute 5 cartes'
};

const neuf = () => ({ fil: [], texte: '', envoi: false, pieces: null, avant: null });
let monte = null;                     // { n, ctx } : la barre à l'écran
const P = () => (monte && monte.ctx.etatPrompt ? monte.ctx.etatPrompt(neuf)
  : (comp.prompt = comp.prompt || neuf()));
const pucesDe = (ctx, g) => (g === 'liste' && ctx.puces ? ctx.puces : PUCES[g]);
const court = t => (t.length > 280 ? t.slice(0, 260).trimEnd() + ' …' : t);
const taille = o => (o >= 1048576 ? (o / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(o / 1024)) + ' Ko');


/* Ce que l'IA a sous la main : des photos, un PDF, un texte collé — ou
   rien, et elle travaille alors sur la liste. */
function support(ctx) {
  const p = P();
  if (p.pieces && p.pieces.fichiers.length) return p.pieces.genre;
  return ctx.texte() ? 'texte' : '';
}
const situation = ctx => support(ctx) || (ctx.liste().length ? 'liste' : 'vide');
const groupe = s => (s === 'liste' || s === 'vide' ? s : 'support');

function liberer(p) {
  if (p.pieces) for (const u of p.pieces.apercus) URL.revokeObjectURL(u);
  p.pieces = null;
}

/* ---------- le dessin ---------- */
function pastille(e) {
  if (!e) return '';
  if (e.cle === 'infini') return `<i class="cr-reste infini" title="${esc(e.titre)}">∞</i>`;
  return e.reste != null ? `<i class="cr-reste${e.reste ? '' : ' vide'}" style="--p:${e.pc}" title="${esc(e.titre)}">${e.reste}</i>` : '';
}

function bulle(m) {
  if (m.qui === 'moi') return `<div class="pi-b moi">${m.piece ? `<small>${svg(m.piece === 'pdf' ? I.file : m.piece === 'texte' ? I.rows : I.image)}${esc(m.libelle)}</small>` : ''}${
    m.t ? `<span>${esc(court(m.t))}</span>` : ''}</div>`;
  if (m.qui === 'err') return `<div class="pi-b err">${svg(I.warn)}<span>${esc(m.t)}</span></div>`;
  return `<div class="pi-b ia">${svg(I.spark)}<span>${esc(m.t)}</span>${
    m.annuler ? '<button type="button" class="pi-annuler" data-pi="annuler">Annuler</button>' : ''}</div>`;
}

function piecesHtml(p) {
  if (!p.pieces || !p.pieces.fichiers.length) return '';
  if (p.pieces.genre === 'pdf') {
    const f = p.pieces.fichiers[0];
    return `<div class="pi-pieces"><span class="pi-pdf">${svg(I.file)}<b>${esc(f.name)}</b><i>${taille(f.size)}</i>
      <button type="button" class="x" data-pi="sans" data-i="0" aria-label="Retirer le PDF">${svg(I.x)}</button></span></div>`;
  }
  return `<div class="pi-pieces">${p.pieces.apercus.map((u, i) => `<figure class="pi-ph"><img src="${u}" alt="Photo ${i + 1}">
      <button type="button" class="x" data-pi="sans" data-i="${i}" aria-label="Retirer la photo ${i + 1}">${svg(I.x)}</button></figure>`).join('')}</div>`;
}

function envoiHtml(p, sup) {
  const off = p.envoi || (!sup && p.texte.trim().length < 2) ? 'disabled' : '';
  return sup
    ? `<button class="pi-env large" type="submit" ${off}>${svg(I.spark)}<span>Créer les cartes</span></button>`
    : `<button class="pi-env" type="submit" aria-label="Envoyer" ${off}>${svg(I.arrow)}</button>`;
}

function dessiner() {
  if (!monte || !monte.n.isConnected) return;
  const { n, ctx } = monte, p = P(), s = situation(ctx), sup = support(ctx), bloque = ctx.bloque();
  const garde = document.activeElement && document.activeElement.id === 'pimsg'
    ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  n.dataset.situation = s;
  n.className = 'pi' + (bloque ? ' payant' + (bloque.cle === 'ferme' ? ' ferme' : '') : '');
  if (bloque) {
    n.setAttribute('data-astuce', bloque.cle === 'ferme' ? bloque.texte : 'Avec Mirandola+');
    n.toggleAttribute('data-offre', bloque.cle !== 'ferme');
    if (bloque.cle !== 'ferme') n.dataset.offre = 'plus';
  } else { n.removeAttribute('data-astuce'); n.removeAttribute('data-offre'); }
  const puces = pucesDe(ctx, groupe(s));
  n.innerHTML = `
    <div class="pi-tete"><b>${svg(I.spark)}Demande à l’IA</b>${bloque ? '' : pastille(ctx.etat())}</div>
    <div class="pi-fil" aria-live="polite">${p.fil.map(bulle).join('')}${
      p.envoi ? '<div class="pi-b ia pi-attente" aria-label="L’IA écrit"><i></i><i></i><i></i></div>' : ''}</div>
    <div class="pi-puces">${puces.map((t, i) => `<button type="button" class="pi-puce"
      data-pi="${groupe(s) === 'liste' ? 'retouche' : 'depart'}" data-i="${i}" ${p.envoi || bloque ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>
    <form class="pi-saisie" id="piform">
      ${piecesHtml(p)}
      <div class="pi-ligne">
        <textarea id="pimsg" rows="1" aria-label="Demande à l’IA" placeholder="${PLACE[s]}" ${bloque ? 'readonly tabindex="-1"' : ''}>${esc(p.texte)}</textarea>
        ${envoiHtml(p, sup && !bloque)}
      </div>
    </form>`;
  const fil = n.querySelector('.pi-fil');
  fil.scrollTop = fil.scrollHeight;
  const ta = n.querySelector('#pimsg');
  ajuster(ta);
  if (garde) { ta.focus(); ta.setSelectionRange(garde[0], garde[1]); }
  n.dataset.dessine = s;
}

const ajuster = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, innerHeight * .4) + 'px'; };

/* La liste, le texte collé ou les pièces ont changé : on ne redessine la
   barre que si ce qu'elle propose change (sa consigne d'exemple, ses puces,
   son bouton) — jamais à chaque touche. */
export function repeindre(tout) {
  if (!monte || !monte.n.isConnected) return;
  if (tout || monte.n.dataset.dessine !== situation(monte.ctx)) dessiner();
}

/* Des photos ou un PDF posés depuis l'onglet Photo ou Fichier : ils
   attendent dans la barre, avec la consigne qu'on voudra ; « Créer les
   cartes » les envoie. Un PDF remplace des photos, et l'inverse. */
export function joindre(fichiers) {
  const p = P();
  const pdf = fichiers.find(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
  if (pdf) {
    liberer(p);
    p.pieces = { genre: 'pdf', fichiers: [pdf], apercus: [] };
  } else {
    const imgs = fichiers.filter(f => /^image\//.test(f.type));
    if (!imgs.length) return;
    if (!p.pieces || p.pieces.genre !== 'photo') { liberer(p); p.pieces = { genre: 'photo', fichiers: [], apercus: [] }; }
    const place = MAX_PIECES - p.pieces.fichiers.length;
    if (imgs.length > place) toast(I.x, `${MAX_PIECES} photos au plus par envoi`);
    for (const f of imgs.slice(0, Math.max(0, place))) { p.pieces.fichiers.push(f); p.pieces.apercus.push(URL.createObjectURL(f)); }
  }
  dessiner();
  // au téléphone, la barre est sous la zone de dépôt : on l'amène à l'écran
  if (monte && monte.n.isConnected && monte.n.scrollIntoView) monte.n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- l'envoi ---------- */
const ajoutDit = (a, extra) => (a.n ? `${plur(a.n, 'carte')} ajoutée${a.n > 1 ? 's' : ''}` : 'Aucune carte nouvelle')
  + (a.dup ? ` · ${a.dup} déjà là` : '') + (a.big ? ` · ${a.big} trop longue${a.big > 1 ? 's' : ''}` : '') + (extra || '');

const libelleDe = (sup, p) => (sup === 'photo' ? plur(p.pieces.fichiers.length, 'photo')
  : sup === 'pdf' ? p.pieces.fichiers[0].name : sup === 'texte' ? 'Ton texte' : '');

async function faire(ctx, sup, msg, hist, p) {
  const opts = { consigne: msg, contexte: ctx.contexte() };
  if (sup === 'photo') {
    const r = await aiPhotos(p.pieces.fichiers, opts);
    if (!r.cards.length) throw new Error('empty');
    liberer(p);
    return ajoutDit(ctx.ajouter(r.cards), r.echec ? ` · ${plur(r.echec, 'photo')} en échec` : '');
  }
  if (sup === 'pdf') {
    const r = await aiPdf(p.pieces.fichiers[0], opts);
    liberer(p);
    return ajoutDit(ctx.ajouter(r.cards));
  }
  if (sup === 'texte') {
    const r = await aiCall({ op: 'prompt', message: `${msg || 'Fais les cartes de ce texte.'}\n\nTexte :\n${ctx.texte()}`,
      cards: [], historique: hist, hint: opts.contexte }, true);
    ctx.viderTexte();
    return ajoutDit(ctx.ajouter(r.cards));
  }
  // rien sous la main : l'IA travaille sur la liste, et la rend entière
  const r = await aiCall({ op: 'prompt', message: msg, cards: ctx.liste(), historique: hist, hint: opts.contexte }, true);
  // la création rend combien de cartes trop longues elle a écartées ; la retouche, aussi ce qui a changé
  const res = ctx.remplacer(r.cards), big = typeof res === 'number' ? res : res.big;
  return (r.note || plur(r.cards.length, 'carte')) + (big ? ` · ${big} trop longue${big > 1 ? 's' : ''} écartée${big > 1 ? 's' : ''}` : '')
    + (res && res.dit ? '\n' + res.dit : '');
}

async function envoyer(brut) {
  const { ctx } = monte, p = P(), msg = String(brut ?? p.texte).trim(), sup = support(ctx);
  if (p.envoi || aiBusy) return;
  if (ctx.bloque()) return ctx.debloquer();
  if (!sup && msg.length < 2) return;
  const hist = p.fil.filter(x => x.qui === 'moi' && x.t).map(x => x.t.slice(0, 600)).slice(-HIST);
  // une erreur d'avant ne vaut plus, et seule la dernière réponse s'annule
  p.fil = p.fil.filter(x => x.qui !== 'err').map(x => (x.annuler ? { ...x, annuler: false } : x));
  p.fil.push({ qui: 'moi', t: msg, piece: sup, libelle: libelleDe(sup, p) });
  const avant = ctx.liste().map(c => ({ f: c.f, b: c.b }));
  p.envoi = true; p.texte = ''; setAiBusy(true);
  dessiner();
  try {
    const t = await faire(ctx, sup, msg, hist, p);
    p.avant = avant;
    p.fil.push({ qui: 'ia', t, annuler: true });
  } catch (x) {
    // rien de perdu : la consigne revient dans la zone, les photos attendent encore
    const code = String(x.message), f = ctx.bloque();
    p.fil.pop(); p.texte = msg;
    p.fil.push({ qui: 'err', t: (code === 'mquota' && f && f.texte) || AIERR[code] || 'IA indisponible : réessaie dans un instant' });
  }
  p.envoi = false; setAiBusy(false);
  dessiner();
  const ta = monte && monte.n.querySelector('#pimsg');
  if (ta && p.texte) ta.focus();
}

function agir(b) {
  const { n, ctx } = monte, p = P(), k = b.dataset.pi, i = +b.dataset.i;
  if (k === 'depart') {
    // un début de consigne : il se complète (le sujet, le chapitre), il ne part pas seul
    const ta = n.querySelector('#pimsg'), t = pucesDe(ctx, groupe(situation(ctx)))[i];
    ta.value = (ta.value.trim() ? ta.value.trim() + ', ' + t.charAt(0).toLowerCase() + t.slice(1) : t);
    p.texte = ta.value; ajuster(ta); majBouton(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    return;
  }
  if (k === 'retouche') return envoyer(pucesDe(ctx, 'liste')[i]);
  if (k === 'sans') {
    URL.revokeObjectURL(p.pieces.apercus[i] || '');
    p.pieces.fichiers.splice(i, 1); p.pieces.apercus.splice(i, 1);
    if (!p.pieces.fichiers.length) p.pieces = null;
    return dessiner();
  }
  if (k === 'annuler' && p.avant) {
    if (ctx.annuler) ctx.annuler(); else ctx.remplacer(p.avant);
    p.avant = null;
    p.fil = p.fil.map(x => (x.annuler ? { ...x, annuler: false } : x));
    p.fil.push({ qui: 'ia', t: 'Annulé : tes cartes sont comme avant.' });
    toast(I.redo, 'Cartes remises comme avant');
    dessiner();
  }
}

// le bouton suit la frappe sans redessiner (le clavier du téléphone ne saute pas)
function majBouton() {
  const b = monte && monte.n.querySelector('.pi-env');
  if (b && !b.classList.contains('large')) b.disabled = P().envoi || P().texte.trim().length < 2;
}

/* `ctx` (ui/creation.js) : contexte() — titre, matière, classe, indice pour
   l'IA ; etat() — l'IA du mois (src/ia-mois.js) ; bloque() — null, ou
   pourquoi l'IA est fermée à ce compte ({ cle: 'plus' } ou { cle: 'ferme',
   texte }) ; debloquer() — le dire (Mirandola+, la démo, ou le message) ;
   texte() — le texte collé qui attend ; viderTexte() ; liste() — les
   cartes ; ajouter(cartes) → { n, dup, big } ; remplacer(cartes) → combien
   de trop longues écartées. */
export function monter(n, ctx) {
  monte = { n, ctx };
  dessiner();
  n.onclick = e => {
    if (ctx.bloque()) { e.preventDefault(); return ctx.debloquer(); }
    const b = e.target.closest('[data-pi]');
    if (b && !b.disabled) agir(b);
  };
  // l'écran peut se redessiner pendant qu'on écrit ici : creation.js y remet le focus (comp.champ)
  n.onfocusin = e => { if (e.target.id === 'pimsg' && !ctx.etatPrompt) comp.champ = 'pimsg'; };
  n.oninput = e => { if (e.target.id === 'pimsg') { P().texte = e.target.value; ajuster(e.target); majBouton(); } };
  n.onsubmit = e => { e.preventDefault(); envoyer(n.querySelector('#pimsg').value); };
  // Ctrl+Entrée (Cmd sur Mac) envoie ; Entrée seule va à la ligne
  n.onkeydown = e => {
    if (e.target.id === 'pimsg' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(e.target.value); }
  };
}
