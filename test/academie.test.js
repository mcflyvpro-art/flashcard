/* La Mirandola Academy (/academie) : la liste des tutos tient ses règles,
   la page les montre tous, et une vidéo posée devient un bouton et des
   données structurées. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ECRANS, ROLES, TUTOS, catalogue, dureeIso, dureeLisible, videosLD } from '../src/site/academie.js';
import { rendreFichier } from '../tools/site/gabarit.js';
import { PAGES, SITE } from '../src/site/pages.js';

const icones = readFileSync('src/site/partiels/icones.html', 'utf8') + readFileSync('academie.html', 'utf8');

describe('la liste des tutos', () => {
  it('un identifiant chacun, un rôle connu, au moins un écran', () => {
    expect(new Set(TUTOS.map(t => t.id)).size).toBe(TUTOS.length);
    for (const t of TUTOS) {
      expect(ROLES.map(r => r.cle), t.id).toContain(t.role);
      expect(t.ecrans.length, t.id).toBeGreaterThan(0);
      for (const e of t.ecrans) expect(Object.keys(ECRANS), t.id).toContain(e);
      expect(icones, t.icone).toContain(`id="${t.icone}"`);
    }
  });
  it('chaque rôle a ses tutos, au téléphone comme sur ordinateur', () => {
    for (const r of ROLES) for (const e of Object.keys(ECRANS)) {
      expect(TUTOS.some(t => t.role === r.cle && t.ecrans.includes(e)), `${r.cle} ${e}`).toBe(true);
    }
  });
  it('le référent au téléphone : ses codes et sa licence seulement, comme dans l’app', () => {
    expect(TUTOS.filter(t => t.role === 'ref' && t.ecrans.includes('tel')).map(t => t.id).sort()).toEqual(['codes', 'licence']);
  });
  it('des textes courts, dans la voix de chaque rôle', () => {
    for (const t of TUTOS) {
      expect(t.titre.length, t.titre).toBeLessThanOrEqual(36);
      expect(t.ligne.length, t.ligne).toBeLessThanOrEqual(70);
      const mots = ` ${t.titre} ${t.ligne} `.toLowerCase();
      expect(mots, t.id).not.toMatch(/[—–]|\bfiches?\b/);
      if (t.role === 'eleve') expect(mots, t.id).not.toMatch(/\b(vous|votre|vos)\b/);
      else expect(mots, t.id).not.toMatch(/\b(tu|ton|ta|tes|toi|t’)\b/);
    }
  });
  it('une vidéo se déclare en entier : fichier, affiche, date, durée', () => {
    for (const t of TUTOS.filter(x => x.video)) {
      expect(t.affiche && t.date && t.duree, t.id).toBeTruthy();
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('la page', () => {
  const h = rendreFichier('academie.html');
  it('est dans la liste des pages du site', () => expect(PAGES.map(x => x.chemin)).toContain('/academie'));
  it('montre chaque tuto, sous son rôle, avec ce qu’il en est de sa vidéo', () => {
    for (const t of TUTOS) expect(h, t.id).toContain(`id="tuto-${t.id}"`);
    for (const r of ROLES) expect(h).toContain(`id="${r.cle}"`);
    for (const t of TUTOS) expect(h, t.id).not.toContain(t.ligne);              // pas de micro description sous une vignette
    expect(h.match(/class="ac-bientot"/g)).toHaveLength(TUTOS.filter(t => !t.video).length);
  });
  it('aucune donnée structurée de vidéo tant qu’il n’y a pas de vidéo', () => {
    expect(h.includes('VideoObject')).toBe(TUTOS.some(t => t.video));
  });
});

describe('une vidéo posée', () => {
  const t = { id: 'essai', role: 'eleve', ecrans: ['tel'], icone: 'i-lecture', titre: 'Réviser', ligne: 'Lire, retourner, noter.',
    video: '/site/academie/reviser.mp4', affiche: '/site/academie/reviser.jpg', date: '2026-11-05', duree: 125 };
  it('dit sa durée en clair et comme la lit Google', () => {
    expect(dureeLisible(125)).toBe('2 min 05');
    expect(dureeLisible(120)).toBe('2 min');
    expect(dureeLisible(42)).toBe('42 s');
    expect(dureeIso(125)).toBe('PT2M5S');
    expect(dureeIso(42)).toBe('PT42S');
  });
  it('devient un VideoObject complet', () => {
    const [v] = videosLD(SITE, [t]);
    expect(v).toMatchObject({ '@type': 'VideoObject', name: 'Réviser', uploadDate: '2026-11-05', duration: 'PT2M5S',
      contentUrl: SITE + '/site/academie/reviser.mp4', thumbnailUrl: SITE + '/site/academie/reviser.jpg' });
    expect(videosLD(SITE, [{ ...t, video: 'https://videos.example/x.mp4' }])[0].contentUrl).toBe('https://videos.example/x.mp4');
  });
  it('devient un bouton qui ouvre le lecteur, avec sa durée', () => {
    const h = catalogue([t]);
    expect(h).toContain('<button type="button" class="ac-carte" data-ecrans="tel" id="tuto-essai" data-video="/site/academie/reviser.mp4"');
    expect(h).toContain('<span class="ac-duree">2 min 05</span>');
    expect(h).not.toContain('ac-bientot');
  });
});
