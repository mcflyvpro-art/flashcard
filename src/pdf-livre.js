/* ══════════ le PDF d'un livre (2026-11-02) ══════════
   Module pur, testé (test/pdf.test.js), chargé à la demande depuis le menu
   « … » d'un livre (ui/livre-pdf.js). Demandé : « un PDF du paquet, recto
   et verso bien présentés, en tableau, modifiable et imprimable ».

   Une page A4 : en tête la matière (sa reliure), le titre du livre, le
   nombre de pages et la date ; puis le tableau — le numéro, le recto en
   gras, le verso —, l'en-tête du tableau dans la couverture de la matière,
   une ligne sur deux à peine teintée, des coins arrondis ; le tableau
   reprend sur la page suivante sous un rappel du titre, et chaque page
   porte son numéro. Une ligne ne se coupe jamais entre deux pages, sauf
   celle qui ne tiendrait sur aucune.

   Modifiable : le texte de chaque case est un champ de formulaire (son
   apparence est dessinée ici, la même qu'à l'impression) ; on corrige une
   faute, on complète un verso dans Aperçu, Acrobat Reader, Chrome ou
   Fichiers, puis on imprime. « Verso à compléter » laisse les versos vides,
   à remplir — à la main sur papier, ou au clavier. Une case dont le texte
   n'est pas dans le latin de ces polices arrive en image (`rendu`, dessinée
   par l'écran) : elle se lit et s'imprime, elle ne se modifie pas. */
import { couper, deAnsi, documentPdf, ecrire, largeur, n, rectRond, rvb, texteUnicode, versAnsi } from './pdf.js';

export const A4 = { l: 595.28, h: 841.89 };
const M = { g: 40, d: 40, haut: 46, bas: 46 };
const LT = A4.l - M.g - M.d;
const NUM = 30;
export const COL = (LT - NUM) / 2;
const PX = 9, PY = 7.5;
export const CORPS = 10.5;
export const INTER = 14;
export const LARGEUR_TEXTE = COL - 2 * PX;                 // l'écran dessine à cette largeur les cases en image
const MONTEE = 9.6;                                          // du haut d'une ligne à sa ligne de base
const IMG_MAX = 120;
const PIED = 30;                                             // la place du pied de page
const ENCRE = '#1D1C19', DOUX = '#6B675F', PALE = '#9A958B', FILET = '#E4E0D7', ZEBRE = '#FAF9F6';

