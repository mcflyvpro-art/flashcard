/* ══════════ écrire un PDF, sans bibliothèque (2026-11-02) ══════════
   Module pur, sans dépendance, testé (test/pdf.test.js) : chargé à la
   demande avec le PDF d'un livre (src/pdf-livre.js), jamais au démarrage.

   Pourquoi l'écrire nous-mêmes : l'app démarre hors ligne et n'ajoute pas
   de bibliothèque sans accord (CLAUDE.md), et ce qu'on demande au format
   est petit — du texte dans les deux polices que tout lecteur de PDF
   connaît (Helvetica et Helvetica-Bold, rien à embarquer), des filets, des
   aplats, des images JPEG telles quelles, et des champs de formulaire pour
   qu'on puisse corriger le PDF dans n'importe quel lecteur (Aperçu,
   Acrobat Reader, Chrome, Fichiers d'iPhone).

   Ces polices écrivent le latin de l'Europe de l'Ouest (« WinAnsi ») et,
   avec Symbol, le grec et les signes des sciences : `versAnsi` dit si un
   texte y tient, après quelques substitutions sans perte de sens (espaces
   fines, tirets) ; un texte qui n'y tient pas (cyrillique, japonais,
   arabe…) est dessiné en image par l'écran, qui seul connaît les polices
   du système. */

/* Les chasses d'Helvetica et d'Helvetica-Bold (métriques Adobe, en
   millièmes de corps) pour les codes WinAnsi 32 à 255, deux chiffres en
   base 36 par code. */
const CHASSES = {
  F1: '7q7q9vfgfgopij5b9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg7q7qg8g8g8fgs7ijijk2k2ijgzlmk27qdwijfgn5k2lmijlmk2ijgzk2ijq8ijijgz7q7q7qd1fg99fgfgdwfgfg7qfgfg6666dw66n5fgfgfgfg99dw7qfgdwk2dwdwdw9a789ag89qfg9q66fg99rsfgfg99rsij99rs9qgz9q9q666699999qfgrs99rsdw99q89qdwij7q99fgfgfgfg78fg99khaafgg899kh99b4g8999999fgex7q9999a5fgn6n6n6gzijijijijijijrsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgzfgfgfgfgfgfgopdwfgfgfgfg7q7q7q7qfgfgfgfgfgfgfgg8gzfgfgfgfgdwfgdw',
  F2: '7q99d6fgfgopk26m9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg9999g8g8g8gzr3k2k2k2k2ijgzlmk27qfgk2gzn5k2lmijlmk2ijgzk2ijq8ijijgz997q99g8fg99fggzfggzfg99gzgz7q7qfg7qopgzgzgzgzatfg99gzfglmfgfgdwat7satg89qfg9q7qfgdwrsfgfg99rsij99rs9qgz9q9q7q7qdwdw9qfgrs99rsfg99q89qdwij7q99fgfgfgfg7sfg99khaafgg899kh99b4g8999999gzfg7q9999a5fgn6n6n6gzk2k2k2k2k2k2rsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgzfgfgfgfgfgfgopfgfgfgfgfg7q7q7q7qgzgzgzgzgzgzgzg8gzgzgzgzgzfggzfg'
};
const TABLES = {};
const chasses = f => TABLES[f] || (TABLES[f] = Array.from({ length: 224 }, (_, i) => parseInt(CHASSES[f].substr(i * 2, 2), 36)));

// la plage 0x80–0x9F de WinAnsi (Windows-1252) ; 0xA0–0xFF suivent Unicode
const CP1252 = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};
const INVERSE = Object.fromEntries(Object.entries(CP1252).map(([u, c]) => [c, Number(u)]));

/* La police Symbol, la troisième que tout lecteur connaît : l'alphabet grec
   et les signes des maths et des sciences (≠ ≈ ≤ ≥ √ ∞ ∑ ∫ ∈ → ⇒ …), que
   les cartes de physique ou de maths emploient partout ($\alpha$ devient
   « α » à l'écran). Pour chaque caractère : son code Unicode (4 chiffres
   hexadécimaux), son code dans Symbol (2), sa chasse (2, base 36). */
