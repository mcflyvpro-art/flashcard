import { describe, expect, it } from 'vitest';
import { aIgnorer, caseMs, empreinte, MAX_MESSAGE, navigateurDe, nettoyer, p75, pileCourte, rapport, tauxErreur } from '../src/erreurs.js';

const UUID = '3f2a9c1e-7b4d-4e2a-9f10-2c3d4e5f6a7b';
/* un jeton de la forme d'un JWT, assemblé ici pour qu'aucun chercheur de secrets ne le prenne pour un vrai */
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ0ZXN0LWZhdXgifQ', 'ZmF1c3NlLXNpZ25hdHVyZS1kZS10ZXN0'].join('.');

describe('nettoyer : rien qui désigne quelqu’un ne part', () => {
  it('retire adresse, jeton, identifiant, nombre long, requête d’une adresse, clé', () => {
    const t = nettoyer(`lea.martin+test@lycee.fr ${JWT} ${UUID} 0612345678 https://mirandola.fr/eleve/livres?q=secret#s=abc ${'sk_' + 'live_abcdefghij1234'} a1b2c3d4e5f6a7b8c9d0`);
    expect(t).not.toMatch(/lea|lycee|eyJ|3f2a9c1e|0612345678|secret|abc$|sk_live|a1b2c3d4/);
    expect(t).toContain('<courriel>');
    expect(t).toContain('<jeton>');
    expect(t).toContain('<id>');
    expect(t).toContain('<n>');
    expect(t).toContain('https://mirandola.fr/eleve/livres');
  });
  it('borne la longueur et replie les blancs', () => {
    expect(nettoyer('z'.repeat(1000)).length).toBe(MAX_MESSAGE);
    expect(nettoyer('  a \n\t b  ')).toBe('a b');
    expect(nettoyer(null)).toBe('');
  });
});

describe('pileCourte', () => {
  it('Chrome : fonction et fichier, sans chemin ni adresse', () => {
    const pile = `TypeError: Cannot read properties of null (reading 'cards')
    at ouvrirLivre (https://mirandola.fr/assets/app-3f2a91bc.js:1:123456)
    at async HTMLDocument.<anonymous> (https://mirandola.fr/assets/menus-9a8b7c6d.js:2:777)
    at chrome-extension://abcdef/content.js:1:2`;
    expect(pileCourte(pile)).toBe('ouvrirLivre app-3f2a91bc.js:1:123456\nHTMLDocument.<anonymous> menus-9a8b7c6d.js:2:777');
  });
  it('Safari et Firefox : fonction@fichier', () => {
    expect(pileCourte('render@https://mirandola.fr/assets/app-3f2a91bc.js:1:2048\n@https://mirandola.fr/app:3:5'))
      .toBe('render app-3f2a91bc.js:1:2048\napp:3:5');
  });
  it('une adresse de page qui finit par un identifiant ne le garde pas', () => {
    expect(pileCourte(`f@https://mirandola.fr/eleve/livres/${UUID}:12:5`)).toBe('f <id>:12:5');
  });
  it('douze lignes au plus, une pile vide reste vide', () => {
    const pile = Array.from({ length: 30 }, (_, i) => `at f${i} (https://x/a.js:1:${i})`).join('\n');
    expect(pileCourte(pile).split('\n')).toHaveLength(12);
    expect(pileCourte('')).toBe('');
  });
});

describe('empreinte', () => {
  it('la même erreur d’un build à l’autre et d’un nombre à l’autre a la même empreinte', () => {
    const a = empreinte('erreur', 'x is null at 12', 'f app-3f2a91bc.js:1:100');
    const b = empreinte('erreur', 'x is null at 47', 'f app-77ee0011.js:1:999');
    expect(a).toBe(b);
    expect(a).toMatch(/^e[0-9a-f]{8}$/);
  });
  it('deux erreurs différentes, deux empreintes', () => {
    expect(empreinte('erreur', 'x is null', 'f a.js:1:1')).not.toBe(empreinte('erreur', 'y is null', 'f a.js:1:1'));
    expect(empreinte('erreur', 'x', '')).not.toBe(empreinte('promesse', 'x', ''));
  });
});

