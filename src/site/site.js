/* La page d'accueil du site : ce qui bouge et ce qui répond. Le texte est
   tout entier dans index.html (les moteurs le lisent sans ce script) ;
   rien ici n'appelle la base : chaque bouton mène à l'app (/app), qui fait
   le reste. Les règles d'un code viennent du noyau (classe.js, defi.js),
   jamais réécrites ici. docs/LANDING.md. */
import { codeComplet, normCode } from '../classe.js';
import { pinComplet, pinDepuisTexte } from '../defi.js';
import { courbes, duree, versT } from './courbes.js';

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

/* ---------- le héros : la pile qu'on note soi-même ----------
   Encore et Difficile envoient la fiche à gauche, Correct et Facile à
   droite ; les suivantes avancent d'un rang. Tant que personne n'y touche,
   la pile se joue seule (à l'écran seulement) ; au premier geste, elle
   attend. Les quatre fiches du HTML sont recyclées : celle qui part revient
   au fond avec la fiche suivante de la liste. */
const PILE = [
  ['Histoire', '#A8483C', 'Prise de la Bastille', '14 juillet 1789'],
  ['SVT', '#2E7A86', 'Mitochondrie', 'Centrale énergétique de la cellule'],
  ['Anglais', '#3F7D55', 'to take for granted', 'tenir pour acquis'],
  ['Philosophie', '#8A3F6B', 'Critique de la raison pure', 'Kant, 1781'],
  ['Maths', '#2F5D8A', '∫ eˣ dx', 'eˣ + C'],
  ['Droit', '#5E4E8A', 'Article 1240', 'Responsabilité pour faute'],
  ['Géographie', '#6B7A2E', 'Capitale de la Norvège', 'Oslo'],
  ['Espagnol', '#B0475F', 'la madrugada', 'le petit matin'],
  ['Chimie', '#9A6512', 'pH de l’eau pure', '7, à 25 °C']
];
const NOTES = [
  { sens: -1, tour: -24, dans: 'Revient dans 1 min' },
  { sens: -1, tour: -13, dans: 'Revient demain' },
  { sens: 1, tour: 13, dans: 'Revient dans 4 jours' },
  { sens: 1, tour: 24, dans: 'Revient dans 9 jours' }
];
const SEULE = [2, 3, 0, 2, 1, 3];          // ce que la pile joue quand on la laisse faire

