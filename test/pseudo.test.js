import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX, MESSAGES, MOTS, PREFIXES, RACINES, RESERVES, cle, message, motif, proposer, saisie, valide } from '../src/pseudo.js';
import { ecritPseudo, pseudoNeuf, rpcPseudos } from '../src/base-locale/pseudos.js';

/* La base tranche avec `pseudo_motif` (migration 20261027090000) : ses
   listes doivent être celles de l'écran, mot pour mot, sinon l'écran dit
   « libre » à un pseudo que la base refuse (ou l'inverse). */
const sql = readFileSync('supabase/migrations/20261027090000_les_pseudos_ont_des_regles.sql', 'utf8');
const listeSql = nom => {
  const m = sql.match(new RegExp(nom + ' constant text\\[\\] := array\\[([^\\]]*)\\]'));
  return m[1].match(/'([^']*)'/g).map(x => x.slice(1, -1));
};

describe('les listes de la base et de l’écran', () => {
  it('mot pour mot, dans les deux sens', () => {
    expect(listeSql('reserves')).toEqual(RESERVES);
    expect(listeSql('prefixes')).toEqual(PREFIXES);
    expect(listeSql('mots')).toEqual(MOTS);
    expect(listeSql('racines')).toEqual(RACINES);
  });
  it('aucune racine ne se cache dans un mot honnête', () => {
    for (const m of ['calcul', 'consonne', 'abricot', 'boris', 'raphael', 'scunthorpe', 'pascal', 'constance', 'conrad', 'nicolas'])
      expect(motif(m), m).toBe('ok');
  });
});

describe('motif — dans l’ordre de la base', () => {
  it('la longueur', () => {
    expect(motif('')).toBe('court');
    expect(motif('ab')).toBe('court');
    expect(motif('abc')).toBe('ok');
    expect(motif('a'.repeat(MAX))).toBe('ok');
    expect(motif('a'.repeat(MAX + 1))).toBe('long');
  });
  it('les caractères : minuscules, chiffres, point, tiret bas', () => {
    expect(motif('Lea')).toBe('caracteres');
    expect(motif('lea-martin')).toBe('caracteres');
    expect(motif('léa')).toBe('caracteres');
    expect(motif('lea martin')).toBe('caracteres');
    expect(motif('lea<b>')).toBe('caracteres');
    expect(motif('lea.martin_75')).toBe('ok');
  });
  it('commence par une lettre, finit par une lettre ou un chiffre, un seul signe à la fois', () => {
    expect(motif('1lea')).toBe('debut');
    expect(motif('.lea')).toBe('debut');
    expect(motif('lea.')).toBe('fin');
    expect(motif('lea_')).toBe('fin');
    expect(motif('lea..m')).toBe('double');
    expect(motif('lea._m')).toBe('double');
    expect(motif('lea2007')).toBe('ok');
  });
  it('ce qui imite l’équipe ou un rôle', () => {
    for (const h of ['admin', 'lea.admin', 'folio', 'folioman', 'admin42', 'moderateur', 'prof.maths', 'support', 'staff_lea'])
      expect(motif(h), h).toBe('reserve');
    expect(motif('professionnel')).toBe('ok');   // « prof » ne compte que seul
    expect(motif('adminou')).toBe('reserve');     // préfixe
  });
  it('ce qui ne se dit pas, même en chiffres', () => {
    for (const h of ['connard', 'c0nn4rd', 'xx.con', 'pute', 'p.u.t.a.i.n', 'salope75', 'hitler', 'fdp', 'zz.connard'])
      expect(motif(h), h).toBe('interdit');
    for (const h of ['calcul', 'conte', 'leconte', 'cultura', 'sextant'])
      expect(motif(h), h).toBe('ok');
  });
  it('valide = motif ok', () => {
    expect(valide('lea.martin')).toBe(true);
    expect(valide('Lea')).toBe(false);
  });
});

describe('saisie — ce que le champ garde', () => {
  it('minuscules, sans accent, un espace devient un point, le reste disparaît', () => {
    expect(saisie('Léa Martin')).toBe('lea.martin');
    expect(saisie('  Zoé_75!! ')).toBe('.zoe_75.');
    expect(saisie('Ñúñez-Pérez')).toBe('nunezperez');
    expect(saisie('a'.repeat(30))).toHaveLength(MAX);
    expect(saisie(null)).toBe('');
  });
});

