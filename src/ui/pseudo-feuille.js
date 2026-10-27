// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { compte, me, menu, online, setAnimate } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { changerPseudo, pseudoLibre } from '../core/reglages-corbeille.js';
import { MAX, message, motif, saisie } from '../pseudo.js';
import { render } from './bibliotheque.js';
import { isPupil } from './classement.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu } from './menus-a.js';
import './pseudo.css';

/* ══════════ changer son pseudo (2026-10-27) ══════════
   Chargée par ui/pseudo-porte.js. La règle s'applique pendant la frappe
   (src/pseudo.js, la même que la base) ; dès qu'elle passe, la base dit si
   la place est libre (`pseudo_libre`) et propose une variante sinon.
   Enregistrer passe par `changer_pseudo`, qui tranche. Le champ ne repeint
   jamais la feuille où l'on tape : seuls la ligne du verdict et le bouton
   changent. Un élève d'établissement voit aussi son nom de classe, qui ne
   bouge pas : son pseudo sert hors de la classe (amis, défis). */

const e = { valeur: '', statut: '', suggestion: '', jusqua: '', envoi: false, jeton: 0 };
let attente = 0;

const actuel = () => (me && me.handle) || '';

export function preparer() {
  Object.assign(e, { valeur: actuel(), statut: actuel() ? 'meme' : '', suggestion: '', jusqua: '', envoi: false });
}

const pret = () => e.statut === 'ok' && !e.envoi;

const date = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

function verdictHtml() {
  if (e.statut === 'ok') return `<span class="ps-libre">${svg(I.check)}Libre</span>`;
  if (e.statut === 'verif') return '<span class="ps-verif">…</span>';
  if (!e.statut || (e.statut === 'meme' && e.valeur === actuel())) return '<span>3 à 20 caractères · a-z 0-9 . _</span>';
  const txt = e.statut === 'trop' && e.jusqua ? `${message('trop')} · à nouveau le ${date(e.jusqua)}` : message(e.statut);
  return `<span class="ps-non">${esc(txt)}</span>${e.suggestion
    ? `<button class="ps-sug" data-ps="sug">@${esc(e.suggestion)}</button>` : ''}`;
}

/* La ligne du verdict et le bouton, sur place. */
function poser() {
  const v = document.getElementById('psv'); if (v) v.innerHTML = verdictHtml();
  const b = document.getElementById('psok'); if (b) b.disabled = !pret();
}

export function peindre(w) {
  const nomClasse = isPupil() && compte && compte.nom;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu ps">
      <div class="mhd">${svg(I.user)}<span class="mhx"><b>Ton pseudo</b>${actuel() ? `<i>@${esc(actuel())}</i>` : ''}</span></div>
      ${nomClasse ? `<p class="ps-nom">${svg(I.lock)}<span>En classe : <b>${esc(compte.nom)}</b></span></p>` : ''}
      <div class="fld addf ps-champ"><span class="at">@</span><input id="hq" data-ps="champ" value="${esc(e.valeur)}"
        maxlength="${MAX}" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        aria-label="Ton pseudo" aria-describedby="psv"></div>
      <p class="ps-v" id="psv" aria-live="polite">${verdictHtml()}</p>
      <button class="cta ps-ok" data-ps="ok" id="psok" ${pret() ? '' : 'disabled'}>${svg(I.check)}Enregistrer</button>
    </div>`;
  mountMenu(w);
  /* le curseur en fin de pseudo — sauf si l'on tape déjà dans le champ : le
     replacer couperait une sélection en cours, et la frappe s'ajouterait au
     pseudo actuel au lieu de le remplacer */
  setTimeout(() => {
    const i = document.getElementById('hq');
    if (i && document.activeElement !== i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }, 80);
}

/* La règle d'abord, ici ; la place ensuite, à la base — la dernière frappe
   seulement (`jeton`), 300 ms après. */
function verifier(v) {
  e.valeur = v; e.suggestion = ''; e.jusqua = '';
  const m = motif(v), jeton = ++e.jeton;
  clearTimeout(attente);
  e.statut = m !== 'ok' ? (v ? m : '') : v === actuel() ? 'meme' : online ? 'verif' : 'hors_ligne';
  poser();
  if (e.statut !== 'verif') return;
  attente = setTimeout(async () => {
    const r = await pseudoLibre(v);
    if (jeton !== e.jeton) return;
    e.statut = r.statut || 'erreur'; e.suggestion = r.suggestion || '';
    poser();
  }, 300);
}

async function enregistrer() {
  if (!pret()) return;
  e.envoi = true; poser();
  const r = await changerPseudo(e.valeur);
  e.envoi = false;
  if (r.statut === 'ok') {
    closeMenu(); toast(I.check, '@' + r.pseudo);
    setAnimate(false); render();
    return;
  }
  e.statut = r.statut || 'erreur'; e.suggestion = r.suggestion || ''; e.jusqua = r.jusqua || '';
  poser();
}

document.addEventListener('input', ev => {
  const n = ev.target.closest && ev.target.closest('[data-ps="champ"]');
  if (!n || menu !== 'handle') return;
  const v = saisie(n.value);
  if (n.value !== v) n.value = v;
  verifier(v);
});

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-ps]');
  if (!b || b.disabled || menu !== 'handle') return;
  if (b.dataset.ps === 'ok') { ev.preventDefault(); enregistrer(); }
  if (b.dataset.ps === 'sug') {
    ev.preventDefault();
    const i = document.getElementById('hq');
    if (i) { i.value = e.suggestion; i.focus(); }
    verifier(e.suggestion);
  }
});

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || menu !== 'handle' || !ev.target.closest || !ev.target.closest('[data-ps="champ"]')) return;
  ev.preventDefault();
  enregistrer();
});
