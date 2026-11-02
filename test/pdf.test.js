// Le PDF d'un livre (src/pdf.js, src/pdf-livre.js) : écrit sans
// bibliothèque, il doit être un PDF que tout lecteur ouvre (positions de la
// table xref exactes), écrire le français, le grec et les signes des
// sciences dans les polices de base, couper ses lignes dans la colonne,
// et laisser chaque case modifiable (un champ de formulaire par case).
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { couper, deAnsi, documentPdf, ecrire, largeur, texteUnicode, versAnsi } from '../src/pdf.js';
import { LARGEUR_TEXTE, pdfLivre } from '../src/pdf-livre.js';

const texte = b => Buffer.from(b).toString('latin1');
// les valeurs des champs, décodées de l'UTF-16 du PDF
const valeurs = pdf => [...texte(pdf).matchAll(/\/T \((p\d+_(?:recto|verso)[^)]*)\)[^]*?\/V <FEFF([0-9A-F]*)>/g)]
  .map(([, nom, h]) => [nom, Buffer.from(h, 'hex').swap16().toString('utf16le')]);

describe('écrire dans les polices de base', () => {
  it('le français tient dans WinAnsi ; l’euro et l’apostrophe courbe à leur code', () => {
    expect(versAnsi('Élève à l’école : 12 € « ok »')).toBe('Élève à l\x92école : 12 \x80 « ok »');
    expect(deAnsi(versAnsi('Élève à l’école : 12 € — œuvre'))).toBe('Élève à l’école : 12 € — œuvre');
  });
  it('le grec et les signes des sciences passent par Symbol ; le reste ne tient pas', () => {
    const s = versAnsi('α ≠ β → π ≈ 3,14 ; √2 ; Δt ; x ∈ E');
    expect(s).not.toBe(null);
    expect(deAnsi(s)).toBe('α ≠ β → π ≈ 3,14 ; √2 ; ∆t ; x ∈ E');      // le delta grec s'écrit avec celui de Symbol
    expect(ecrire(versAnsi('a=α'), 'F1', 10)).toBe('/F1 10 Tf (a=) Tj /F3 10 Tf (a) Tj');
    expect(versAnsi('кошка')).toBe(null);
    expect(versAnsi('猫')).toBe(null);
  });
  it('les espaces fines deviennent insécables, les espaces de largeur nulle partent', () => {
    expect(versAnsi('Quoi ?​')).toBe('Quoi ?');
  });
  it('les chasses d’Helvetica, comme les métriques d’Adobe', () => {
    expect(largeur('Mirandola', 10)).toBeCloseTo(43.9, 5);
    expect(largeur('Mirandola', 10, 'F2')).toBeGreaterThan(largeur('Mirandola', 10));
  });
  it('couper : chaque ligne tient, un mot trop long se coupe, les retours à la ligne restent', () => {
    const lignes = couper(versAnsi('La transformation, par les plantes, de l’énergie lumineuse en énergie chimique.\nDeuxième'), 120, 10.5);
    expect(lignes.length).toBeGreaterThan(2);
    expect(lignes.at(-1)).toBe('Deuxième');
    for (const l of lignes) expect(largeur(l, 10.5)).toBeLessThanOrEqual(120);
    const long = couper('a'.repeat(200), 100, 10);
    expect(long.join('')).toBe('a'.repeat(200));
    for (const l of long) expect(largeur(l, 10)).toBeLessThanOrEqual(100);
  });
  it('une chaîne de texte du document en UTF-16, toute langue', () => {
    expect(texteUnicode('é猫')).toBe('<FEFF00E9732B>');
    expect(texteUnicode('😀')).toBe('<FEFFD83DDE00>');
  });
});

describe('le fichier', () => {
  it('la table xref dit où commence chaque objet, au caractère près', () => {
    const d = documentPdf();
    const a = d.reserver(), b = d.reserver();
    d.poser(a, '<< /Type /Catalog /Pages 2 0 R >>');
    d.poser(b, '<< /Type /Pages /Kids [] /Count 0 >>');
    const s = texte(d.fin(a));
    expect(s.startsWith('%PDF-1.7')).toBe(true);
    const xref = s.slice(s.indexOf('xref\n'));
    const positions = xref.split('\n').slice(3, 5).map(l => parseInt(l, 10));
    positions.forEach((p, i) => expect(s.slice(p, p + 7)).toBe(`${i + 1} 0 obj`));
    expect(s).toMatch(/startxref\n(\d+)\n%%EOF\n$/);
    expect(s.slice(Number(s.match(/startxref\n(\d+)/)[1]), Number(s.match(/startxref\n(\d+)/)[1]) + 4)).toBe('xref');
  });
  it('un objet réservé mais jamais posé est une erreur, pas un PDF cassé', () => {
    const d = documentPdf();
    d.reserver();
    expect(() => d.fin(1)).toThrow();
  });
});