describe('cle — l’unicité au point et au tiret bas près', () => {
  it('« lea.martin », « lea_martin » et « leamartin » sont le même pseudo', () => {
    expect(cle('lea.martin')).toBe('leamartin');
    expect(cle('lea_martin')).toBe('leamartin');
    expect(cle('LEA_MARTIN')).toBe('leamartin');
  });
});

describe('proposer — un pseudo dans la règle', () => {
  it('le prénom, sans accent', () => {
    expect(proposer('Éloïse')).toBe('eloise');
    expect(proposer('Jean-Pierre Martin')).toBe('jeanpierre');
  });
  it('« lecteur » quand le prénom ne passe pas', () => {
    expect(proposer('')).toBe('lecteur');
    expect(proposer('Al')).toBe('lecteur');
    expect(proposer('Admin')).toBe('lecteur');
    expect(proposer('42')).toBe('lecteur');
  });
  it('toujours valide', () => {
    for (const p of ['Ève', 'Ulysse', 'Marie-Ève', '  ', 'Ñ', 'Zoé'])
      expect(valide(proposer(p)), p).toBe(true);
  });
});

describe('message — chaque verdict a sa phrase', () => {
  it('ceux de la règle et ceux de la base', () => {
    for (const k of ['court', 'long', 'caracteres', 'debut', 'fin', 'double', 'reserve', 'interdit', 'pris', 'meme', 'trop', 'hors_ligne'])
      expect(MESSAGES[k], k).toBeTruthy();
    expect(message('inconnu')).toMatch(/impossible/);
  });
});

/* La base locale (démo, parcours) rejoue la même porte que la vraie. */
describe('base locale — changer_pseudo, pseudo_libre, find_user', () => {
  const magasin = () => ({ users: [{ id: 'a', email: 'a@x.fr' }, { id: 'b', email: 'b@x.fr' }],
    tables: { profiles: [{ id: 'a', handle: 'lea', name: 'Léa' }, { id: 'b', handle: 'tom.b', name: 'Tom' }] } });
  const appel = (s, nom, corps, qui = 'a') => rpcPseudos(s, nom, corps, { id: qui })[1];

  it('le verdict de la règle, « meme », « pris » avec une variante libre', () => {
    const s = magasin();
    expect(appel(s, 'pseudo_libre', { p: 'ab' }).statut).toBe('court');
    expect(appel(s, 'pseudo_libre', { p: '@lea' }).statut).toBe('meme');
    const r = appel(s, 'pseudo_libre', { p: 'tom_b' });
    expect(r.statut).toBe('pris');
    expect(valide(r.suggestion) && cle(r.suggestion) !== 'tomb').toBe(true);
  });
  it('deux changements par semaine, et un pseudo quitté reste 30 jours à son titulaire', () => {
    const s = magasin();
    expect(appel(s, 'changer_pseudo', { p: 'lea.m' }).statut).toBe('ok');
    expect(appel(s, 'changer_pseudo', { p: 'lea.mm' }).statut).toBe('ok');
    const r = appel(s, 'changer_pseudo', { p: 'lea.mmm' });
    expect(r.statut).toBe('trop');
    expect(Date.parse(r.jusqua)).toBeGreaterThan(Date.now());
    expect(s.tables.profiles[0].handle).toBe('lea.mm');
    expect(appel(s, 'changer_pseudo', { p: 'lea' }, 'b').statut).toBe('pris');
  });
  it('trouver au point près, jamais soi', () => {
    const s = magasin();
    expect(appel(s, 'find_user', { q: '@TOM_B' }).map(p => p.id)).toEqual(['b']);
    expect(appel(s, 'find_user', { q: 'lea' })).toEqual([]);
  });
  it('l’API brute n’écrit plus le pseudo ; un compte neuf en reçoit un libre', () => {
    expect(ecritPseudo([{ id: 'a', handle: 'x' }])).toBe(true);
    expect(ecritPseudo([{ id: 'a', email: 'a@x.fr', name: 'Léa' }])).toBe(false);
    const p = pseudoNeuf(magasin(), 'Léa Durand', 'c');
    expect(p).toMatch(/^lea\d+$/);
  });
});