const SYMB = '220022jt220324f9220b27c722172adw22122df9224540f9039141k2039242ij03a743k2220644h0039545gz03a646l7039347gr039748k20399499903d14ahj039a4bk2039b4cj2039c4dop039d4ek2039f4fk203a050lc039851kl03a152fg03a353gg03a454gz03a555j603c256c7212657lc039e58hx03a859m303965agz22345cnz22a55eia03b161hj03b262f903c763f903b464dq03b565c703c666eh03b367bf03b768gr03b9699503d56agr03ba6bf903bb6cf903bd6eeh03bf6ff903c070f903b871eh03c172f903c373gr03c474c703c575g003d676jt03c977j203be78dp03c879j203b67adq223c7ef903d2a1h82032a26v2264a3f92044a44n221ea5jt2663a7kx2666a8kx2665a9kx2660aakx2194absy2190acrf2191adgr2192aerf2193afgr2033b2bf2265b3f9221db5jt2202b6dq2260b9f92261baf92248bbf921b5bfia2135c0mv2111c1j2211cc2m32118c3rf2297c4lc2295c5lc2205c6mv2229c7lc222ac8lc2283c9jt2287cajt2284cbjt2282ccjt2286cdjt2208cejt2209cfjt2220d0lc2207d1jt220fd5mv221ad6f922c5d76y2227d9gr2228dagr21d4dbsy21d0dcrf21d1ddgr21d2derf21d3dfgr25cae0dq2329e1952211e5jt232af195222bf27m2320f3j22321f5j2';
let SYMBOLE = null;
const symbole = () => {
  if (SYMBOLE) return SYMBOLE;
  SYMBOLE = { code: new Map(), chasse: new Map(), unicode: new Map() };
  for (let i = 0; i < SYMB.length; i += 8) {
    const u = parseInt(SYMB.substr(i, 4), 16), c = parseInt(SYMB.substr(i + 4, 2), 16);
    SYMBOLE.code.set(u, c); SYMBOLE.chasse.set(c, parseInt(SYMB.substr(i + 6, 2), 36)); SYMBOLE.unicode.set(c, u);
  }
  // les mêmes signes sous un autre code : le delta et l'oméga grecs, les longues flèches
  for (const [a, b] of [[0x0394, 0x2206], [0x03A9, 0x2126], [0x27F6, 0x2192], [0x27F5, 0x2190], [0x27F9, 0x21D2], [0x27FA, 0x21D4]]) {
    SYMBOLE.code.set(a, SYMBOLE.code.get(b));
  }
  return SYMBOLE;
};
// un signe de Symbol, dans une chaîne encodée : 0xE000 + son code (une zone d'Unicode que personne n'écrit)
const SYM = 0xE000;

// ce qui se remplace sans perdre le sens : les espaces et les tirets d'imprimerie, le mu grec (le micro de WinAnsi)
/** @type {Array<[RegExp, string]>} */
const SUBSTITUTS = [
  [/[\u2000-\u200A\u202F\u205F]/g, '\u00A0'], [/[\u200B-\u200D\u2060\uFEFF]/g, ''], [/\t/g, ' '],
  [/[\u2010\u2011\u2012]/g, '-'], [/\u03BC/g, '\u00B5']
];

/* Le texte encodé pour ces polices : les octets WinAnsi, et pour un signe
   de Symbol 0xE000 + son code ; null s'il contient un caractère qu'aucune
   des trois n'a (cyrillique, japonais, arabe…). */
export function versAnsi(texte) {
  let s = String(texte == null ? '' : texte).normalize('NFC');
  for (const [re, par] of SUBSTITUTS) s = s.replace(re, par);
  let out = '';
  for (const ch of s) {
    const u = ch.codePointAt(0);
    if (u === 10 || (u >= 32 && u < 127) || (u >= 0xA0 && u <= 0xFF)) out += ch;
    else if (CP1252[u]) out += String.fromCharCode(CP1252[u]);
    else if (symbole().code.has(u)) out += String.fromCharCode(SYM + symbole().code.get(u));
    else return null;
  }
  return out;
}

// l'inverse : le texte Unicode d'une chaîne encodée (la valeur d'un champ)
export function deAnsi(ansi) {
  let out = '';
  for (const ch of String(ansi)) {
    const c = ch.charCodeAt(0);
    out += c >= SYM ? String.fromCodePoint(symbole().unicode.get(c - SYM) || 63)
      : INVERSE[c] ? String.fromCodePoint(INVERSE[c]) : ch;
  }
  return out;
}

// largeur d'une chaîne encodée, en points
export const largeur = (ansi, corps, police = 'F1') => {
  const t = chasses(police);
  let w = 0;
  for (let i = 0; i < ansi.length; i++) {
    const c = ansi.charCodeAt(i);
    w += c >= SYM ? symbole().chasse.get(c - SYM) || 500 : c >= 32 ? t[c - 32] : 0;
  }
  return w * corps / 1000;
};

/* Ce qu'écrit un texte encodé dans un flux, la police changeant au fil des
   signes : `/F2 10.5 Tf (Vitesse ) Tj /F3 10.5 Tf (w) Tj …`. */
export function ecrire(ansi, police, corps) {
  const runs = [];
  for (const ch of String(ansi)) {
    const c = ch.charCodeAt(0);
    const f = c >= SYM ? 'F3' : police;
    const o = c >= SYM ? String.fromCharCode(c - SYM) : ch;
    if (runs.length && runs[runs.length - 1].f === f) runs[runs.length - 1].s += o;
    else runs.push({ f, s: o });
  }
  return runs.map(r => `/${r.f} ${corps} Tf ${chaine(r.s)} Tj`).join(' ');
}

/* Couper un texte WinAnsi en lignes qui tiennent dans `max` points : aux
   espaces d'abord, au caractère près pour un mot trop long ; un retour à la
   ligne est gardé, une ligne vide aussi. */
