// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Clipboard } from '@capacitor/clipboard';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { menu, tuto } from '../data/etat.js';
import { lienDeLApp } from '../natif.js';
import { flush, save } from '../core/coeur-sync.js';
import { closeMenu } from './menus-a.js';
import { traiterLienEntrant } from './liens-entrants.js';
import { estArme } from './routeur.js';

/* ══════════ l'app des magasins : le pont natif (2026-11-16) ══════════
   Chargé par src/app.js SEULEMENT sous le vrai pont de Capacitor (iOS,
   Android) — jamais dans un navigateur, jamais dans la PWA : @capacitor/core
   y réécrirait window.Capacitor, et l'app se croirait native. Tout ce qui
   suit ne change donc rien au web. docs/CAPACITOR.md dit le reste.

   Ce morceau fait de la même app web une app native soignée :
   - le lancement : l'écran du système s'efface dès que l'ouverture de la
     page (#boot, le même papier) est peinte ; les icônes de la barre
     d'état restent foncées sur le papier ;
   - les liens : un lien universel (iOS) ou un App Link (Android) — le QR
     d'une classe, d'une partie, d'un club, un paquet partagé, un e-mail —
     arrive par `appUrlOpen` (ou, Android lancé par ce lien, par
     getLaunchUrl) et passe par la seule porte des liens entrants,
     traiterLienEntrant, une fois l'app prête ;
   - le bouton retour d'Android : une boîte, puis une feuille, se ferment
     d'abord ; sinon l'écran d'avant ; tout au début, l'app passe en
     arrière-plan au lieu de se fermer ;
   - l'arrière-plan : ce qui n'était qu'en mémoire est écrit aussitôt
     (save), et au retour ce qui attend part (flush) — sans attendre que le
     WebView le signale lui-même ;
   - ce qu'un WebView ne sait pas faire seul, rendu par les greffons sous
     les mêmes noms que le web : partager un texte ou un fichier
     (navigator.share — le PDF d'un paquet, l'export des statistiques),
     télécharger (un lien « download » devient un partage : Enregistrer
     dans Fichiers, Drive…), copier (navigator.clipboard), vibrer
     (navigator.vibrate, un retour haptique léger) ;
   - Android : une photo à joindre propose l'appareil photo ET la galerie,
     comme Chrome (le WebView n'offrait que la galerie) ;
   - la connexion par Google est cachée : sa page refuse de s'ouvrir dans
     une app (« disallowed_useragent ») et ne saurait pas y revenir. */

export { Purchases };

const plateforme = window.Capacitor.getPlatform();
document.documentElement.classList.add('natif', 'natif-' + plateforme);

const style = document.createElement('style');
style.textContent = `html.natif #lext{display:none!important}
.nt-choix{border:0;padding:0;margin:auto auto 0;width:min(100%,520px);max-width:none;background:transparent}
.nt-choix::backdrop{background:rgba(29,28,25,.32)}
.nt-choix form{display:grid;gap:8px;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
.nt-choix button{font:600 17px system-ui,-apple-system,sans-serif;padding:16px;border:0;border-radius:14px;
  background:var(--card,#fff);color:var(--ink,#1D1C19);box-shadow:inset 0 0 0 1px var(--line,rgba(29,28,25,.1))}
.nt-choix button[value=""]{font-weight:700}`;
document.head.appendChild(style);

/* ---------- le lancement ---------- */
// deux images : l'ouverture (#boot, en ligne dans index.html) est à l'écran avant que le lancement ne s'efface
requestAnimationFrame(() => requestAnimationFrame(() => {
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => { /* déjà effacé (délai de sûreté de capacitor.config.json) */ });
}));
SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => { /* rien à régler : le style du thème reste */ });

/* ---------- les liens qui ouvrent l'app ---------- */
/* L'app est prête quand le routeur est armé : la session lue, l'écran
   d'arrivée ouvert (ou la connexion). Un lien arrivé pendant le démarrage
   attend jusque-là, quinze secondes au plus. */
const pret = () => new Promise(fin => {
  const t0 = Date.now();
  const voir = () => (estArme() || Date.now() - t0 > 15000 ? fin() : setTimeout(voir, 100));
  voir();
});
let dernier = '', a = 0;
async function recevoir(url) {
  const lien = lienDeLApp(url);
  if (!lien || (lien === dernier && Date.now() - a < 3000)) return;   // le même lien rapporté deux fois (lancement et évènement)
  dernier = lien; a = Date.now();
  await pret();
  traiterLienEntrant(lien);
}
App.addListener('appUrlOpen', e => recevoir(e && e.url));
// Android lancé par le lien : il n'y a pas d'évènement, l'adresse attend ici (sur iOS, l'évènement est gardé pour nous)
if (plateforme === 'android') App.getLaunchUrl().then(r => r && r.url && recevoir(r.url), () => {});

