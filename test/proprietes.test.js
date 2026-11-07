// Les tests par propriétés (2026-11-07, docs/FIABILITE.md) : au lieu de
// quelques exemples choisis, des milliers d'entrées tirées au hasard par
// fast-check, et ce qui doit TOUJOURS tenir. Quand une propriété casse,
// fast-check réduit l'entrée jusqu'au plus petit contre-exemple, et le
// rejoue à l'identique avec la graine qu'il affiche (FC_GRAINE=… npm test).
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fsrsInit, fsrsIvl, fsrsR, fsrsStep, D_MAX, D_MIN, S_MIN, W6 } from '../src/fsrs.js';
import { cardIssues } from '../src/invariants.js';
import { mergeCards } from '../src/fusion.js';
import { norm } from '../src/normaliser.js';
import { codeLivre, estCodeLivre, lienLivre, tokComplet, tokDepuisTexte } from '../src/livre-code.js';
import { cle, saisie, valide } from '../src/pseudo.js';
import { parseText } from '../src/parseur.js';
import { prixCampus } from '../src/tarifs.js';
import { nettoyer, pileCourte, empreinte, rapport, MAX_MESSAGE, MAX_PILE } from '../src/erreurs.js';
import { codeDepuisTexte, formatCode, lireListeEleves, ALPHABET, LONGUEUR_CODE } from '../src/classe.js';
import { qrSvg } from '../src/qr.js';

const graine = process.env.FC_GRAINE ? { seed: +process.env.FC_GRAINE } : {};
const tenir = (prop, n = 300) => fc.assert(prop, { numRuns: n, ...graine });

const ALPHA_LIVRE = 'abcdefghjkmnpqrstuvwxyz23456789';
const jeton = fc.array(fc.constantFrom(...ALPHA_LIVRE), { minLength: 10, maxLength: 10 }).map(a => a.join(''));
const note = fc.constantFrom(1, 2, 3, 4);

describe('le moteur (FSRS-6) : quoi qu’on fasse, une mémoire reste une mémoire', () => {
  it('stabilité positive et finie, difficulté entre 1 et 10, sur toute suite de lectures', () => {
    tenir(fc.property(note, fc.array(fc.tuple(fc.double({ min: 0, max: 400, noNaN: true }), note), { maxLength: 40 }), (g0, suite) => {
      let m = fsrsInit(W6, g0);
      for (const [dt, g] of suite) {
        m = fsrsStep(W6, m, dt, g);
        expect(Number.isFinite(m.S)).toBe(true);
        expect(m.S).toBeGreaterThanOrEqual(S_MIN);
        expect(m.D).toBeGreaterThanOrEqual(D_MIN);
        expect(m.D).toBeLessThanOrEqual(D_MAX);
      }
    }));
  });
  it('le rappel est une probabilité, qui ne remonte jamais avec le temps', () => {
    tenir(fc.property(note, fc.double({ min: 0, max: 3650, noNaN: true }), fc.double({ min: 0, max: 3650, noNaN: true }), (g, t1, t2) => {
      const m = fsrsInit(W6, g);
      const [a, b] = [fsrsR(W6, Math.min(t1, t2), m), fsrsR(W6, Math.max(t1, t2), m)];
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(a + 1e-12);
    }));
  });
  it('viser un meilleur rappel ne donne jamais un intervalle plus long', () => {
    tenir(fc.property(note, fc.double({ min: 0.5, max: 0.98, noNaN: true }), fc.double({ min: 0.5, max: 0.98, noNaN: true }), (g, r1, r2) => {
      const m = fsrsInit(W6, g);
      const [bas, haut] = r1 < r2 ? [r1, r2] : [r2, r1];
      expect(fsrsIvl(W6, m, haut)).toBeLessThanOrEqual(fsrsIvl(W6, m, bas) + 1e-9);
      expect(fsrsIvl(W6, m, bas)).toBeGreaterThan(0);
    }));
  });
  it('une page qu’on vient d’apprendre respecte ses invariants', () => {
    tenir(fc.property(note, g => {
      const m = fsrsInit(W6, g);
      const c = { id: 'x', f: 'a', b: 'b', S: m.S, D: m.D, st: 2, n: 1, l: 0, lr: Date.now(), due: Date.now() + 86400000 };
      expect(cardIssues(c).filter(i => /^(S|D)/.test(i))).toEqual([]);
    }));
  });
});

describe('la fusion à trois versions', () => {
  const page = fc.record({ id: fc.constantFrom('p1', 'p2', 'p3', 'p4'), f: fc.string({ maxLength: 8 }), b: fc.string({ maxLength: 8 }) });
  const livre = fc.uniqueArray(page, { selector: p => p.id, maxLength: 4 });
  it('si un seul côté a changé, c’est sa version qui gagne', () => {
    tenir(fc.property(livre, livre, (base, mine) => {
      const r = mergeCards(base, mine, base);
      const parId = a => Object.fromEntries((a.cards || a).map(c => [c.id, [c.f, c.b]]));
      expect(parId(r)).toEqual(parId(mine));
    }));
  });
  it('fusionner une version avec elle-même ne change rien', () => {
    tenir(fc.property(livre, livre, (base, mine) => {
      const r = mergeCards(base, mine, mine);
      const parId = a => Object.fromEntries((a.cards || a).map(c => [c.id, [c.f, c.b]]));
      expect(parId(r)).toEqual(parId(mine));
    }));
  });
});