// un texte qui ne tient pas dans ces polices, sans image pour le remplacer : chaque caractère inconnu, sans son accent, ou « ? »
const approche = t => versAnsi(t) ?? [...String(t)]
  .map(c => versAnsi(c) ?? versAnsi(c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ?? '?').join('');

// une image ramenée à la largeur de la colonne et à `max` de haut
const ajuster = (img, max) => {
  const k = Math.min(LARGEUR_TEXTE / img.l, max / img.h, 1.4);
  return { l: img.l * k, h: img.h * k };
};

/* Ce qu'occupe une case : son image (une illustration de la page), puis son
   texte — en lignes, ou en image quand l'écran l'a dessiné (`rendu`). */
function mesurer(c, police, vide) {
  if (vide) return { lignes: [], h: 0, champ: true };
  const ansi = versAnsi(c.texte || '');
  const rendu = ansi === null && c.rendu ? { l: LARGEUR_TEXTE, h: c.rendu.h * LARGEUR_TEXTE / c.rendu.l } : null;
  const image = c.image ? ajuster(c.image, IMG_MAX) : null;
  const lignes = rendu ? [] : lignesDe(ansi ?? approche(c.texte || ''), police);
  return { lignes, image, rendu, h: hauteur(image, rendu, lignes), champ: !rendu && (lignes.length > 0 || !image) };
}
const lignesDe = (t, police) => (t.trim() ? couper(t, LARGEUR_TEXTE, CORPS, police) : []);
const hauteur = (image, rendu, lignes) =>
  (image ? image.h + (lignes.length || rendu ? 6 : 0) : 0) + (rendu ? rendu.h : lignes.length * INTER);

/* Le document. `livre` : { titre, matiere: { nom, d, c, b, ci } | null,
   date, pages: [{ recto, verso }] } — une case : { texte, image?, rendu? },
   une image : { jpeg (octets), l, h } ; `versoVide` : les versos à compléter. */
export function pdfLivre(livre, { versoVide = false } = {}) {
  const coul = livre.matiere || { d: ENCRE, c: '#F1EEE8', b: FILET, ci: ENCRE };
  const doc = documentPdf();
  const catalogue = doc.reserver(), arbre = doc.reserver(), formulaire = doc.reserver();
  const f1 = doc.reserver(), f2 = doc.reserver(), f3 = doc.reserver(), info = doc.reserver();
  doc.poser(f1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /Name /Helv >>');
  doc.poser(f2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding /Name /HeBo >>');
  doc.poser(f3, '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>');
  const polices = `/Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R /Helv ${f1} 0 R /HeBo ${f2} 0 R >>`;

  const pages = [];
  const champs = [];
  let p = null, y = 0, haut = 0, rangee = 0;
  // un texte posé ; l'espacement des lettres (Tc) survit à ET : chaque texte dit le sien
  const T = (police, corps, couleur, x, yb, ansi, extra = '0 Tc ') =>
    `BT ${rvb(couleur)} rg ${extra}${n(x)} ${n(yb)} Td ${ecrire(ansi, police, n(corps))} ET`;
  const titreAnsi = approche(livre.titre || 'Livre');
  const matiereAnsi = livre.matiere && livre.matiere.nom ? approche(livre.matiere.nom).toUpperCase() : '';

  // une image JPEG du document, posée une fois
  const posees = new Map();
  const imageObj = img => {
    if (posees.has(img)) return posees.get(img);
    const id = doc.reserver();
    posees.set(img, id);
    doc.flux(id, `<< /Type /XObject /Subtype /Image /Width ${img.l} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>`, img.jpeg);
    return id;
  };

  function enTete() {
    const o = [];
    if (pages.length === 0) {
      let yy = A4.h - M.haut;
      if (matiereAnsi) {
        o.push(`${rvb(coul.d)} rg ${rectRond(M.g, yy - 10.5, 3.4, 12, 1.2)} f`);
        o.push(T('F2', 7.6, coul.d, M.g + 10, yy - 8.6, matiereAnsi, '1.2 Tc '));
        yy -= 25;
      }
      const lignes = couper(titreAnsi, LT, 22, 'F2').slice(0, 3);
      lignes.forEach((l, i) => o.push(T('F2', 22, ENCRE, M.g, yy - 17 - i * 26, l, '-0.3 Tc ')));
      yy -= lignes.length * 26 + 6;
      const nb = livre.pages.length;
      const meta = approche(`${nb} page${nb > 1 ? 's' : ''}${versoVide ? ' · verso à compléter' : ''}${livre.date ? ' · ' + livre.date : ''}`);
      o.push(T('F1', 9.5, DOUX, M.g, yy - 9, meta));
      y = yy - 26;
    } else {
      // un rappel du titre, la matière à droite
      const yy = A4.h - 32;
      let t = titreAnsi;
      const place = LT - (matiereAnsi ? largeur(matiereAnsi, 7, 'F2') + matiereAnsi.length * 1.1 + 16 : 0);
      while (t.length > 1 && largeur(t, 8.5, 'F2') > place) t = t.slice(0, -2) + '\x85';
      o.push(T('F2', 8.5, ENCRE, M.g, yy, t));
      if (matiereAnsi) o.push(T('F2', 7, coul.d, A4.l - M.d - largeur(matiereAnsi, 7, 'F2') - matiereAnsi.length * 1.1, yy, matiereAnsi, '1.1 Tc '));
      y = yy - 14;
    }
    // l'en-tête du tableau, dans la couverture de la matière
    haut = y;
    const t = [`${rvb(coul.c)} rg ${rectRond(M.g, y - 22, LT, 22, 7, 'haut')} f`,
      T('F2', 7.2, coul.ci, M.g + NUM + PX, y - 14.4, 'RECTO', '1.3 Tc '),
      T('F2', 7.2, coul.ci, M.g + NUM + COL + PX, y - 14.4, 'VERSO', '1.3 Tc ')];
    y -= 22;
    return { o, t };
  }

  function nouvellePage() {
    if (p) fermerTableau();
    const { o, t } = enTete();
    p = { ops: o, tableau: t, annots: [], images: new Map() };
    pages.push(p);
  }

  // le tableau d'une page : ses lignes coupées aux coins arrondis, son filet, le trait entre recto et verso
  function fermerTableau() {
    const bord = rectRond(M.g, y, LT, haut - y, 7);
    p.ops.push(`q ${bord} W n`, ...p.tableau, 'Q',
      `${rvb(FILET)} RG 0.6 w ${n(M.g + NUM + COL)} ${n(haut - 22)} m ${n(M.g + NUM + COL)} ${n(y)} l S`,
      `${rvb(coul.b)} RG 0.9 w ${bord} S`);
  }

  // un champ de formulaire : le texte de la case, modifiable, et son apparence (la même à l'impression)
  function champ(nom, aide, police, lignes, valeur, x, yHaut, yBas) {
    const id = doc.reserver(), ap = doc.reserver();
    const l = LARGEUR_TEXTE + 4, h = Math.max(yHaut - yBas, INTER + 4);
    const corps = lignes.length
      ? `/Tx BMC q BT 0 Tc ${rvb(ENCRE)} rg 2 ${n(h - 2 - MONTEE)} Td ${INTER} TL `
        + lignes.map((s, i) => (i ? 'T* ' : '') + ecrire(s, police, CORPS)).join(' ') + ' ET Q EMC'
      : '/Tx BMC EMC';
    doc.flux(ap, `<< /Type /XObject /Subtype /Form /BBox [0 0 ${n(l)} ${n(h)}] /Resources << ${polices} >> >>`, corps);
    doc.poser(id, `<< /Type /Annot /Subtype /Widget /FT /Tx /Ff 4096 /F 4 /T (${nom}) /TU ${texteUnicode(aide)}`
      + ` /V ${texteUnicode(valeur)} /DA (/${police === 'F2' ? 'HeBo' : 'Helv'} ${CORPS} Tf ${rvb(ENCRE)} rg)`
      + ` /Rect [${n(x - 2)} ${n(yHaut - h)} ${n(x - 2 + l)} ${n(yHaut)}] /P ${p.id || (p.id = doc.reserver())} 0 R`
      + ` /MK << >> /BS << /W 0 >> /AP << /N ${ap} 0 R >> >>`);
    p.annots.push(id);
    champs.push(id);
  }

  // une case dessinée : son image, son texte en image ou en champ
  function poserCase(c, m, x, yHaut, yBas, nom, aide, police, valeur) {
    let yy = yHaut;
    const dessin = (img, taille) => {
      const id = imageObj(img);
      const k = 'Im' + id;
      p.images.set(k, id);
      p.tableau.push(`q ${n(taille.l)} 0 0 ${n(taille.h)} ${n(x)} ${n(yy - taille.h)} cm /${k} Do Q`);
      yy -= taille.h;
    };
    if (m.image) { dessin(c.image, m.image); if (m.lignes.length || m.rendu) yy -= 6; }
    if (m.rendu) dessin(c.rendu, m.rendu);
    if (m.champ) champ(nom, aide, police, m.lignes, valeur, x, yy, yBas);
  }

  livre.pages.forEach((pg, i) => {
    const r = mesurer(pg.recto, 'F2', false);
    const v = mesurer(pg.verso, 'F1', versoVide);
    const besoin = Math.max(r.h, versoVide ? Math.max(r.h, 2 * INTER) : v.h, INTER) + 2 * PY;
    if (!p || y - besoin < M.bas + PIED - 14) nouvellePage();
    // une ligne plus haute qu'une page entière : ses lignes de texte se répartissent (rare : un verso d'une page)
    const morceaux = decouper(r, v, besoin, () => y - (M.bas + PIED - 14));
    morceaux.forEach((mo, k) => {
      if (k > 0) nouvellePage();
      const h = mo.h;
      if (rangee % 2) p.tableau.push(`${rvb(ZEBRE)} rg ${n(M.g)} ${n(y - h)} ${n(LT)} ${n(h)} re f`);
      // le filet en haut de la ligne, après son aplat (posé en bas, l'aplat de la suivante le couvrait)
      if (y < haut - 22.5) p.tableau.push(`${rvb(FILET)} RG 0.5 w ${n(M.g)} ${n(y)} m ${n(M.g + LT)} ${n(y)} l S`);
      if (k === 0) {
        const num = String(i + 1);
        p.tableau.push(T('F1', 8.5, PALE, M.g + (NUM - largeur(num, 8.5)) / 2 + 2, y - PY - 2 - MONTEE + 0.4, num));
      }
      const suffixe = morceaux.length > 1 ? '_' + (k + 1) : '';
      // la valeur d'un champ : le texte d'origine (le lecteur le recoupe lui-même) ; d'un morceau, ses lignes
      const valeur = (c, m) => (morceaux.length > 1 ? deAnsi(m.lignes.join(' ')) : String(c.texte || ''));
      poserCase(pg.recto, mo.r, M.g + NUM + PX, y - PY, y - h + PY - 2, `p${i + 1}_recto${suffixe}`,
        `Page ${i + 1}, recto`, 'F2', valeur(pg.recto, mo.r));
      poserCase(pg.verso, mo.v, M.g + NUM + COL + PX, y - PY, y - h + PY - 2, `p${i + 1}_verso${suffixe}`,
        `Page ${i + 1}, verso`, 'F1', versoVide ? '' : valeur(pg.verso, mo.v));
      y -= h;
    });
    rangee++;
  });
  if (!p) nouvellePage();
  fermerTableau();

  // les pages, leur pied (« Mirandola », le numéro sur le total), le formulaire, le catalogue
  const ids = pages.map((pg, k) => {
    const id = pg.id || (pg.id = doc.reserver());
    const contenu = doc.reserver();
    const pied = [T('F2', 7.6, ENCRE, M.g, 24, 'Mirandola'), T('F1', 7.6, PALE, M.g + largeur('Mirandola', 7.6, 'F2') + 4, 24, 'mirandola.fr')];
    const num = `${k + 1} / ${pages.length}`;
    pied.push(T('F1', 7.6, PALE, A4.l - M.d - largeur(num, 7.6), 24, num));
    doc.flux(contenu, '<< >>', [...pg.ops, ...pied].join('\n'));
    const imgs = [...pg.images].map(([k2, v]) => `/${k2} ${v} 0 R`).join(' ');
    doc.poser(id, `<< /Type /Page /Parent ${arbre} 0 R /MediaBox [0 0 ${A4.l} ${A4.h}] /Contents ${contenu} 0 R`
      + ` /Resources << ${polices}${imgs ? ` /XObject << ${imgs} >>` : ''} >>`
      + (pg.annots.length ? ` /Annots [${pg.annots.map(a => a + ' 0 R').join(' ')}]` : '') + ' >>');
    return id;
  });
  doc.poser(arbre, `<< /Type /Pages /Kids [${ids.map(i => i + ' 0 R').join(' ')}] /Count ${ids.length} >>`);
  doc.poser(formulaire, `<< /Fields [${champs.map(c => c + ' 0 R').join(' ')}] /NeedAppearances false`
    + ` /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv ${f1} 0 R /HeBo ${f2} 0 R /F3 ${f3} 0 R >> >> >>`);
  doc.poser(catalogue, `<< /Type /Catalog /Pages ${arbre} 0 R /AcroForm ${formulaire} 0 R /Lang (fr-FR)`
    + ' /ViewerPreferences << /DisplayDocTitle true >> >>');
  doc.poser(info, `<< /Title ${texteUnicode(livre.titre || 'Livre')} /Producer (Mirandola) /Creator (Mirandola - mirandola.fr) >>`);
  return doc.fin(catalogue, info);
}

/* Une ligne qui tient : un seul morceau. Plus haute qu'une page entière :
   ses lignes de texte en plusieurs morceaux, chacun ce qu'une page laisse
   (l'image reste dans le premier). */
function decouper(r, v, besoin, libre) {
  const pleine = A4.h - 32 - 14 - 22 - (M.bas + PIED - 14);
  if (besoin <= pleine) return [{ r, v, h: besoin }];
  const out = [], pos = { r: 0, v: 0 };
  for (let k = 0; k === 0 || pos.r < r.lignes.length || pos.v < v.lignes.length; k++) {
    const place = (k ? pleine : Math.min(libre(), pleine)) - 2 * PY;
    const mr = morceau(r, pos, 'r', k === 0, place), mv = morceau(v, pos, 'v', k === 0, place);
    out.push({ r: mr, v: mv, h: Math.min(Math.max(mr.hh, mv.hh, INTER) + 2 * PY, place + 2 * PY) });
    if (k > 50) break;                               // garde-fou : jamais de boucle sans fin
  }
  return out;
}

// ce qu'une page laisse d'une case : ses lignes suivantes, l'image dans le premier morceau seulement
function morceau(m, pos, cle, premier, place) {
  const hi = premier && m.image ? m.image.h + 6 : 0;
  const k = Math.max(0, Math.floor((place - hi) / INTER));
  const lignes = m.lignes.slice(pos[cle], pos[cle] + k);
  pos[cle] += k;
  return { ...m, image: premier ? m.image : null, rendu: premier ? m.rendu : null, lignes,
    champ: m.champ && (lignes.length > 0 || premier), hh: hi + lignes.length * INTER };
}