/* ---------- le bouton retour d'Android ---------- */
App.addListener('backButton', ({ canGoBack }) => {
  const boite = [...document.querySelectorAll('dialog[open]')].pop();
  if (boite) return boite.close();
  if (menu) return closeMenu();
  if (canGoBack) return history.back();          // le routeur rouvre l'écran d'avant ; le tuto ramène à son étape
  if (!tuto) App.minimizeApp().catch(() => {});
});

/* ---------- l'arrière-plan ---------- */
App.addListener('pause', () => { try { save(); } catch (e) { /* stockage plein : le prochain envoi retentera */ } });
App.addListener('resume', () => { flush(); });

/* ---------- partager, télécharger, copier, vibrer ---------- */
const base64 = blob => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(',') + 1));
  r.onerror = () => ko(r.error);
  r.readAsDataURL(blob);
});
const nomPropre = n => String(n || 'mirandola').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'mirandola';
async function versFichier(f) {
  const { uri } = await Filesystem.writeFile({ path: nomPropre(f.name), data: await base64(f), directory: Directory.Cache });
  return uri;
}
const annule = e => /cancel|annul|abort/i.test(String((e && (e.message || e.errorMessage)) || e));

function poser(nom, valeur) {
  try { Object.defineProperty(navigator, nom, { value: valeur, configurable: true, writable: true }); }
  catch (e) { /* propriété figée par le moteur : la fonction du WebView reste */ }
}

poser('canShare', d => !!d && !!((d.files && d.files.length) || d.url || d.text));
poser('share', async (d = {}) => {
  const files = d.files && d.files.length ? await Promise.all([...d.files].map(versFichier)) : undefined;
  try { await Share.share({ title: d.title, text: d.text, url: d.url, files, dialogTitle: d.title || 'Partager' }); }
  catch (e) { throw annule(e) ? new DOMException('Partage annulé', 'AbortError') : e; }
});

/* Un lien « download » vers un blob (la sauvegarde des paquets, un export)
   n'aboutit à rien dans un WebView : il devient un partage du fichier. */
async function telecharger(a) {
  try {
    const b = await (await fetch(a.href)).blob();
    await navigator.share({ files: [new File([b], a.download || 'mirandola', { type: b.type })], title: a.download });
  } catch (e) { /* partage refusé ou annulé : rien n'est perdu, le geste se refait */ }
}
const versBlob = a => a && a.hasAttribute('download') && /^(blob|data):/.test(a.href);
const clic = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () { return versBlob(this) ? void telecharger(this) : clic.call(this); };
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('a[download]');
  if (versBlob(a)) { ev.preventDefault(); telecharger(a); }
}, true);

poser('clipboard', {
  writeText: t => Clipboard.write({ string: String(t) }),
  readText: async () => ((await Clipboard.read()) || {}).value || ''
});

poser('vibrate', motif => {
  const ms = Array.isArray(motif) ? motif[0] : motif;
  if (ms > 0) Haptics.impact({ style: ms > 30 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  return true;
});

/* ---------- Android : l'appareil photo ou la galerie ----------
   Le WebView d'Android n'ouvre que la galerie pour un champ photo sans
   « capture » (la création, l'atelier de l'IA) : on pose la question que
   Chrome pose, puis le même champ s'ouvre sur l'une ou l'autre. Un champ
   qui a déjà « capture » (la copie d'un examen blanc) va droit à
   l'appareil photo. */
if (plateforme === 'android') {
  let passe = null;
  const choix = document.createElement('dialog');
  choix.className = 'nt-choix';
  choix.innerHTML = `<form method="dialog"><button value="photo">Prendre une photo</button>
    <button value="galerie">Choisir dans la galerie</button><button value="">Annuler</button></form>`;
  document.body.appendChild(choix);
  let champ = null;
  choix.addEventListener('close', () => {
    const c = champ; champ = null;
    if (!c || !choix.returnValue) return;
    if (choix.returnValue === 'photo') c.setAttribute('capture', 'environment');
    passe = c;
    c.click();
    if (choix.returnValue === 'photo') setTimeout(() => c.removeAttribute('capture'), 0);
  });
  choix.addEventListener('click', ev => { if (ev.target === choix) choix.close(''); });
  document.addEventListener('click', ev => {
    const c = ev.target;
    if (!(c instanceof HTMLInputElement) || c.type !== 'file' || c.hasAttribute('capture') || !/image/.test(c.accept || '')) return;
    if (passe === c) { passe = null; return; }
    ev.preventDefault();
    champ = c;
    choix.returnValue = '';
    choix.showModal();
  }, true);
}
