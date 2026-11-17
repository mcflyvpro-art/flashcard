/* ══════════ la page d'un lien partagé (2026-11-16, code.html) ══════════
   Demandé : « comme c'est une PWA, la redirection ne marche pas : le lien
   doit juste mener à une page où copier le code et qui dit où le mettre
   dans l'app, sur PC et sur mobile ». Une app posée sur l'écran d'accueil
   d'un iPhone ne s'ouvre jamais d'un lien : il s'ouvre dans Safari, qui
   n'a ni l'app ni sa session. L'aiguillage d'index.html mène ici tout lien
   de code ouvert dans un navigateur (`?club=`, `?defi=`, `?rejoindre=`,
   `?ami=`, `#s=`) ; dans l'app (l'icône, l'app native), on repart à /app,
   qui s'en charge.

   Le code en grand, « Copier le code », puis les trois gestes : ouvrir
   Mirandola, Mes amis › « Entrer un code » (ui/code-entree.js reconnaît
   tous les codes), coller. Sur ordinateur, « Ouvrir dans Mirandola » ouvre
   l'app dans le navigateur, qui reprend le code. Sans dépendance : la page
   ne charge rien de l'app. */
import './code.css';

const q = new URLSearchParams(location.search), suite = location.search + location.hash;
const dansLApp = !!(window.Capacitor || navigator.standalone
  || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
if (dansLApp) location.replace('/app' + suite);

const parQuatre = (s, n) => (String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n).match(/.{1,4}/g) || []).join('-');

function lire() {
  let v;
  if ((v = q.get('club'))) return ['Un club', 'Rejoins ce club', parQuatre(v, 8)];
  if ((v = q.get('defi'))) { const p = v.replace(/\D/g, '').slice(0, 6); return ['Une partie en direct', 'Entre dans la partie', p.slice(0, 3) + ' ' + p.slice(3)]; }
  if ((v = q.get('rejoindre'))) return ['Ta classe', 'Rejoins ta classe', parQuatre(v, 8)];
  if ((v = q.get('ami'))) {
    const p = v.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
    return ['Un ami', `Ajoute @${p} en ami`, '@' + p];
  }
  const m = /^#s=([A-Za-z0-9-]+)/.exec(location.hash);
  return m ? ['Un paquet partagé', 'Ajoute ce paquet', parQuatre(m[1], 10)] : null;
}

const $ = id => document.getElementById(id);
const tel = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
const lu = lire();

if (!lu) {
  $('cdtitre').textContent = 'Ce lien ne porte pas de code';
  $('cdcode').hidden = true; $('cdcopier').hidden = true;
} else {
  const [quoi, titre, code] = lu;
  document.title = titre + ' · Mirandola';
  $('cdquoi').textContent = quoi;
  $('cdtitre').textContent = titre;
  $('cdcode').textContent = code;
  const b = $('cdcopier');
  b.addEventListener('click', () => {
    const fait = () => { b.textContent = 'Copié'; b.classList.add('ok'); setTimeout(() => { b.textContent = 'Copier le code'; b.classList.remove('ok'); }, 2200); };
    const choisir = () => { const r = document.createRange(); r.selectNodeContents($('cdcode')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(fait, choisir);
    else choisir();                                   // sans presse-papiers : le code sélectionné, à copier soi-même
  });
}

/* Au téléphone, l'app est l'icône de l'écran d'accueil : on n'y ouvre rien
   d'ici (Safari ouvrirait la porte d'installation). Sur ordinateur, l'app
   s'ouvre dans le navigateur et reprend le code. */
$('cdapp').href = '/app' + suite;
$('cdcompte').href = '/inscription' + suite;
if (tel) {
  $('cdapp').hidden = true;
  $('cdcompte').textContent = 'Pas encore Mirandola ? L’installer';
  $('cdcompte').href = '/app' + suite;
} else {
  $('cdouvrir').textContent = 'ici, avec « Ouvrir dans Mirandola », ou dans l’app installée';
}