function essai() {
  const e = document.getElementById('essai');
  if (!e) return;
  const boutons = [...e.querySelectorAll('[data-note]')];
  const retour = e.querySelector('.essai-retour');
  /* `ordre` : les fiches de la pile, du dessus au fond. Celle qu'on note en
     sort tout de suite (on peut noter la suivante pendant qu'elle vole) et
     y revient par le fond, avec la fiche d'après, une fois partie. */
  const ordre = [...e.querySelectorAll('.carte')];
  let suivante = ordre.length, tour = 0, attente = false, auto = !reduit.matches, visible = false, minuteur = 0;
  const ranger = () => ordre.forEach((x, i) => { x.dataset.rang = String(Math.min(i, 3)); });
  const remplir = (c, i) => {
    const [m, couleur, recto, verso] = PILE[i % PILE.length];
    c.style.setProperty('--c', couleur);
    c.querySelectorAll('small').forEach(s => { s.textContent = m; });
    const b = c.querySelectorAll('b');
    b[0].textContent = recto; b[1].textContent = verso;
  };
  const dire = texte => {
    retour.textContent = texte;
    retour.classList.remove('montre');
    void retour.offsetWidth;               // relancer l'animation sur le même élément
    retour.classList.add('montre');
  };
  const appuyer = n => {
    boutons[n].classList.add('appuie');
    setTimeout(() => boutons[n].classList.remove('appuie'), 260);
  };

  function lancer(c, note) {
    ordre.shift();
    ranger();                              // les suivantes avancent d'un rang
    c.dataset.rang = 'part';
    c.classList.add('part');
    dire(note.dans);
    let vol = null;
    const fin = () => {
      c.classList.add('net');              // au fond, sans transition, avec la fiche d'après
      c.classList.remove('part', 'retournee');
      c.dataset.rang = '3';
      remplir(c, suivante++);
      void c.offsetWidth;
      if (vol) vol.cancel();               // l'envol gardait sa dernière image : elle s'efface, la fiche est déjà au fond
      c.classList.remove('net');
      ordre.push(c);
      ranger();
      planifier();
    };
    if (reduit.matches) return fin();
    const loin = Math.max(innerWidth, 900) * note.sens;
    vol = c.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${loin * .55}px,-70px) rotate(${note.tour}deg)`, opacity: 1, offset: .7 },
      { transform: `translate(${loin}px,-110px) rotate(${note.tour * 1.4}deg)`, opacity: 0 }
    ], { duration: 760, easing: 'cubic-bezier(.4,0,.7,.3)', fill: 'forwards' });
    vol.onfinish = fin;
  }

  /* Noter la fiche du dessus : on voit d'abord la réponse, puis elle part. */
  function noter(n) {
    if (attente || !ordre.length) return;
    clearTimeout(minuteur);
    const c = ordre[0];
    if (c.classList.contains('retournee') || reduit.matches) return lancer(c, NOTES[n]);
    attente = true;
    c.classList.add('retournee');
    setTimeout(() => { attente = false; lancer(c, NOTES[n]); }, 380);
  }

  function planifier() {
    clearTimeout(minuteur);
    if (!auto || !visible || attente || ordre.length < 4) return;
    minuteur = setTimeout(() => {
      ordre[0].classList.add('retournee');
      minuteur = setTimeout(() => { const n = SEULE[tour++ % SEULE.length]; appuyer(n); noter(n); }, 1500);
    }, 1400);
  }

  const prendreLaMain = () => { auto = false; clearTimeout(minuteur); e.classList.add('joue'); };
  boutons.forEach(b => b.addEventListener('click', () => { prendreLaMain(); noter(+b.dataset.note); }));
  e.querySelector('.essai-pile').addEventListener('click', () => {
    if (attente || !ordre.length) return;
    prendreLaMain();
    ordre[0].classList.toggle('retournee');
  });
  vu(e, x => { visible = x.isIntersecting; if (visible) planifier(); else clearTimeout(minuteur); }, { threshold: .4 });
}

/* ---------- le moteur : un an de mémoire, à parcourir du doigt ----------
   Les courbes viennent de courbes.js. À l'arrivée, la tête de lecture
   traverse l'année et les chiffres suivent ; ensuite, la souris ou le
   doigt la promènent. */
const pct = r => Math.round(r * 100) + ' %';

function moteur() {
  const fig = document.getElementById('courbe');
  if (!fig) return;
  const trace = fig.querySelector('.trace'), svg = trace.querySelector('svg');
  const c = courbes();
  const traits = (sel, ds) => { svg.querySelector(sel).innerHTML = ds.map(d => `<path d="${d}"/>`).join(''); };
  traits('.sans-g', c.sans); traits('.lueur-g', c.avec); traits('.avec-g', c.avec);
  svg.querySelector('.aire').setAttribute('d', c.aire);
  const points = trace.querySelector('.points');
  points.innerHTML = c.revisions.map(x => `<i style="--x:${x.toFixed(4)}"></i>`).join('');
  const pts = [...points.children];
  const voile = svg.querySelector('#revele rect');
  const lecture = trace.querySelector('.lecture');
  const avec = fig.querySelector('.leg-avec b'), sans = fig.querySelector('.leg-sans b');
  const temps = fig.querySelector('.courbe-temps');
  let image = 0;

  const poser = x => {
    x = Math.min(1, Math.max(0, x));
    const r = c.lire(x);
    voile.setAttribute('width', (x * 1000).toFixed(1));
    lecture.style.setProperty('--x', x.toFixed(4));
    lecture.style.setProperty('--ya', (1 - r.avec).toFixed(4));
    lecture.style.setProperty('--ys', (1 - r.sans).toFixed(4));
    avec.textContent = pct(r.avec);
    sans.textContent = pct(r.sans);
    temps.textContent = duree(versT(x));
    pts.forEach((p, i) => p.classList.toggle('vu', c.revisions[i] <= x + 1e-9));
  };
  /* de là où on est jusqu'à `vers`, en `ms` millisecondes */
  let ici = 0;
  const glisser = (vers, ms) => {
    cancelAnimationFrame(image);
    if (reduit.matches || ms <= 0) { ici = vers; return poser(vers); }
    const de = ici, t0 = performance.now();
    const pas = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      ici = de + (vers - de) * e;
      poser(ici);
      if (k < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
  };
  poser(0);
  vu(fig, (e, io) => {
    if (!e.isIntersecting) return;
    io.unobserve(fig);
    glisser(1, 4600);
  }, { threshold: .45 });

  const sous = ev => {
    const r = trace.getBoundingClientRect();
    cancelAnimationFrame(image);
    ici = (ev.clientX - r.left) / r.width;
    poser(ici);
  };
  trace.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse' || ev.buttons) sous(ev); });
  trace.addEventListener('pointerdown', sous);
  trace.addEventListener('pointerleave', () => glisser(1, 900));
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

/* ---------- Folio Campus : un espace par rôle ----------
   Chaque rôle est un onglet : il montre son écran, et « Essayer cet
   espace » mène à la démo dans ce rôle. */
function onglets() {
  const o = document.querySelector('.roles');
  if (!o) return;
  const essayer = document.getElementById('essai-espace');
  const choisir = b => {
    o.querySelectorAll('[role="tab"]').forEach(x => {
      const oui = x === b;
      x.setAttribute('aria-selected', String(oui));
      x.tabIndex = oui ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !oui;
    });
    if (essayer) essayer.href = b.dataset.demo;
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
  essai();
  moteur();
  calendrier();
  videos();
  onglets();
  tarifs();
  fenetreCode();
}

demarrer();
