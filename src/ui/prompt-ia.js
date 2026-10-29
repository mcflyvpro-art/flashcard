// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { aiBusy, comp, setAiBusy } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { AIERR, aiCall, toast } from './import-cartes.js';
import './prompt-ia.css';

/* ══════════ le Prompt (2026-10-29) ══════════
   L'onglet de la création qui parle à l'IA, chargé à la demande par
   ui/creation.js (qui seul l'importe). Une conversation : on colle un cours,
   on dit ce qu'on veut (« la définition au recto, le mot au verso »), l'IA
   écrit les pages ; puis on les retouche en lui parlant — « ajoute… »,
   « inverse recto et verso », « enlève les dates ». Chaque message est une
   génération du mois (op « prompt » de la fonction ai, qui rend toute la
   liste après le message et une phrase sur ce qu'elle a fait). Les pages
   proposées attendent ici ; « Ajouter » les verse dans le livre, et
   « Créer » les prend aussi.
   L'état vit dans `comp.prompt` : il survit à un rendu de l'écran (une
   relecture de fond), et part avec le livre créé (`resetComp`). */

const DEPART = ['La définition au recto, le mot au verso', 'Des questions sur ce cours', '10 pages sur '];
const RETOUCHES = ['Inverse recto et verso', 'Plus courtes', 'Ajoute un exemple au verso', 'Enlève les doublons'];
const HIST = 12;                      // les messages d'avant rappelés à l'IA

const P = () => (comp.prompt = comp.prompt || { fil: [], cartes: [], texte: '', envoi: false });
const court = t => (t.length > 280 ? t.slice(0, 260).trimEnd() + ' …' : t);

function bulle(m) {
  if (m.qui === 'moi') return `<div class="pi-b moi">${esc(court(m.t))}</div>`;
  if (m.qui === 'err') return `<div class="pi-b err">${svg(I.warn)}<span>${esc(m.t)}</span></div>`;
  return `<div class="pi-b ia">${svg(I.spark)}<span>${esc(m.t)}</span></div>`;
}

function brouillon(p) {
  return `<div class="pi-br">
      <div class="pi-br-t"><b>${plur(p.cartes.length, 'page')}</b>
        <button type="button" class="lnk" data-pi="vider">${svg(I.x)}Effacer</button></div>
      <div class="pi-pages">${p.cartes.map((c, i) => `<div class="pi-p">
        <span class="a">${esc(c.f)}</span>${svg(I.arrow)}<span class="b">${esc(c.b)}</span>
        <button type="button" class="x" data-pi="moins" data-i="${i}" aria-label="Retirer la page">${svg(I.x)}</button></div>`).join('')}</div>
      <button type="button" class="pbtn pi-aj" data-pi="ajouter">${svg(I.plus)}<span>Ajouter ${plur(p.cartes.length, 'page')}</span></button>
    </div>`;
}

function dessiner(n) {
  const p = P(), puces = p.cartes.length ? RETOUCHES : DEPART;
  n.innerHTML = `
    <div class="pi-fil" aria-live="polite">${p.fil.map(bulle).join('')}${
      p.envoi ? '<div class="pi-b ia pi-attente" aria-label="L’IA écrit"><i></i><i></i><i></i></div>' : ''}</div>
    ${p.cartes.length ? brouillon(p) : ''}
    <div class="pi-puces">${puces.map((t, i) => `<button type="button" class="pi-puce"
      data-pi="${p.cartes.length ? 'retouche' : 'depart'}" data-i="${i}" ${p.envoi ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>
    <form class="pi-saisie" id="piform">
      <textarea id="pimsg" rows="2" aria-label="Ton message" placeholder="${p.cartes.length
        ? 'Une retouche : ajoute…, inverse…, enlève…' : 'Colle ton cours, ou dis ce que tu veux'}">${esc(p.texte)}</textarea>
      <button class="pi-env" type="submit" aria-label="Envoyer" ${p.envoi ? 'disabled' : ''}>${svg(I.arrow)}</button>
    </form>`;
  const fil = n.querySelector('.pi-fil');
  fil.scrollTop = fil.scrollHeight;
  const ta = n.querySelector('#pimsg');
  ajuster(ta);
}

const ajuster = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, innerHeight * .4) + 'px'; };

async function envoyer(n, ctx, message) {
  const p = P(), msg = String(message || '').trim();
  if (!msg || p.envoi || aiBusy) return;
  const hist = p.fil.filter(x => x.qui === 'moi').map(x => x.t.slice(0, 600)).slice(-HIST);
  p.fil.push({ qui: 'moi', t: msg }); p.envoi = true; p.texte = ''; setAiBusy(true);
  dessiner(n);
  try {
    const r = await aiCall({ op: 'prompt', message: msg, cards: p.cartes, historique: hist, hint: ctx.livre() }, true);
    p.cartes = r.cards;
    p.fil.push({ qui: 'ia', t: r.note || plur(r.cards.length, 'page') });
  } catch (x) {
    // rien de perdu : le message revient dans la zone, prêt à repartir
    const code = String(x.message);
    p.fil.pop(); p.texte = msg;
    p.fil.push({ qui: 'err', t: (code === 'mquota' && ctx.ferme()) || AIERR[code] || 'IA indisponible : réessaie dans un instant' });
  }
  p.envoi = false; setAiBusy(false);
  if (!n.isConnected) return;
  dessiner(n); ctx.onglets(); ctx.attendre(() => P().cartes);
  const ta = n.querySelector('#pimsg');
  if (ta && p.texte) ta.focus();
}

function agir(n, ctx, b) {
  const p = P(), k = b.dataset.pi, i = +b.dataset.i;
  if (k === 'depart') {
    // un début de consigne : il se complète (le cours, le sujet), il ne part pas seul
    const ta = n.querySelector('#pimsg');
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + DEPART[i];
    p.texte = ta.value; ajuster(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    return;
  }
  if (k === 'retouche') return envoyer(n, ctx, RETOUCHES[i]);
  if (k === 'moins') { p.cartes.splice(i, 1); dessiner(n); ctx.attendre(() => P().cartes); return; }
  if (k === 'vider') { Object.assign(p, { fil: [], cartes: [] }); dessiner(n); ctx.attendre(null); return; }
  if (k === 'ajouter') {
    const r = ctx.ajouter(p.cartes);
    p.cartes = [];
    toast(I.check, plur(r.n, 'page') + (r.ecartes ? ` · ${r.ecartes} déjà là` : ''));
    dessiner(n); ctx.attendre(null);
  }
}

/* `ctx` (ui/creation.js) : livre() — le nom du livre, indice pour l'IA ;
   ferme() — pourquoi l'IA est fermée à ce compte, s'il l'est ; attendre(f)
   — les pages en attente, que « Créer » prend aussi ; onglets() — repeindre
   le reste du mois ; ajouter(cartes) — les verser dans le livre. */
export function monter(n, ctx) {
  dessiner(n);
  if (P().cartes.length) ctx.attendre(() => P().cartes);
  n.onclick = e => { const b = e.target.closest('[data-pi]'); if (b && !b.disabled) agir(n, ctx, b); };
  n.oninput = e => { if (e.target.id === 'pimsg') { P().texte = e.target.value; ajuster(e.target); } };
  n.onsubmit = e => { e.preventDefault(); envoyer(n, ctx, n.querySelector('#pimsg').value); };
  // Ctrl+Entrée (Cmd sur Mac) envoie ; Entrée seule va à la ligne, comme un cours collé
  n.onkeydown = e => {
    if (e.target.id === 'pimsg' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(n, ctx, e.target.value); }
  };
}
