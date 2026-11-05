/* Ce que toutes les pages du site partagent (2026-11-02, le site passe à
   plusieurs pages, docs/SEO.md) : les apparitions au défilement, l'en-tête
   et son menu du téléphone, « J'ai un code », la bascule des tarifs et le
   offres. La page d'accueil (site.js) y ajoute ses scènes,
   les autres pages (page.js) s'en tiennent là. Chaque fonction ne fait
   rien si sa partie de la page n'est pas là. Aucun appel à la base. */
import { codeComplet, normCode } from '../classe.js';
import { pinComplet, pinDepuisTexte } from '../defi.js';

export const doc = document.documentElement;
export const reduit = matchMedia('(prefers-reduced-motion: reduce)');
export const vu = (el, fn, opts) => {
  const io = new IntersectionObserver(es => es.forEach(e => fn(e, io)), opts);
  (el.length === undefined ? [el] : el).forEach(x => io.observe(x));
};

/* ---------- les apparitions, une seule fois ---------- */
export function apparitions() {
  vu(document.querySelectorAll('.rv'), (e, io) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('vu');
    io.unobserve(e.target);
  }, { rootMargin: '0px 0px -10% 0px', threshold: .1 });
}

/* ---------- l'en-tête et le menu du téléphone ---------- */
export function entete() {
  const t = document.getElementById('tete');
  if (!t) return;
  const b = t.querySelector('.burger'), m = document.getElementById('menu-mobile');
  const colle = () => t.classList.toggle('colle', scrollY > 8);
  addEventListener('scroll', colle, { passive: true });
  colle();
  const ouvrir = o => {
    m.hidden = !o;
    b.setAttribute('aria-expanded', String(o));
    b.setAttribute('aria-label', o ? 'Fermer le menu' : 'Ouvrir le menu');
    t.classList.toggle('colle', o || scrollY > 8);
  };
  b.addEventListener('click', () => ouvrir(m.hidden));
  m.addEventListener('click', e => { if (e.target.closest('a,button')) ouvrir(false); });
  /* Les deux menus de l'ordinateur : la souris les ouvre au survol (CSS) ;
     le toucher et le clavier par leur bouton. Un clic ailleurs, Échap ou le
     focus qui s'en va les referment. */
  const groupes = [...t.querySelectorAll('.nav-groupe')];
  const fermer = (sauf = null) => groupes.forEach(g => {
    if (g === sauf) return;
    g.classList.remove('ouvert');
    g.querySelector('.nav-bouton').setAttribute('aria-expanded', 'false');
  });
  groupes.forEach(g => {
    const bt = g.querySelector('.nav-bouton');
    bt.addEventListener('click', () => {
      const o = !g.classList.contains('ouvert');
      fermer(g);
      g.classList.toggle('ouvert', o);
      bt.setAttribute('aria-expanded', String(o));
    });
    g.addEventListener('focusout', e => { if (!g.contains(e.relatedTarget)) fermer(); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.nav-groupe')) fermer(); });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!m.hidden) ouvrir(false);
    const g = groupes.find(x => x.classList.contains('ouvert'));
    if (g) { fermer(); g.querySelector('.nav-bouton').focus(); }
  });
}

/* ---------- les radios et les onglets au clavier ---------- */
export function auClavier(groupe, sel, choisir) {
  groupe.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!k) return;
    const bs = [...groupe.querySelectorAll(sel)];
    const i = (bs.indexOf(document.activeElement) + k + bs.length) % bs.length;
    e.preventDefault();
    bs[i].focus();
    choisir(bs[i]);
  });
}

