// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { cercle, setAnimate, setMenu, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { rejoindreSalle } from '../core/cercle.js';
import { messageSalle } from '../defi.js';
import { clubOuvert, clubPull } from './club-porte.js';
import { ouvrirProfil } from './cercle.js';
import { ouvrirDefi } from './defi-porte.js';
import { ouvrirDirect } from './direct-porte.js';
import { toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
import { ouvrirCode } from './code-porte.js';

/* ══════════ la porte des feuilles du cercle (2026-11-18) ══════════
   Les feuilles de « Mes amis » et d'un club — mon jeton, créer ou
   personnaliser un club, l'inviter, ses options, un membre — arrivent à la
   demande (ui/cercle-feuilles.js + cercle-feuilles.css) : on ne les ouvre
   qu'en touchant un bouton. Ici, au démarrage, ne restent que les gestes qui
   mènent ailleurs (un club, un défi, une partie, un code, un profil) : ils
   ne doivent jamais attendre un morceau. Le reste de `[data-cc]` charge les
   feuilles puis rejoue le geste ; une fois là, elles écoutent elles-mêmes.
   Rien d'autre ne doit importer ui/cercle-feuilles.js. */
let mod = null, demande = null;
export const chargerFeuilles = () => demande || (demande = import('./cercle-feuilles.js')
  .then(m => (mod = m))
  .catch(e => { demande = null; throw e; }));

const repeint = () => { setAnimate(false); render(); };

// les gestes de « Nouveau défi » (dn-…) sont écoutés par son morceau (ui/defi-nouveau.js)
const GESTES = {
  defi: (id, b) => {
    const r = view.name === 'club' ? { name: 'club', id: view.id } : { name: view.name === 'friends' ? 'friends' : 'commu' };
    closeMenu();
    ouvrirDefi({ ou: b.dataset.ou || null, mode: b.dataset.mode || 'direct', livre: b.dataset.livre || null, retour: r });
  },
  // une partie, un club, un paquet, une classe, un ami : un seul champ (ui/code-entree.js)
  pin: () => ouvrirCode(),
  'club-rejoindre': () => ouvrirCode(),
  salle: async (id, b) => {
    if (b.dataset.dedans) return ouvrirDirect(id);
    const r = await rejoindreSalle(b.dataset.pin);
    if (r.statut === 'ok' || r.statut === 'hote') return ouvrirDirect(r.salle);
    toast(I.x, messageSalle(r.statut) || 'Impossible d’entrer');
  },
  tous: () => { cercle.tous = !cercle.tous; repeint(); },
  club: id => { cercle.onglet = 'defis'; clubPull(id); go('club', id); },
  onglet: k => { cercle.onglet = k; const p = document.querySelector('.cl'); if (p) p.dataset.onglet = k;
    document.querySelectorAll('.cl-tabs button').forEach(x => { x.classList.toggle('on', x.dataset.id === k); x.setAttribute('aria-selected', x.dataset.id === k); }); },
  // toucher un membre ouvre son profil ; le chef y retrouve « Retirer du club »
  membre: id => { const g = clubOuvert(); cercle.membre = id; ouvrirProfil(id, { club: g && g.id }); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-cc]');
  if (!b || b.disabled) return;
  const k = b.dataset.cc, f = GESTES[k];
  if (f) { e.preventDefault(); f(b.dataset.id, b); return; }
  if (mod || k.startsWith('dn-')) return;
  e.preventDefault();
  chargerFeuilles().then(m => m.agir(b), () => toast(I.x, 'Impossible hors ligne pour l’instant'));
});

export function paintMenuCercle(w) {
  if (mod) return mod.paintMenuCercle(w);
  setMenu(null);
}
