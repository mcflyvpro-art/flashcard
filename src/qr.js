/* ══════════ QR code ══════════
   Un élève rejoint sa classe en visant le tableau avec son téléphone : le
   professeur projette un QR qui ouvre l'app sur le bon code. Aucune
   bibliothèque (l'app démarre hors ligne et n'en embarque pas) : ce module
   suit la norme ISO/IEC 18004 sur le strict nécessaire — octets, niveau de
   correction M (15 % de la surface peut être masquée par un reflet ou un
   doigt), versions 1 à 10 (213 octets, bien plus qu'un lien d'invitation).

   Pur et sans dépendance : il ne touche ni au DOM ni au réseau, et le test
   (test/qr.test.js) relit chaque bloc par son syndrome de Reed-Solomon.
   La preuve qu'un vrai lecteur le décode a été faite au décodeur d'OpenCV
   (voir le test). */

// [codes de correction par bloc, blocs du groupe 1, octets par bloc 1, blocs du groupe 2, octets par bloc 2]
const BLOCS = [null,
  [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];

const ALIGNEMENTS = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* ---------- le corps fini à 256 éléments ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x; LOG[x] = i;
  x <<= 1; if (x & 256) x ^= 0x11D;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
export const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function generateur(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const r = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { r[j] ^= g[j]; r[j + 1] ^= gfMul(g[j], EXP[i]); }
    g = r;
  }
  return g;
}

/* Le reste de la division de `data · xⁿ` par le polynôme générateur. */
export function reedSolomon(data, n) {
  const g = generateur(n), r = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ r.shift(); r.push(0);
    for (let j = 0; j < n; j++) r[j] ^= gfMul(g[j + 1], f);
  }
  return r;
}

export const capacite = v => { const b = BLOCS[v]; return b[1] * b[2] + b[3] * b[4]; };

/* ---------- les données : mode octet, bourrage, blocs entrelacés ---------- */
function bitsDonnees(octets, v) {
  const bits = [];
  const pose = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  pose(4, 4);                                  // mode « octet »
  pose(octets.length, v < 10 ? 8 : 16);
  for (const o of octets) pose(o, 8);
  const max = capacite(v) * 8;
  pose(0, Math.min(4, max - bits.length));     // fin
  while (bits.length % 8) bits.push(0);
  for (let p = 0; bits.length < max; p++) pose(p % 2 ? 0x11 : 0xEC, 8);
  const mots = [];
  for (let i = 0; i < bits.length; i += 8) mots.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  return mots;
}

export function blocs(mots, v) {
  const [ec, n1, k1, n2, k2] = BLOCS[v];
  const l = [];
  let at = 0;
  for (let i = 0; i < n1 + n2; i++) {
    const k = i < n1 ? k1 : k2;
    const d = mots.slice(at, at + k); at += k;
    l.push({ d, e: reedSolomon(d, ec) });
  }
  return l;
}

function entrelace(l) {
  const out = [], kmax = Math.max(...l.map(b => b.d.length));
  for (let i = 0; i < kmax; i++) for (const b of l) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < l[0].e.length; i++) for (const b of l) out.push(b.e[i]);
  return out;
}

/* ---------- la grille ---------- */
function grille(v) {
  const n = 17 + 4 * v;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const f = Array.from({ length: n }, () => new Array(n).fill(false));
  const pose = (x, y, noir) => { m[y][x] = noir; f[y][x] = true; };
  return { n, m, f, pose };
}

/* Un carré de repère centré en (cx, cy), avec son liseré blanc. */
function repere(g, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
    if (x >= 0 && x < g.n && y >= 0 && y < g.n) g.pose(x, y, d !== 2 && d !== 4);
  }
}