describe('aIgnorer', () => {
  it('ce qui n’est pas à nous', () => {
    expect(aIgnorer('Script error.')).toBe(true);
    expect(aIgnorer('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(aIgnorer('x', 'chrome-extension://abc/x.js')).toBe(true);
    expect(aIgnorer('TypeError: Failed to fetch')).toBe(true);
    expect(aIgnorer('Load failed')).toBe(true);
    expect(aIgnorer('AbortError: The user aborted a request.')).toBe(true);
  });
  it('un vrai défaut se garde, dont un morceau du build qui ne se charge plus', () => {
    expect(aIgnorer('TypeError: Failed to fetch dynamically imported module: https://mirandola.fr/assets/prof-1.js')).toBe(false);
    expect(aIgnorer('Importing a module script failed.')).toBe(false);
    expect(aIgnorer("Cannot read properties of null (reading 'cards')")).toBe(false);
  });
});

describe('navigateurDe', () => {
  it('le nom et la version majeure, rien de plus', () => {
    expect(navigateurDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1')).toBe('safari 26');
    expect(navigateurDe('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36')).toBe('chrome 140');
    expect(navigateurDe('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1')).toBe('chrome-ios 140');
    expect(navigateurDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0')).toBe('firefox 144');
    expect(navigateurDe('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36')).toBe('samsung 28');
    expect(navigateurDe('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0')).toBe('edge 140');
    expect(navigateurDe('')).toBe('autre');
  });
});

describe('rapport', () => {
  it('ce qui part, et seulement ça', () => {
    const r = rapport({ type: 'erreur', message: `Échec pour ${UUID}`, pile: 'at f (https://mirandola.fr/assets/a-1234abcd.js:1:2)',
      ecran: 'deck', build: 'abc123', plateforme: 'ios', navigateur: 'safari 26', installee: true, ms: 12.6 });
    expect(Object.keys(r).sort()).toEqual(['build', 'ecran', 'empreinte', 'installee', 'message', 'ms', 'navigateur', 'pile', 'plateforme', 'type']);
    expect(r.message).toBe('Échec pour <id>');
    expect(r.ms).toBe(13);
  });
  it('un type inconnu devient « erreur », un écran ne garde que des lettres', () => {
    const r = rapport({ type: 'pirate', message: 'x', ecran: '/eleve/livres/<script>' });
    expect(r.type).toBe('erreur');
    expect(r.ecran).toBe('elevelivresscript');
  });
});

describe('le temps de démarrage', () => {
  it('six cases, et le p75 lu sur leurs totaux', () => {
    expect([0, 999, 1000, 2500, 4999, 9999, 60000].map(caseMs)).toEqual([0, 0, 1, 2, 3, 4, 5]);
    expect(p75([10, 0, 0, 0, 0, 0])).toBe(1000);
    expect(p75([5, 3, 2, 0, 0, 0])).toBe(2000);
    expect(p75([0, 0, 0, 0, 0, 4])).toBe(Infinity);
    expect(p75([0, 0, 0, 0, 0, 0])).toBe(null);
  });
});

describe('le taux d’erreur', () => {
  it('des erreurs par ouverture, en pour cent au dixième ; rien sans ouverture', () => {
    expect(tauxErreur(1, 200)).toBe(0.5);
    expect(tauxErreur(3, 7)).toBe(42.9);
    expect(tauxErreur(0, 50)).toBe(0);
    expect(tauxErreur(4, 0)).toBe(null);
  });
});

/* ce que les tests de mutation (npm run mutation, 2026-11-07) ont montré mal
   gardé : les bornes exactes, les ancres, les valeurs par défaut, et la
   stabilité des empreintes */
describe('les bornes exactes', () => {
  it('un texte de la longueur maximale passe entier ; un signe de plus, il est coupé', () => {
    expect(nettoyer('z'.repeat(MAX_MESSAGE))).toBe('z'.repeat(MAX_MESSAGE));
    const t = nettoyer('z'.repeat(MAX_MESSAGE + 1));
    expect(t).toHaveLength(MAX_MESSAGE);
    expect(t.endsWith('…')).toBe(true);
  });
  it('une pile trop longue est coupée à sa borne', () => {
    const ligne = n => `at f${n} (https://x/${'z'.repeat(70)}${n}.js:1:2)`;
    const p = pileCourte(Array.from({ length: 12 }, (_, i) => ligne(i)).join('\n'), 200);
    expect(p).toHaveLength(200);
    expect(p.endsWith('…')).toBe(true);
    expect(pileCourte(ligne(1), 10_000).endsWith('…')).toBe(false);
  });
  it('une ligne d’extension Safari est retirée de la pile', () => {
    expect(pileCourte('at f (safari-extension://abc/x.js:1:2)\nat g (https://x/a.js:3:4)')).toBe('g a.js:3:4');
  });
  it('« async » ne se retire qu’en tête du nom de la fonction', () => {
    expect(pileCourte('at async ouvrir (https://x/a.js:1:2)')).toBe('ouvrir a.js:1:2');
    expect(pileCourte('at fasync z (https://x/a.js:1:2)')).toBe('fasync z a.js:1:2');
  });
});

describe('les empreintes ne bougent jamais', () => {
  it('les mêmes qu’au premier jour : une erreur connue ne revient pas « nouvelle »', () => {
    expect(empreinte('erreur', 'x', '')).toBe('e326929c0');
    expect(empreinte('promesse', 'Cannot read properties of null', '')).toBe('pcd451f63');
    expect(empreinte('erreur', 'boum', 'ouvrir app.js:1:2')).toBe('ec7f17500');
  });
  it('les nombres, la ligne, la colonne et le hachage du build ne comptent pas ; le reste, si', () => {
    expect(empreinte('erreur', 'à la page 12', '')).toBe(empreinte('erreur', 'à la page 7', ''));
    expect(empreinte('erreur', 'x1', '')).not.toBe(empreinte('erreur', 'x', ''));
    expect(empreinte('erreur', 'm', 'f a.js:12:5')).toBe(empreinte('erreur', 'm', 'f a.js:22:9'));
    expect(empreinte('erreur', 'm', 'f app.js:1:1')).toBe(empreinte('erreur', 'm', 'f app-1234abcd.js:1:1'));
    expect(empreinte('erreur', 'm', 'f a.js:1:1')).not.toBe(empreinte('erreur', 'm', 'g a.js:1:1'));
    expect(empreinte('erreur', 'm', 'a\nb\nc\nd')).toBe(empreinte('erreur', 'm', 'a\nb\nc\nautre'));
  });
});

describe('ce qui s’ignore, et rien de plus', () => {
  it('les messages exacts seulement, à un blanc près', () => {
    expect(aIgnorer('  Script error  ')).toBe(true);
    expect(aIgnorer('Mon Script error.')).toBe(false);
    expect(aIgnorer('Script error. et la suite')).toBe(false);
    expect(aIgnorer('Le chargement : Load failed')).toBe(false);
    expect(aIgnorer('  Failed to fetch  ')).toBe(true);
    expect(aIgnorer('NetworkError when attempting to fetch resource.')).toBe(true);
    expect(aIgnorer('The network connection was lost.')).toBe(true);
    expect(aIgnorer('Erreur après AbortError')).toBe(false);
    expect(aIgnorer('  AbortError: annulé')).toBe(true);
    expect(aIgnorer('x', 'safari-extension://abc/x.js')).toBe(true);
    expect(aIgnorer('x')).toBe(false);
  });
});

describe('le reste d’un rapport', () => {
  it('Safari sous Linux (WebKit) se reconnaît aussi', () => {
    expect(navigateurDe('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe('safari 17');
  });
  it('les valeurs par défaut, et chaque champ à sa borne', () => {
    const r = rapport({ type: 'erreur', message: 'x' });
    expect([r.pile, r.ecran, r.build, r.plateforme, r.navigateur, r.installee, r.ms]).toEqual(['', 'inconnu', '', '', '', false, null]);
    const l = rapport({ type: 'erreur', message: 'x', ecran: 'e'.repeat(60), build: 'b'.repeat(60), plateforme: 'p'.repeat(60),
      navigateur: 'n'.repeat(60), installee: 1 });
    expect([l.ecran.length, l.build.length, l.plateforme.length, l.navigateur.length, l.installee]).toEqual([40, 40, 20, 30, true]);
  });
  it('le p75 tombe dans la case où l’on atteint juste les trois quarts', () => {
    expect(p75([3, 1, 0, 0, 0, 0])).toBe(1000);
  });
});
