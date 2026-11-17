// @ts-nocheck
/* ══════════ tirer pour rafraîchir (2026-11-16) ══════════
   Demandé : « une vraie app, on ne sort jamais de l'écran ; en haut, si
   l'on tire un peu, ça peut faire effet refresh, ça recharge les données
   (sans tout relancer) ». La page ne bouge plus (overscroll-behavior: none,
   app.css) : tirer vers le bas en haut d'un écran fait descendre un petit
   rond qui tourne avec le doigt ; passé le seuil, il s'arme (il se fonce),
   et le lâcher relit les données de l'écran — la bibliothèque et ce que
   l'écran montre (amis, club, messages, statistiques, classe), comme le
   coup d'œil du retour sur l'app (ui/synchro-ecran.js) —, puis repeint si
   rien n'est sous les doigts. Jamais l'app entière, jamais le morceau.

   Seulement au doigt, sur un écran calme, tout en haut, sans feuille
   ouverte ni tuto ; un geste qui part de côté reste au balayage entre
   onglets (ui/balayage.js). Chargé au calme après l'ouverture. */
import './tirer.css';
import { I, svg } from '../icones.js';
import { menu, online, setAnimate, tuto, view } from '../data/etat.js';
import { syncBibliotheque } from '../core/synchro.js';
import { offrePull } from '../core/abonnement.js';
import { mailPull } from '../core/reglages-corbeille.js';
import { statsPull } from '../core/ecran-groupe.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { clubsPull, membresPull } from '../core/cercle.js';
import { render } from './bibliotheque.js';
import { commuPull } from './cercle.js';
import { toast } from './import-cartes.js';
import { peutRepeindre } from './synchro-ecran.js';

const SEUIL = 64;            // la course du rond qui arme le rafraîchissement
const ECRANS = /^(home|deck|stats|classes|classe|commu|friends|club|mail|lettre|settings|profil|plus)$/;
const AILLEURS = '.tabs,.card,.menu,.balai,.rng,.seg,input,textarea,select,[contenteditable]';

const rond = document.createElement('div');
rond.className = 'tirer';
rond.setAttribute('aria-hidden', 'true');
rond.innerHTML = svg(I.refresh);
document.body.append(rond);

let y0 = 0, x0 = 0, suivi = false, actif = false, p = 0, occupe = false;

function poser(v) {
  p = v;
  rond.style.transform = `translateY(${v.toFixed(1)}px) rotate(${(v * 4).toFixed(0)}deg)`;
  rond.style.opacity = Math.min(1, v / (SEUIL * .7)).toFixed(2);
  const arme = v >= SEUIL;
  if (arme !== rond.classList.contains('arme')) {
    rond.classList.toggle('arme', arme);
    if (arme && navigator.vibrate) try { navigator.vibrate(5); } catch (x) { /* vibration refusée : le rond suffit */ }
  }
}

function rentrer() {
  rond.classList.add('rentre');
  rond.classList.remove('arme', 'tourne');
  rond.style.transform = ''; rond.style.opacity = '';
  setTimeout(() => rond.classList.remove('rentre'), 320);
  occupe = false;
}

/* Ce que l'écran montre, relu ; la bibliothèque et l'offre toujours. */
function relire() {
  const v = view.name, t = [syncBibliotheque(peutRepeindre), offrePull()];
  if (v === 'commu' || v === 'friends' || v === 'profil') commuPull(true);
  if (v === 'club') t.push(clubsPull(true), membresPull(view.id));
  if (v === 'mail' || v === 'lettre') t.push(mailPull());
  if (v === 'stats') t.push(statsPull(1));
  if (v === 'classes' || v === 'classe') t.push(eleveClassesPull());
  return Promise.allSettled(t);
}

async function rafraichir() {
  occupe = true;
  rond.classList.add('tourne', 'rentre');
  poser(SEUIL);
  if (!online) { toast(I.cloud, 'Hors ligne : rien à relire pour l’instant'); return setTimeout(rentrer, 400); }
  // au moins un demi-tour : un rafraîchissement trop vif passe pour un raté
  await Promise.all([Promise.race([relire(), new Promise(r => setTimeout(r, 8000))]), new Promise(r => setTimeout(r, 550))]);
  if (peutRepeindre()) { setAnimate(false); render(); }
  rentrer();
}

addEventListener('touchstart', e => {
  suivi = false; actif = false;
  if (occupe || e.touches.length !== 1 || document.body.scrollTop > 0 || menu || tuto || !ECRANS.test(view.name)
    || document.documentElement.classList.contains('sheet-open') || (e.target.closest && e.target.closest(AILLEURS))) return;
  suivi = true; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
}, { passive: true });

addEventListener('touchmove', e => {
  if (!suivi) return;
  const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
  if (!actif) {
    if (Math.abs(dx) > 10 || dy < -6 || document.body.scrollTop > 0) { suivi = false; return; }
    if (dy < 10) return;
    actif = true; rond.classList.remove('rentre');
  }
  if (document.body.scrollTop > 0) { suivi = false; actif = false; return rentrer(); }
  // le rond suit la moitié du doigt, puis freine : il ne quitte jamais le haut de l'écran
  const v = Math.max(0, dy - 10);
  poser(Math.min(SEUIL * 1.4, v < SEUIL * 2 ? v / 2 : SEUIL + (v - SEUIL * 2) * .2));
}, { passive: true });

const finir = () => {
  if (!suivi) return;
  suivi = false;
  if (!actif) return;
  actif = false;
  if (p >= SEUIL) rafraichir(); else rentrer();
};
addEventListener('touchend', finir, { passive: true });
addEventListener('touchcancel', () => { if (suivi) { suivi = false; actif = false; rentrer(); } }, { passive: true });
