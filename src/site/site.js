/* La page d'accueil du site : ce qui bouge et ce qui répond. Le texte est
   tout entier dans index.html (les moteurs le lisent sans ce script) ;
   rien ici n'appelle la base : chaque bouton mène à l'app (/app), qui fait
   le reste. Les règles d'un code viennent du noyau (classe.js, defi.js),
   jamais réécrites ici. docs/LANDING.md. */
import { courbes, duree, versT } from './courbes.js';
import { apparitions, calendrier, doc, entete, fenetreCode, onglets, reduit, sommeil, tarifs, videos, vu } from './commun.js';

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
   au fond avec la fiche suivante de la liste. Chaque matière a sa teinte du
   nuancier de l'app (data-teinte, src/couleurs.js), la même partout sur la
   page ; les délais sont ceux qu'affiche l'app pour une page déjà lue. */
const PILE = [
  ['Histoire', 'yellow', 'Prise de la Bastille', '14 juillet 1789'],
  ['SVT', 'green', 'Mitochondrie', 'Centrale énergétique de la cellule'],
  ['Anglais', 'red', 'to take for granted', 'tenir pour acquis'],
  ['Philosophie', 'purple', 'Critique de la raison pure', 'Kant, 1781'],
  ['Maths', 'blue', '∫ eˣ dx', 'eˣ + C'],
  ['Droit', 'indigo', 'Article 1240', 'Responsabilité pour faute'],
  ['Géographie', 'lime', 'Capitale de la Norvège', 'Oslo'],
  ['Espagnol', 'orange', 'la madrugada', 'le petit matin'],
  ['Chimie', 'teal', 'pH de l’eau pure', '7, à 25 °C']
];
const NOTES = [
  { sens: -1, tour: -24, dans: 'Revient dans 10 min' },
  { sens: -1, tour: -13, dans: 'Revient dans 2 jours' },
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
    const [m, teinte, recto, verso] = PILE[i % PILE.length];
    c.dataset.teinte = teinte;
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
  traits('.sans-g', c.sans); traits('.lite-g', c.lite); traits('.lueur-g', c.avec); traits('.avec-g', c.avec);
  svg.querySelector('.aire').setAttribute('d', c.aire);
  const points = trace.querySelector('.points');
  points.innerHTML = c.revisions.map(x => `<i style="--x:${x.toFixed(4)}"></i>`).join('');
  const pts = [...points.children];
  const voile = svg.querySelector('#revele rect');
  const lecture = trace.querySelector('.lecture');
  const avec = fig.querySelector('.leg-avec b'), lite = fig.querySelector('.leg-lite b'), sans = fig.querySelector('.leg-sans b');
  const temps = fig.querySelector('.courbe-temps');
  let image = 0;

  const poser = x => {
    x = Math.min(1, Math.max(0, x));
    const r = c.lire(x);
    voile.setAttribute('width', (x * 1000).toFixed(1));
    lecture.style.setProperty('--x', x.toFixed(4));
    lecture.style.setProperty('--ya', (1 - r.avec).toFixed(4));
    lecture.style.setProperty('--ys', (1 - r.sans).toFixed(4));
    lecture.style.setProperty('--yl', (1 - r.lite).toFixed(4));
    avec.textContent = pct(r.avec);
    lite.textContent = pct(r.lite);
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