/* ---------- les tarifs : au mois ou à l'année ---------- */
export function tarifs() {
  const t = document.getElementById('tarifs');
  if (!t) return;
  const g = t.querySelector('.bascule');
  const choisir = b => {
    const p = b.dataset.periode;
    if (t.dataset.periode === p) return;
    t.dataset.periode = p;
    g.querySelectorAll('[role="radio"]').forEach(x => {
      x.setAttribute('aria-checked', String(x === b));
      x.tabIndex = x === b ? 0 : -1;
    });
    relierVente(t);
    t.querySelectorAll('[data-an][data-mois]').forEach(el => {
      el.classList.remove('roule');
      void el.offsetWidth;                 // relancer l'animation sur le même élément
      el.innerHTML = el.dataset[p === 'an' ? 'an' : 'mois'];
      el.classList.add('roule');
    });
  };
  g.querySelectorAll('[role="radio"]').forEach(x => { x.tabIndex = x.getAttribute('aria-checked') === 'true' ? 0 : -1; });
  relierVente(t);
  g.addEventListener('click', e => { const b = e.target.closest('[role="radio"]'); if (b) choisir(b); });
  auClavier(g, '[role="radio"]', choisir);
  // les lignes du tableau arrivent l'une après l'autre
  t.querySelectorAll('.comparatif tbody tr').forEach((r, i) => r.style.setProperty('--i', String(i)));
}

/* La vente ouverte (VENTE_OUVERTE de src/abonnement.js, et dans
   index.html les adresses data-vente-an et data-vente-mois du bouton),
   « Passer à Mirandola+ » mène à l'écran Mirandola+ de l'app, la formule choisie
   ici déjà cochée ; sans session, elle attend la connexion
   (ui/plus-porte.js). D'ici là, le bouton n'a pas ces adresses et mène à
   l'inscription. Le module n'est pas importé ici : partagé avec le
   démarrage de l'app, il ferait charger à la page d'accueil un morceau
   commun bien plus gros (test/site.test.js garde les deux d'accord). */
function relierVente(t) {
  const mois = t.dataset.periode === 'mois';
  // un code des réseaux (mirandola.fr/?promo=LANCEMENT) suit jusqu'à la page de paiement
  const promo = (/[?&]promo=([A-Za-z0-9]{1,30})/.exec(location.search) || [])[1];
  t.querySelectorAll('[data-vente-an][data-vente-mois]').forEach(a => {
    a.href = (mois ? a.dataset.venteMois : a.dataset.venteAn) + (promo ? '&promo=' + promo : '');
  });
}

/* ---------- « J'ai un code » ----------
   Une classe, un établissement ou un professeur particulier : 8 signes
   (classe.js) ; une partie en direct : 6 chiffres (defi.js) ; un club :
   8 signes du même alphabet. Le code part dans l'adresse de l'app, qui le
   garde le temps de la connexion (ui/liens-entrants.js). */
const SORTES = {
  classe: { lire: normCode, juste: codeComplet, aller: c => '/app?rejoindre=' + c,
    aide: '8 lettres ou chiffres, comme ABCD 2345.', modele: 'ABCD 2345' },
  defi: { lire: pinDepuisTexte, juste: pinComplet, aller: c => '/app?defi=' + c,
    aide: '6 chiffres, comme 482 913.', modele: '482 913' },
  club: { lire: normCode, juste: codeComplet, aller: c => '/app?club=' + c,
    aide: 'Le code du club : 8 lettres ou chiffres.', modele: 'ABCD 2345' }
};
const lisible = (sorte, c) => (sorte === 'defi'
  ? (c.length > 3 ? c.slice(0, 3) + ' ' + c.slice(3) : c)
  : (c.length > 4 ? c.slice(0, 4) + ' ' + c.slice(4) : c));

export function fenetreCode() {
  const d = document.getElementById('fenetre-code');
  if (!d || typeof d.showModal !== 'function') return;
  const f = d.querySelector('form'), champ = d.querySelector('#code-champ'), err = d.querySelector('#code-erreur');
  const types = d.querySelector('.code-types');
  let sorte = 'classe';
  const choisir = b => {
    sorte = b.dataset.type;
    types.querySelectorAll('[role="radio"]').forEach(x => {
      x.setAttribute('aria-checked', String(x === b));
      x.tabIndex = x === b ? 0 : -1;
    });
    champ.placeholder = SORTES[sorte].modele;
    err.textContent = '';
    mettreEnForme();
  };
  const bouton = t => types.querySelector(`[data-type="${t}"]`);
  const mettreEnForme = () => {
    const brut = champ.value;
    // six chiffres tapés : c'est une partie ; une lettre : c'est un code de classe
    if (sorte === 'classe' && /^\d{6}$/.test(brut.replace(/\s/g, ''))) return choisir(bouton('defi'));
    if (sorte === 'defi' && /[a-z]/i.test(brut)) return choisir(bouton('classe'));
    const c = SORTES[sorte].lire(brut);
    const l = lisible(sorte, c);
    if (l !== brut) champ.value = l;
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-code]')) return;
    e.preventDefault();
    err.textContent = '';
    d.showModal();
    setTimeout(() => champ.focus(), 60);
  });
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-fermer]')) d.close();
  });
  types.addEventListener('click', e => { const b = e.target.closest('[role="radio"]'); if (b) { choisir(b); champ.focus(); } });
  auClavier(types, '[role="radio"]', choisir);
  champ.addEventListener('input', () => { err.textContent = ''; mettreEnForme(); });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const s = SORTES[sorte], c = s.lire(champ.value);
    if (!s.juste(c)) {
      err.textContent = s.aide;
      champ.classList.remove('secoue');
      void champ.offsetWidth;              // relancer l'animation
      champ.classList.add('secoue');
      champ.focus();
      return;
    }
    location.href = s.aller(c);
  });
}

