// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { subj } from '../core/coeur-sync.js';
import { pdfLivre, CORPS, INTER, LARGEUR_TEXTE } from '../pdf-livre.js';
import { versAnsi } from '../pdf.js';
import { mediaSrc, plain } from './carte-media.js';

/* ══════════ le PDF d'un livre : ce que l'écran y met (2026-11-02) ══════════
   Chargé à la demande par ui/pdf-porte.js. Les règles du document sont
   dans src/pdf-livre.js ; ici, ce que seul le navigateur sait faire : lire
   le texte d'une page comme on le lit à l'écran (listes, formules), aller
   chercher ses images, dessiner en image un texte que les polices du PDF
   n'écrivent pas (japonais, russe, arabe… avec les polices du système), et
   remettre le fichier — au partage, à un onglet, au téléchargement. */

// le texte d'une face : les lignes et les listes gardées, la mise en forme et les formules lues comme à l'écran
export function texteFace(s) {
  return String(s || '').split(/\r?\n/).map(l => {
    const m = /^\s*([-*•·–]|\d+[.)])\s+(.+)$/.exec(l);
    return m ? (/\d/.test(m[1]) ? m[1] + ' ' : '• ') + plain(m[2]) : plain(l);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const ECHELLE = 3;                                   // points → pixels : net à l'impression
const ZEBRE = '#FAF9F6';

const enJpeg = canvas => new Promise((ok, ko) => canvas.toBlob(b => (b ? b.arrayBuffer().then(x => ok(new Uint8Array(x)), ko)
  : ko(new Error('jpeg'))), 'image/jpeg', 0.9));

// un texte hors des polices du PDF, dessiné dans la largeur de sa colonne
async function dessinerTexte(texte, gras, fond) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const police = `${gras ? 700 : 400} ${CORPS * ECHELLE}px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
  x.font = police;
  const max = LARGEUR_TEXTE * ECHELLE, lignes = [];
  for (const para of texte.split('\n')) {
    let l = '';
    for (const mot of [...para.matchAll(/\S+\s*/g)].map(m => m[0])) {
      if (x.measureText(l + mot).width <= max || !l) l += mot;
      else { lignes.push(l.trimEnd()); l = mot; }
      while (x.measureText(l).width > max && l.length > 1) {            // un mot sans espace (japonais) : au caractère
        let k = l.length - 1;
        while (k > 1 && x.measureText(l.slice(0, k)).width > max) k--;
        lignes.push(l.slice(0, k)); l = l.slice(k);
      }
    }
    lignes.push(l.trimEnd());
  }
  c.width = Math.ceil(max);
  c.height = Math.ceil(lignes.length * INTER * ECHELLE + 4 * ECHELLE);
  x.fillStyle = fond; x.fillRect(0, 0, c.width, c.height);
  x.font = police; x.fillStyle = '#1D1C19'; x.textBaseline = 'alphabetic';
  lignes.forEach((l, i) => x.fillText(l, 0, (i * INTER + 9.6 + 2) * ECHELLE));
  return { jpeg: await enJpeg(c), l: c.width, h: c.height };
}

// l'image d'une page, en JPEG (le seau garde des PNG, des WebP…) ; rien si elle ne vient pas
async function dessinerImage(ref) {
  try {
    const url = await Promise.race([mediaSrc(ref), new Promise((_, ko) => setTimeout(() => ko(new Error('délai')), 8000))]);
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1000 / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return { jpeg: await enJpeg(c), l: c.width, h: c.height };
  } catch (e) {
    console.warn('pdf : image', String(e && e.message));       // hors ligne, image partie : la page s'imprime sans elle
    return null;
  }
}

async function caseDe(texte, image, gras, fond) {
  const t = texteFace(texte);
  const c = { texte: t };
  if (image) { const i = await dessinerImage(image); if (i) c.image = i; }
  if (t && versAnsi(t) === null) c.rendu = await dessinerTexte(t, gras, fond);
  return c;
}

const nomDeFichier = nom => ([...String(nom || 'Paquet')].filter(c => c.charCodeAt(0) > 31).join('')
  .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Paquet') + '.pdf';

export async function fichierPdf(d, { versoVide = false } = {}) {
  const s = subj(d.subject);
  const pages = await Promise.all(d.cards.map(async (c, i) => {
    const fond = i % 2 ? ZEBRE : '#FFFFFF';
    return { recto: await caseDe(c.f, c.fi, true, fond), verso: versoVide ? { texte: '' } : await caseDe(c.b, c.bi, false, fond) };
  }));
  const octets = pdfLivre({
    titre: d.name, date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    matiere: s.id ? { nom: s.name, d: s.d, c: s.c, b: s.b, ci: s.ci } : null, pages
  }, { versoVide });
  return new File([octets], nomDeFichier(d.name + (versoVide ? ' (à compléter)' : '')), { type: 'application/pdf' });
}

/* Remettre le fichier : le partage au téléphone (Imprimer, Fichiers,
   Mail…), un onglet ailleurs — le lecteur du navigateur imprime —, le
   téléchargement si l'onglet est refusé. Faux : le navigateur demande un
   nouveau geste (la porte affiche alors « Ouvrir le PDF »). */
export async function livrer(fichier) {
  const tactile = matchMedia('(pointer: coarse)').matches;
  if (tactile && navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier], title: fichier.name.replace(/\.pdf$/, '') }); return true; }
    catch (e) {
      if (e && e.name === 'AbortError') return true;           // la feuille de partage refermée : rien à refaire
      if (e && e.name === 'NotAllowedError') return false;
    }
  }
  const url = URL.createObjectURL(fichier);
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  if (!tactile && window.open(url, '_blank')) return true;
  const a = document.createElement('a');
  a.href = url; a.download = fichier.name;
  document.body.appendChild(a); a.click(); a.remove();
  return true;
}
