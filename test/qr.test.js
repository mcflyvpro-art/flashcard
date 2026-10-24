/* L'encodeur QR (src/qr.js). Le contrôle de bout en bout — un vrai lecteur
   relit chaque code — a été fait au décodeur d'OpenCV le 2026-10-24 :
   10 textes de 1 à 210 octets (versions 1 à 10, accents compris), 10/10
   relus à l'identique. Ici on vérifie ce qui garantit cette lecture : la
   correction d'erreurs, les repères, le format. */
import { describe, it, expect } from 'vitest';
import { bitsFormat, blocs, capacite, encodeUtf8, gfMul, qrMatrice, qrSvg, reedSolomon } from '../src/qr.js';

/* La valeur d'un mot de code en αⁱ : nulle pour i = 0…n−1 si et seulement
   si le bloc est un mot de code Reed-Solomon valide. */
function syndrome(mot, i) {
  let a = 1;
  for (let k = 0; k < i; k++) a = gfMul(a, 2);
  return mot.reduce((s, c) => gfMul(s, a) ^ c, 0);
}

describe('la correction d’erreurs', () => {
  it('le corps à 256 éléments', () => {
    expect(gfMul(0, 7)).toBe(0);
    expect(gfMul(1, 173)).toBe(173);
    expect(gfMul(2, 128)).toBe(0x1D);           // x·x⁷ = x⁸ ≡ x⁴+x³+x²+1
  });
  it('rend le vecteur de référence publié (« HELLO WORLD », 1-M)', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(reedSolomon(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
  it('chaque bloc de chaque version est un mot de code valide', () => {
    for (let v = 1; v <= 10; v++) {
      const mots = Array.from({ length: capacite(v) }, (_, i) => (i * 37 + v) % 256);
      for (const b of blocs(mots, v)) {
        const mot = [...b.d, ...b.e];
        for (let i = 0; i < b.e.length; i++) expect(syndrome(mot, i), `v${v} i${i}`).toBe(0);
      }
    }
  });
});

describe('la grille', () => {
  const lien = 'https://mcflyvpro-art.github.io/flashcard/?rejoindre=K7QM2XRP';
  it('prend la plus petite version qui tient', () => {
    expect(qrMatrice('A')).toHaveLength(21);                 // version 1
    expect(qrMatrice(lien)).toHaveLength(33);                // 61 octets → version 4
    expect(qrMatrice('x'.repeat(211))).toHaveLength(57);     // version 10
    expect(qrMatrice('x'.repeat(215))).toBeNull();           // au-delà : rien plutôt qu'un code faux
  });
  it('porte ses trois repères et le module toujours sombre', () => {
    const m = qrMatrice(lien), n = m.length;
    const repere = (x, y) => {
      for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
        const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        expect(m[y + dy][x + dx], `${x + dx},${y + dy}`).toBe(d !== 2);
      }
    };
    repere(0, 0); repere(n - 7, 0); repere(0, n - 7);
    expect(m[n - 8][8]).toBe(true);
    for (let i = 8; i < n - 8; i++) expect(m[6][i]).toBe(i % 2 === 0);   // synchronisation
  });
  it('les bits de format du niveau M', () => {
    expect(bitsFormat(0)).toBe(0b101010000010010);
    for (let k = 0; k < 8; k++) expect(bitsFormat(k) >>> 10 ^ 0b10101).toBe(k);
  });
  it('déterministe : le même texte donne le même dessin', () => {
    expect(JSON.stringify(qrMatrice(lien))).toBe(JSON.stringify(qrMatrice(lien)));
  });
  it('l’UTF-8 compte en octets', () => {
    expect(encodeUtf8('é')).toEqual([0xC3, 0xA9]);
  });
});

describe('le dessin', () => {
  it('un SVG avec sa marge blanche, et un libellé échappé', () => {
    const s = qrSvg('A', 'Classe "<2nde>" & co');
    expect(s).toMatch(/viewBox="0 0 29 29"/);
    expect(s).toContain('&#34;&#60;2nde&#62;&#34; &#38; co');
    expect(s).not.toContain('<2nde>');
  });
  it('rien pour un texte trop long', () => {
    expect(qrSvg('x'.repeat(400))).toBe('');
  });
});