const livre = (n, verso = i => 'Verso ' + i) => ({
  titre: 'La Révolution française', date: '2 novembre 2026',
  matiere: { nom: 'Histoire', d: '#B8862B', c: '#F7EBD3', b: '#E8D3A6', ci: '#5C4012' },
  pages: Array.from({ length: n }, (_, i) => ({ recto: { texte: 'Recto ' + (i + 1) }, verso: { texte: verso(i + 1) } }))
});

describe('le PDF d’un livre', () => {
  it('un champ modifiable par case, la valeur en Unicode, le formulaire déclaré', () => {
    const pdf = pdfLivre({ ...livre(3), pages: [{ recto: { texte: '1789' }, verso: { texte: 'Prise de la Bastille — l’été' } },
      { recto: { texte: 'ω' }, verso: { texte: 'α ≠ β' } }, { recto: { texte: 'x' }, verso: { texte: 'y' } }] });
    const s = texte(pdf);
    expect(s).toContain('/AcroForm');
    expect(s).toContain('/BaseFont /Symbol');
    const v = Object.fromEntries(valeurs(pdf));
    expect(Object.keys(v)).toHaveLength(6);
    expect(v.p1_verso).toBe('Prise de la Bastille — l’été');
    expect(v.p2_verso).toBe('α ≠ β');
    expect(s).toMatch(/\/Count 1\b/);
  });
  it('un long livre se range sur plusieurs pages, chacune numérotée', () => {
    const s = texte(pdfLivre(livre(120)));
    const pages = Number(s.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)[1]);
    expect(pages).toBeGreaterThan(2);
    expect(s).toContain(`(${pages} / ${pages}) Tj`);
    expect(valeurs(pdfLivre(livre(120)))).toHaveLength(240);
  });
  it('« verso à compléter » : les versos vides et modifiables, la place pour écrire', () => {
    const pdf = pdfLivre(livre(4), { versoVide: true });
    const v = Object.fromEntries(valeurs(pdf));
    expect(v.p1_recto).toBe('Recto 1');
    expect(v.p1_verso).toBe('');
    expect(texte(pdf)).toContain('verso \xE0 compl\xE9ter');
  });
  it('une case plus longue qu’une page entière se répartit sur plusieurs, sans rien perdre', () => {
    const long = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(160);
    const pdf = pdfLivre(livre(2, i => (i === 1 ? long : 'court')));
    const v = valeurs(pdf).filter(([k]) => k.startsWith('p1_verso'));
    expect(v.length).toBeGreaterThan(1);
    expect(v.map(([, t]) => t).join(' ').replace(/\s+/g, ' ').trim()).toBe(long.trim());
  });
  it('une image JPEG est posée telle quelle ; un texte hors des polices, dessiné par l’écran, sans champ', () => {
    const jpeg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9]);
    const pdf = pdfLivre({ titre: 'Japonais', pages: [{ recto: { texte: 'chat', image: { jpeg, l: 400, h: 300 } },
      verso: { texte: '猫', rendu: { jpeg, l: 3 * LARGEUR_TEXTE, h: 60 } } }] });
    const s = texte(pdf);
    expect(s).toContain('/Filter /DCTDecode');
    expect((s.match(/\/Subtype \/Image/g) || []).length).toBe(2);
    expect(valeurs(pdf).map(([k]) => k)).toEqual(['p1_recto']);
  });
  it('sans image pour le remplacer, un caractère inconnu devient « ? », les accents restent', () => {
    const v = Object.fromEntries(valeurs(pdfLivre({ titre: 't', pages: [{ recto: { texte: 'accélération в' }, verso: { texte: '' } }] })));
    expect(v.p1_recto).toBe('accélération в');                       // la valeur garde le texte entier
    const s = texte(pdfLivre({ titre: 't', pages: [{ recto: { texte: 'accélération в' }, verso: { texte: '' } }] }));
    expect(s).toContain('(acc\xE9l\xE9ration ?) Tj');                  // l'apparence, ce qu'elle peut
  });
});