/* Ce qui tourne en boucle s'arrête hors de l'écran (batterie d'un
   téléphone, ventilateur d'un portable). */
export function sommeil() {
  vu(document.querySelectorAll('.heros, .matieres, .bento .tuile, .tuile, .campus, .fin, .p-nuit'),
    e => e.target.classList.toggle('dort', !e.isIntersecting), { rootMargin: '120px 0px' });
}

/* ---------- le calendrier du journal : des jours plus ou moins pleins ---------- */
export function calendrier() {
  const c = document.querySelector('.calendrier');
  if (!c) return;
  let graine = 7;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const cases = [];
  for (let i = 0; i < 98; i++) {
    // plus on approche d'aujourd'hui, plus les jours sont pleins
    const n = hasard() < .12 + i / 140 ? Math.min(4, 1 + Math.floor(hasard() * (1 + i / 30))) : 0;
    cases.push(`<i data-n="${n}" style="--d:${(i * 14).toFixed(0)}ms"></i>`);
  }
  c.innerHTML = cases.join('');
}

/* ---------- les vidéos : chargées et jouées seulement à l'écran ---------- */
export function videos() {
  const vs = [...document.querySelectorAll('video[data-src]')].filter(v => v.dataset.src);
  if (!vs.length) return;
  vu(vs, e => {
    const v = e.target;
    if (!e.isIntersecting || v.closest('[hidden]')) { v.pause(); return; }
    if (!v.getAttribute('src')) {
      v.hidden = false;
      v.addEventListener('playing', () => v.closest('.ecran').classList.add('joue'), { once: true });
      v.src = v.dataset.src;
    }
    if (!reduit.matches) v.play().catch(() => { /* lecture refusée (économie d'énergie) : l'affiche reste */ });
  }, { threshold: .3 });
}

/* ---------- Mirandola Campus : un espace par rôle ----------
   Chaque rôle est un onglet : il montre son écran sur l'ordinateur, le
   même au téléphone posé à côté (`data-onglet`), et « Essayer cet
   espace » mène à la démo dans ce rôle. Un rôle sans écran de téléphone
   (le référent, dont la console est faite pour l'ordinateur) range le
   téléphone. */
export function onglets() {
  const o = document.querySelector('.roles');
  if (!o) return;
  const essayer = document.getElementById('essai-espace');
  const tel = document.getElementById('tel-campus');
  const choisir = b => {
    const id = b.getAttribute('aria-controls');
    o.querySelectorAll('[role="tab"]').forEach(x => {
      const oui = x === b;
      x.setAttribute('aria-selected', String(oui));
      x.tabIndex = oui ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !oui;
    });
    document.querySelectorAll('[data-onglet]').forEach(x => { x.hidden = x.dataset.onglet !== id; });
    if (tel) tel.classList.toggle('range', !tel.querySelector(`[data-onglet="${id}"]`));
    if (essayer) essayer.href = b.dataset.demo;
    if (!reduit.matches) document.querySelectorAll(`#${id} video[src], [data-onglet="${id}"] video[src]`)
      .forEach(v => v.play().catch(() => { /* lecture refusée : l'affiche reste */ }));
  };
  o.addEventListener('click', e => { const b = e.target.closest('[role="tab"]'); if (b) choisir(b); });
  auClavier(o, '[role="tab"]', choisir);
}
