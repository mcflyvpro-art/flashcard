/* La Mirandola Academy (/academie) : le catalogue est écrit au build
   (src/site/academie.js) ; ce script ne fait que choisir l'écran (téléphone,
   ordinateur ou tous) et ouvrir le lecteur d'un tuto qui a sa vidéo. Le
   reste de la page (en-tête, apparitions, « J'ai un code ») est à page.js. */
import { auClavier } from './commun.js';

/* ---------- le choix de l'écran ---------- */
function ecrans() {
  const filtre = document.querySelector('.ac-filtre');
  if (!filtre) return;
  const boutons = [...filtre.querySelectorAll('[role="radio"]')];
  const choisir = b => {
    boutons.forEach(x => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    const e = b.dataset.ecran;
    document.querySelectorAll('.ac-grille>li').forEach(li => {
      li.hidden = Boolean(e) && !li.firstElementChild.dataset.ecrans.split(' ').includes(e);
    });
    /* un rôle sans tuto pour cet écran se tait (aujourd'hui, aucun) */
    document.querySelectorAll('.ac-role').forEach(r => { r.hidden = !r.querySelector('.ac-grille>li:not([hidden])'); });
  };
  boutons.forEach(x => { x.tabIndex = x.getAttribute('aria-checked') === 'true' ? 0 : -1; });
  filtre.addEventListener('click', ev => { const b = ev.target.closest('[role="radio"]'); if (b) choisir(b); });
  auClavier(filtre, '[role="radio"]', choisir);
  filtre.hidden = false;
}

/* ---------- le lecteur ---------- */
function lecteur() {
  const d = document.getElementById('ac-lecteur');
  if (!d) return;
  const v = d.querySelector('video');
  document.addEventListener('click', ev => {
    const b = ev.target.closest('.ac-carte[data-video]');
    if (!b) return;
    v.poster = b.dataset.affiche || '';
    v.src = b.dataset.video;
    d.showModal();
    v.play().catch(() => { /* lecture refusée sans geste : les commandes restent là */ });
  });
  const fermer = () => { v.pause(); v.removeAttribute('src'); v.load(); };
  d.querySelector('[data-fermer]').addEventListener('click', () => d.close());
  d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
  d.addEventListener('close', fermer);
}

ecrans();
lecteur();