export function couper(ansi, max, corps, police = 'F1') {
  const lignes = [];
  const L = s => largeur(s, corps, police);
  for (const para of String(ansi).split('\n')) {
    let ligne = '';
    for (const mot of para.split(' ')) {
      const essai = ligne ? ligne + ' ' + mot : mot;
      if (L(essai) <= max) { ligne = essai; continue; }
      if (ligne) lignes.push(ligne);
      ligne = mot;
      while (L(ligne) > max && ligne.length > 1) {
        let k = ligne.length - 1;
        while (k > 1 && L(ligne.slice(0, k)) > max) k--;
        lignes.push(ligne.slice(0, k));
        ligne = ligne.slice(k);
      }
    }
    lignes.push(ligne);
  }
  return lignes;
}

// une chaîne de flux : les octets WinAnsi, \ ( ) échappés
export const chaine = ansi => '(' + ansi.replace(/[\\()]/g, m => '\\' + m).replace(/\r/g, '\\r').replace(/\n/g, '\\n') + ')';
// une chaîne de texte du document (titre, valeur d'un champ) : UTF-16BE, toute langue
export function texteUnicode(s) {
  let h = 'FEFF';
  for (const c of String(s)) {
    const u = c.codePointAt(0);
    if (u > 0xFFFF) {
      const v = u - 0x10000;
      h += (0xD800 + (v >> 10)).toString(16).padStart(4, '0') + (0xDC00 + (v & 0x3FF)).toString(16).padStart(4, '0');
    } else h += u.toString(16).padStart(4, '0');
  }
  return '<' + h.toUpperCase() + '>';
}

// un nombre de PDF : court, sans exposant
export const n = x => {
  const r = Math.round(x * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
// une couleur « #RRGGBB » en trois composantes
export const rvb = hex => {
  const h = String(hex || '#000000').replace('#', '');
  return [0, 2, 4].map(i => n(parseInt(h.substr(i, 2), 16) / 255)).join(' ');
};

const octets = s => {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return b;
};

/* Le document : on réserve un numéro, on pose l'objet, `fin` assemble
   l'en-tête, les objets, la table des positions (xref) et la remorque. */
export function documentPdf() {
  const objets = [];
  return {
    reserver() { objets.push(null); return objets.length; },
    poser(id, dico) { objets[id - 1] = [octets(`${id} 0 obj\n${dico}\nendobj\n`)]; },
    // un flux : son dictionnaire (sans /Length) et ses octets (une chaîne d'octets, ou Uint8Array pour une image)
    flux(id, dico, contenu) {
      const b = typeof contenu === 'string' ? octets(contenu) : contenu;
      objets[id - 1] = [octets(`${id} 0 obj\n${dico.replace(/>>\s*$/, '')}/Length ${b.length} >>\nstream\n`), b,
        octets('\nendstream\nendobj\n')];
    },
    fin(racine, info) {
      const parts = [octets('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n')];
      let pos = parts[0].length;
      const xref = [];
      objets.forEach((o, i) => {
        if (!o) throw new Error('objet ' + (i + 1) + ' réservé mais jamais posé');
        xref.push(pos);
        for (const p of o) { parts.push(p); pos += p.length; }
      });
      const table = `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
        + xref.map(x => String(x).padStart(10, '0') + ' 00000 n \n').join('')
        + `trailer\n<< /Size ${objets.length + 1} /Root ${racine} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${pos}\n%%EOF\n`;
      parts.push(octets(table));
      const total = parts.reduce((a, p) => a + p.length, 0);
      const out = new Uint8Array(total);
      let k = 0;
      for (const p of parts) { out.set(p, k); k += p.length; }
      return out;
    }
  };
}

/* Un rectangle aux coins arrondis (r), en courbes de Bézier : `quels` dit
   quels coins s'arrondissent (haut, bas, ou les quatre). */
export function rectRond(x, y, l, h, r, quels = 'tous') {
  const k = 0.5523 * r;
  const haut = quels !== 'bas', bas = quels !== 'haut';
  const rb = bas ? r : 0, rh = haut ? r : 0, kb = bas ? k : 0, kh = haut ? k : 0;
  return [
    `${n(x + rb)} ${n(y)} m`, `${n(x + l - rb)} ${n(y)} l`,
    bas ? `${n(x + l - rb + kb)} ${n(y)} ${n(x + l)} ${n(y + rb - kb)} ${n(x + l)} ${n(y + rb)} c` : '',
    `${n(x + l)} ${n(y + h - rh)} l`,
    haut ? `${n(x + l)} ${n(y + h - rh + kh)} ${n(x + l - rh + kh)} ${n(y + h)} ${n(x + l - rh)} ${n(y + h)} c` : '',
    `${n(x + rh)} ${n(y + h)} l`,
    haut ? `${n(x + rh - kh)} ${n(y + h)} ${n(x)} ${n(y + h - rh + kh)} ${n(x)} ${n(y + h - rh)} c` : '',
    `${n(x)} ${n(y + rb)} l`,
    bas ? `${n(x)} ${n(y + rb - kb)} ${n(x + rb - kb)} ${n(y)} ${n(x + rb)} ${n(y)} c` : '',
    'h'
  ].filter(Boolean).join(' ');
}
