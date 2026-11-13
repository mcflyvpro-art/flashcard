/* La rentabilité de l'IA (supabase/functions/_shared/rentabilite.js) : quel
   que soit l'usage, un mois d'IA ne coûte jamais plus que la moitié de ce
   qu'un compte rapporte au pire — code de lancement, formule à l'année,
   TVA, cotisations et frais de Stripe déduits. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CHARGES, ESSAI_CENTS, EXAMENS_OFFERTS, EXAMEN_PAGES_OFFERT, GRATUIT_CENTS, PART_IA, PAR_GENERATION_CAMPUS, TARIFS,
  HAIKU, SONNETS, SOURCE, borneJetons, coutCents, deMemoire, econome, escalade, examenPermis, examensPermis, modelesPour,
  netMensuel, pireCents, pireNet, pireReserve, plafondCents, prixPromo
} from '../supabase/functions/_shared/rentabilite.js';
import { PRIX } from '../supabase/functions/_shared/abonnement.js';

describe('ce que coûte une génération', () => {
  it('les tarifs de la référence : Sonnet 2 $ et 10 $, Haiku 0,10 $ et 0,50 $ (puis 0,50 $ et 2,50 $ au-delà de 100 000)', () => {
    expect(coutCents('claude-sonnet-5', 1e6, 0)).toBe(200);
    expect(coutCents('claude-sonnet-5-5', 0, 1e6)).toBe(1000);
    expect(coutCents('claude-haiku-5-5', 1e5, 1e4)).toBeCloseTo(1.5, 6);          // 1 c + 0,5 c
    expect(coutCents('claude-haiku-5-5', 100001, 1e4)).toBeCloseTo(7.50005, 4);   // le second palier, entrée et sortie
    expect(coutCents('un-modele-inconnu', 1e6, 0)).toBe(200);                    // au prix du plus cher
  });
  it('chaque modèle appelé a son tarif, et la fonction ai n’en nomme aucun autre', () => {
    for (const id of [HAIKU, ...SONNETS]) expect(TARIFS[id], id).toBeTruthy();
    const src = readFileSync('supabase/functions/ai/index.ts', 'utf8');
    for (const [, id] of src.matchAll(/"(claude-[a-z0-9-]+)"/g)) expect(TARIFS[id], id).toBeTruthy();
  });
  it('le pire coût d’une génération : la sortie au maximum, au tarif du plus cher', () => {
    expect(pireCents(['claude-sonnet-5', 'claude-haiku-5-5'], 10000, 16000)).toBe(18);
    expect(pireCents(['claude-haiku-5-5'], 10000, 32000)).toBeCloseTo(1.7, 6);
    expect(borneJetons(24000)).toBe(16000);                                    // un jeton pour deux signes, plus le système
  });
});

describe('ce que rapporte un compte, au pire', () => {
  it('le net d’un mois : TVA, cotisations, Stripe', () => {
    // 5,99 € : 4,99 € HT, moins 25,6 %, moins 0,34 € de Stripe
    expect(netMensuel(599, 1)).toBeCloseTo(599 / 1.2 * 0.744 - (599 * 0.015 + 25), 6);
    expect(netMensuel(4499, 12)).toBeCloseTo((4499 / 1.2 * 0.744 - (4499 * 0.015 + 25)) / 12, 6);
  });
  it('le pire de chaque niveau : l’année au code de lancement', () => {
    expect(prixPromo('annuel')).toBe(3599);
    expect(pireNet('plus')).toBeCloseTo(netMensuel(3599, 12), 6);
    expect(pireNet('infini')).toBeCloseTo(netMensuel(6399, 12), 6);
    expect(pireNet('plus')).toBeGreaterThan(150);       // plus de 1,50 € par mois, même au pire
  });
});

describe('le plafond de chaque compte', () => {
  it('Mirandola+ 89 cents, Infini 160, l’essai 25, Campus 3 cents par génération accordée', () => {
    expect(plafondCents({ niveau: 'plus' })).toBe(89);
    expect(plafondCents({ niveau: 'infini' })).toBe(160);
    expect(plafondCents({ niveau: 'infini', essai: true })).toBe(ESSAI_CENTS);
    expect(plafondCents({ licence: 30 })).toBe(30 * PAR_GENERATION_CAMPUS);
    expect(plafondCents({ licence: 0 })).toBe(0);
    expect(plafondCents({ niveau: 'plus', licence: 400 })).toBe(1200);      // la licence passe avant
  });
  it('quel que soit l’usage, chaque formule, au prix plein comme au lancement, reste rentable', () => {
    for (const f of Object.keys(PRIX)) {
      const niveau = f.startsWith('infini') ? 'infini' : 'plus';
      const ia = plafondCents({ niveau }) * CHARGES.euroParDollar;          // un mois d'IA au plafond, en centimes d'euro
      for (const prix of [PRIX[f].centimes, prixPromo(f)]) {
        const net = netMensuel(prix, PRIX[f].intervalle === 'year' ? 12 : 1);
        expect(ia, `${f} à ${prix}`).toBeLessThanOrEqual(net * PART_IA);
        expect(net - ia, `${f} à ${prix}`).toBeGreaterThan(80);              // au moins 0,80 € par mois de marge
      }
    }
  });
  it('l’usage ordinaire tient largement : 30 générations à 1,3 cent pour Mirandola+, 120 pour Infini', () => {
    expect(30 * 1.3).toBeLessThan(plafondCents({ niveau: 'plus' }) * 0.75);
    expect(90 * 1.3).toBeLessThan(plafondCents({ niveau: 'infini' }) * 0.75);
  });
  it('le meilleur modèle pour les trois premiers quarts, puis le plus économe', () => {
    expect(econome(66, 89)).toBe(false);
    expect(econome(67, 89)).toBe(true);
    expect(econome(1000, null)).toBe(false);
  });
});

describe('l’examen blanc offert', () => {
  it('1 en Mirandola gratuit, 2 en Mirandola+ et Campus, sans limite pour Infini — le même tableau que l’app', async () => {
    const app = await import('../src/offres.js');
    expect(EXAMENS_OFFERTS).toEqual(app.EXAMENS_OFFERTS);
    expect(examensPermis('gratuit')).toBe(1);
    expect(examensPermis('plus')).toBe(2);
    expect(examensPermis('infini')).toBe(Infinity);
    expect(examensPermis('inconnu')).toBe(0);
    expect(app.examensRestants('gratuit', 0)).toBe(1);
    expect(app.examensRestants('plus', 1)).toBe(1);
    expect(app.examensRestants('plus', 5)).toBe(0);
    expect(app.examensRestants('infini', 99)).toBe(Infinity);
  });
  it('composer demande un examen de reste ; corriger, un sujet qui attend sa correction', () => {
    expect(examenPermis('examen', 'gratuit', 0, 0)).toBe(true);
    expect(examenPermis('examen', 'gratuit', 1, 0)).toBe(false);
    expect(examenPermis('corriger', 'gratuit', 1, 0)).toBe(true);
    expect(examenPermis('corriger', 'gratuit', 1, 1)).toBe(false);       // pas deux corrections pour un sujet
    expect(examenPermis('examen', 'plus', 1, 1)).toBe(true);
    expect(examenPermis('examen', 'plus', 2, 2)).toBe(false);
    expect(examenPermis('examen', 'infini', 40, 40)).toBe(true);
    expect(examenPermis('corriger', 'infini', 0, 9)).toBe(true);
  });
  it('un compte gratuit : de quoi composer et corriger un examen au pire, pas plus', () => {
    expect(plafondCents({ niveau: 'gratuit' })).toBe(GRATUIT_CENTS);
    // 120 cartes de 1 200 signes au plus, un jeton pour deux signes, et 16 000 jetons de sortie au meilleur modèle
    const composer = pireCents(['claude-sonnet-5'], borneJetons(EXAMEN_PAGES_OFFERT * 1200), 16000);
    const corriger = pireCents(['claude-sonnet-5'], 8 * 5000 + 4000 + 30 * 600, 16000);
    expect(composer + corriger).toBeLessThanOrEqual(GRATUIT_CENTS);      // 31,2 + 28,4 cents, même à un jeton pour deux signes
  });
});

describe('le modèle de chaque opération', () => {
  const sonnet = [...SONNETS, HAIKU], haiku = [HAIKU, ...SONNETS];
  it('Haiku d’abord pour ce qui transforme ce qu’on lui donne : un texte, un PDF, une retouche, un cours collé', () => {
    expect(modelesPour('cards')).toEqual(haiku);
    expect(modelesPour('pdf')).toEqual(haiku);
    expect(modelesPour('prompt', { cartes: 12, message: 'Inverse le recto et le verso' })).toEqual(haiku);
    expect(modelesPour('prompt', { cartes: 12, message: 'Corrige les fautes' })).toEqual(haiku);
    expect(modelesPour('prompt', { cartes: 0, message: 'x'.repeat(SOURCE) })).toEqual(haiku);
  });
  it('Sonnet d’abord pour ce qui demande un œil ou un jugement : l’écriture à la main, l’examen, la copie', () => {
    expect(modelesPour('ocr')).toEqual(sonnet);
    expect(modelesPour('examen')).toEqual(sonnet);
    expect(modelesPour('corriger')).toEqual(sonnet);
  });
  it('… et pour écrire de mémoire : un sujet sans texte, « ajoute », « 10 cartes »', () => {
    expect(modelesPour('prompt', { cartes: 0, message: '10 cartes sur les capitales d’Europe' })).toEqual(sonnet);
    expect(modelesPour('prompt', { cartes: 8, message: 'Ajoute 10 cartes' })).toEqual(sonnet);
    expect(modelesPour('prompt', { cartes: 8, message: 'Complète avec les dates' })).toEqual(sonnet);
    expect(deMemoire('cards', { cartes: 0, message: '' })).toBe(false);
  });
  it('Infini dans ses 150 : le modèle le plus avancé pour tout, comme promis', () => {
    for (const op of ['cards', 'pdf', 'prompt', 'ocr', 'examen', 'corriger']) expect(modelesPour(op, {}, false, true)).toEqual(sonnet);
    expect(modelesPour('cards', {}, true, true)).toEqual([HAIKU]);            // ses 150 faites : Haiku
  });
  it('passé les trois quarts du plafond, Haiku seul, pour tout', () => {
    for (const op of ['cards', 'pdf', 'prompt', 'ocr', 'examen', 'corriger']) expect(modelesPour(op, {}, true)).toEqual([HAIKU]);
  });
  it('Haiku en tête peut repartir sur Sonnet : la réservation couvre les deux appels', () => {
    expect(escalade(haiku)).toBe(true);
    expect(escalade(sonnet)).toBe(false);
    expect(escalade([HAIKU])).toBe(false);
    expect(pireReserve(sonnet, 10000, 16000)).toBe(pireCents(sonnet, 10000, 16000));
    expect(pireReserve(haiku, 10000, 16000)).toBeCloseTo(18 + coutCents(HAIKU, 10000, 16000), 6);
    expect(pireReserve([HAIKU], 10000, 16000)).toBeCloseTo(coutCents(HAIKU, 10000, 16000), 6);
  });
  it('un texte ordinaire coûte vingt fois moins sur Haiku', () => {
    expect(coutCents(SONNETS[0], 6000, 2000) / coutCents(HAIKU, 6000, 2000)).toBeCloseTo(20, 6);
  });
});