/* Les petits carrés d'alignement, sauf là où tombent les repères. */
function alignements(g, v) {
  const a = ALIGNEMENTS[v], z = a.length - 1;
  const libre = (i, j) => !((i === 0 && j === 0) || (i === 0 && j === z) || (i === z && j === 0));
  for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length; j++) {
    if (!libre(i, j)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      g.pose(a[i] + dx, a[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function motifs(g, v) {
  const n = g.n;
  for (let i = 0; i < n; i++) { g.pose(6, i, i % 2 === 0); g.pose(i, 6, i % 2 === 0); }
  repere(g, 3, 3); repere(g, n - 4, 3); repere(g, 3, n - 4);
  alignements(g, v);
  format(g, 0);
  if (v >= 7) version(g, v);
}

/* Niveau M (bits 00) et masque, protégés par un code BCH(15,5). */
export function bitsFormat(masque) {
  let r = masque;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  return ((masque << 10) | r) ^ 0x5412;
}

function format(g, masque) {
  const { n, pose } = g, b = bitsFormat(masque), bit = i => ((b >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) pose(8, i, bit(i));
  pose(8, 7, bit(6)); pose(8, 8, bit(7)); pose(7, 8, bit(8));
  for (let i = 9; i < 15; i++) pose(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) pose(n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) pose(8, n - 15 + i, bit(i));
  pose(8, n - 8, true);                        // le module toujours sombre
}

function version(g, v) {
  let r = v;
  for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
  const b = (v << 12) | r;
  for (let i = 0; i < 18; i++) {
    const noir = ((b >>> i) & 1) === 1, a = g.n - 11 + (i % 3), c = Math.floor(i / 3);
    g.pose(a, c, noir); g.pose(c, a, noir);
  }
}

/* Le serpentin : colonnes deux par deux, de droite à gauche, en montant
   puis en descendant, en sautant la colonne de synchronisation. */
function place(g, mots) {
  const { n, m, f } = g;
  let i = 0;
  for (let droite = n - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    const monte = ((droite + 1) & 2) === 0;
    for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) {
      const x = droite - j, y = monte ? n - 1 - k : k;
      if (f[y][x] || i >= mots.length * 8) continue;
      m[y][x] = ((mots[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
      i++;
    }
  }
}

const MASQUES = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

function masque(g, k) {
  const t = MASQUES[k];
  for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) {
    if (!g.f[y][x] && t(x, y)) g.m[y][x] = !g.m[y][x];
  }
}

/* ---------- la pénalité : le masque retenu est le plus lisible ---------- */
const MOTIF = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];

function penaliteLigne(l) {
  let p = 0, run = 1;
  for (let i = 1; i <= l.length; i++) {
    if (i < l.length && l[i] === l[i - 1]) { run++; continue; }
    if (run >= 5) p += run - 2;
    run = 1;
  }
  const s = l.map(b => (b ? 1 : 0)).join(''), a = MOTIF.join(''), b = MOTIF.slice().reverse().join('');
  for (let i = 0; i + 11 <= s.length; i++) {
    const w = s.slice(i, i + 11);
    if (w === a || w === b) p += 40;
  }
  return p;
}

export function penalite(m) {
  const n = m.length;
  let p = 0, noirs = 0;
  for (let i = 0; i < n; i++) { p += penaliteLigne(m[i]); p += penaliteLigne(m.map(r => r[i])); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (m[y][x]) noirs++;
    if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x]
        && m[y][x] === m[y + 1][x + 1]) p += 3;
  }
  return p + Math.floor(Math.abs((noirs * 100) / (n * n) - 50) / 5) * 10;
}

/* ---------- l'entrée ---------- */
export function encodeUtf8(s) {
  return Array.from(new TextEncoder().encode(String(s)));
}

/* La matrice (tableau de lignes de booléens, `true` = sombre), ou `null`
   si le texte ne tient pas en version 10. */
export function qrMatrice(texte) {
  const octets = encodeUtf8(texte);
  let v = 1;
  while (v <= 10 && octets.length + (v < 10 ? 2 : 3) > capacite(v)) v++;
  if (v > 10) return null;
  const mots = entrelace(blocs(bitsDonnees(octets, v), v));
  let meilleure = null, score = Infinity;
  for (let k = 0; k < 8; k++) {
    const g = grille(v);
    motifs(g, v);
    place(g, mots);
    masque(g, k);
    format(g, k);
    const s = penalite(g.m);
    if (s < score) { score = s; meilleure = g.m; }
  }
  return meilleure;
}

/* Le dessin, en un seul chemin SVG, avec sa marge blanche de 4 modules
   (sans elle, la plupart des lecteurs ne trouvent pas les repères). */
export function qrSvg(texte, titre) {
  const m = qrMatrice(texte);
  if (!m) return '';
  const n = m.length, t = n + 8;
  const lib = String(titre || 'QR code').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${t} ${t}" role="img" aria-label="${lib}"
    shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