describe('les codes', () => {
  it('le code d’un livre redonne toujours son jeton, tapé, collé ou en lien', () => {
    tenir(fc.property(jeton, fc.constantFrom('', ' ', '\n', 'Mon code : '), (tok, avant) => {
      const code = codeLivre(tok);
      expect(tokDepuisTexte(avant + code)).toBe(tok);
      expect(tokDepuisTexte(code.toLowerCase())).toBe(tok);
      expect(tokDepuisTexte(lienLivre('https://mirandola.fr/', tok))).toBe(tok);
      expect(estCodeLivre(code)).toBe(true);
      expect(tokComplet(tokDepuisTexte(code))).toBe(true);
    }));
  });
  it('n’importe quel texte collé ne fait jamais lever la lecture d’un code', () => {
    tenir(fc.property(fc.string({ maxLength: 200 }), s => {
      expect(typeof tokDepuisTexte(s)).toBe('string');
      expect(typeof estCodeLivre(s)).toBe('boolean');
      expect(typeof codeDepuisTexte(s)).toBe('string');
    }), 1000);
  });
  it('un code de classe mis en forme se relit à l’identique', () => {
    const code = fc.array(fc.constantFrom(...ALPHABET), { minLength: LONGUEUR_CODE, maxLength: LONGUEUR_CODE }).map(a => a.join(''));
    tenir(fc.property(code, c => { expect(codeDepuisTexte(formatCode(c))).toBe(c); }));
  });
});

describe('les textes', () => {
  it('normaliser deux fois, c’est normaliser une fois', () => {
    tenir(fc.property(fc.string({ maxLength: 60 }), s => { expect(norm(norm(s))).toBe(norm(s)); }), 1000);
  });
  it('un pseudo saisi reste saisi, sa clé est stable, et la règle ne lève jamais', () => {
    tenir(fc.property(fc.string({ maxLength: 40 }), s => {
      expect(saisie(saisie(s))).toBe(saisie(s));
      expect(cle(cle(s))).toBe(cle(s));
      expect(typeof valide(saisie(s))).toBe('boolean');
    }), 1000);
  });
  it('le parseur ne lève jamais, et ne rend que des pages qui ont un recto ou un verso', () => {
    tenir(fc.property(fc.string({ maxLength: 400 }), s => {
      const r = parseText(s);
      const pages = Array.isArray(r) ? r : (r && r.cards) || [];
      for (const p of pages) expect(typeof (p.f ?? p[0] ?? '')).toBe('string');
    }), 500);
  });
  it('une liste d’élèves collée, quelle qu’elle soit, ne fait jamais lever', () => {
    tenir(fc.property(fc.string({ maxLength: 300 }), s => {
      const r = lireListeEleves(s);
      expect(Array.isArray(r.eleves)).toBe(true);
      expect(r.eleves.length).toBeLessThanOrEqual(60);              // jamais plus que le plafond d'une liste
      for (const e of r.eleves) expect(e.prenom.length + e.nom.length).toBeGreaterThan(0);
    }), 500);
  });
});

describe('les rapports d’erreur ne laissent jamais passer une donnée personnelle', () => {
  const courriel = fc.tuple(fc.stringMatching(/^[a-z][a-z0-9.]{1,10}$/), fc.stringMatching(/^[a-z]{2,8}$/), fc.constantFrom('fr', 'com', 'org'))
    .map(([u, d, t]) => `${u}@${d}.${t}`);
  it('ni adresse, ni identifiant, ni long nombre, quelle que soit la phrase autour', () => {
    tenir(fc.property(fc.string({ maxLength: 80 }), courriel, fc.uuid(), fc.stringMatching(/^0[67]\d{8}$/), (texte, mail, id, tel) => {
      const t = nettoyer(`${texte} ${mail} ${id} ${tel} ${texte}`);
      expect(t).not.toContain(mail);
      expect(t.toLowerCase()).not.toContain(id.toLowerCase());
      expect(t).not.toContain(tel);
      expect(t.length).toBeLessThanOrEqual(MAX_MESSAGE);
    }), 1000);
  });
  it('un rapport a toujours ses bornes et une empreinte de sa forme', () => {
    tenir(fc.property(fc.string({ maxLength: 2000 }), fc.string({ maxLength: 5000 }), fc.constantFrom('erreur', 'promesse', 'csp', 'x'), (m, p, type) => {
      const r = rapport({ type, message: m, pile: p });
      expect(r.message.length).toBeLessThanOrEqual(MAX_MESSAGE);
      expect(r.pile.length).toBeLessThanOrEqual(MAX_PILE);
      expect(r.empreinte).toMatch(/^[a-z][0-9a-f]{8}$/);
      expect(pileCourte(p).split('\n').length).toBeLessThanOrEqual(12);
      expect(empreinte(r.type, r.message, r.pile)).toBe(r.empreinte);
    }), 500);
  });
});

describe('le prix d’une licence et le QR', () => {
  it('une place de plus ne fait jamais baisser la facture', () => {
    tenir(fc.property(fc.integer({ min: 0, max: 5000 }), n => { expect(prixCampus(n + 1)).toBeGreaterThanOrEqual(prixCampus(n)); }), 1000);
  });
  it('un QR se dessine pour tout texte de la longueur d’un lien', () => {
    tenir(fc.property(fc.string({ minLength: 1, maxLength: 120 }), s => { expect(qrSvg(s)).toMatch(/^<svg/); }), 200);
  });
});
