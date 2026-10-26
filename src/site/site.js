/* La page d'accueil du site : ce qui bouge et ce qui répond. Le texte est
   tout entier dans index.html (les moteurs le lisent sans ce script) ;
   rien ici n'appelle la base : chaque bouton mène à l'app (/app), qui fait
   le reste. Les règles d'un code viennent du noyau (classe.js, defi.js),
   jamais réécrites ici. docs/LANDING.md. */
import { codeComplet, normCode } from '../classe.js';
import { pinComplet, pinDepuisTexte } from '../defi.js';

const doc = document.documentElement;
const reduit = matchMedia('(prefers-reduced-motion: reduce)');
const vu = (el, fn, opts) => {
  const io = new IntersectionObserver(es => es.forEach(e => fn(e, io)), opts);
  (el.length === undefined ? [el] : el).forEach(x => io.observe(x));
};

/* ---------- les apparitions, une seule fois ---------- */
function apparitions() {
  vu(document.querySelectorAll('.rv'), (e, io) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('vu');
    io.unobserve(e.target);
  }, { rootMargin: '0px 0px -10% 0px', threshold: .1 });
}

/* Ce qui tourne en boucle s'arrête hors de l'écran (batterie d'un
   téléphone, ventilateur d'un portable). */
function sommeil() {
  vu(document.querySelectorAll('.heros, .matieres, .bento .tuile, .campus, .fin'),
    e => e.target.classList.toggle('dort', !e.isIntersecting), { rootMargin: '120px 0px' });
}

/* ---------- l'en-tête et le menu du téléphone ---------- */
function entete() {
  const t = document.getElementById('tete');
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
  addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) ouvrir(false); });
}

/* ---------- la scène se redresse à mesure qu'on descend ---------- */
function scene() {
  const s = document.getElementById('scene');
  if (!s) return;
  if (reduit.matches) { s.style.setProperty('--p', '1'); return; }
  let dedans = false, image = 0;
  const poser = () => {
    image = 0;
    const r = s.getBoundingClientRect(), h = innerHeight;
    const p = Math.min(1, Math.max(0, (h - r.top) / (h * .8)));
    s.style.setProperty('--p', p.toFixed(3));
  };
  vu(s, e => { dedans = e.isIntersecting; if (dedans) poser(); });
  addEventListener('scroll', () => { if (dedans && !image) image = requestAnimationFrame(poser); }, { passive: true });
  addEventListener('resize', poser, { passive: true });
  poser();
}

/* ---------- le journal : quatorze semaines qui s'allument ---------- */
function calendrier() {
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
function videos() {
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

/* ---------- les radios et les onglets au clavier ---------- */
function auClavier(groupe, sel, choisir) {
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

/* ---------- Folio Campus : professeur ou référent ---------- */
function onglets() {
  const o = document.querySelector('.onglets');
  if (!o) return;
  const choisir = b => {
    o.dataset.actif = b.dataset.onglet;
    o.querySelectorAll('[role="tab"]').forEach(x => {
      const oui = x === b;
      x.setAttribute('aria-selected', String(oui));
      x.tabIndex = oui ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !oui;
    });
    const v = document.querySelector(`#${b.getAttribute('aria-controls')} video[src]`);
    if (v && !reduit.matches) v.play().catch(() => { /* lecture refusée : l'affiche reste */ });
  };
  o.addEventListener('click', e => { const b = e.target.closest('[role="tab"]'); if (b) choisir(b); });
  auClavier(o, '[role="tab"]', choisir);
}

/* ---------- les tarifs : au mois ou à l'année ---------- */
function tarifs() {
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
    t.querySelectorAll('[data-an][data-mois]').forEach(el => {
      el.classList.remove('roule');
      void el.offsetWidth;                 // relancer l'animation sur le même élément
      el.innerHTML = el.dataset[p === 'an' ? 'an' : 'mois'];
      el.classList.add('roule');
    });
  };
  g.querySelectorAll('[role="radio"]').forEach(x => { x.tabIndex = x.getAttribute('aria-checked') === 'true' ? 0 : -1; });
  g.addEventListener('click', e => { const b = e.target.closest('[role="radio"]'); if (b) choisir(b); });
  auClavier(g, '[role="radio"]', choisir);
  // les lignes du tableau arrivent l'une après l'autre
  t.querySelectorAll('.comparatif tbody tr').forEach((r, i) => r.style.setProperty('--i', String(i)));
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

function fenetreCode() {
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

function demarrer() {
  doc.classList.add('pret');
  apparitions();
  sommeil();
  entete();
  scene();
  calendrier();
  videos();
  onglets();
  tarifs();
  fenetreCode();
}

demarrer();
