/* Les règles d'une classe (src/classe.js) : codes, statuts d'inscription,
   état d'un élève, tris, synthèses, échéances — et aucune date décalée,
   quel que soit le fuseau de l'appareil (M16.T5). */
import process from 'node:process';
import { afterEach, describe, it, expect } from 'vitest';
import {
  ALPHABET, CREATION, DUREES, aTraiter, codeComplet, codeDepuisTexte, dansJours, echeance, emailCarte,
  correspond, erreurPlaces, etatDevoir, etatDevoirEleve, etatEleve, etatInscriptions, filtrerEleves, finTexte,
  formatCode, grilleMois, iso, jourCourt, jourLong, joursEntre, lienCarte, lienRejoindre,
  lireCarte, lireListeEleves, messageStatut, nomPropre, nomValide, normCode, normIdentifiant, parJour,
  rangerClasses, syntheseAccueil, syntheseClasse, trierEleves
} from '../src/classe.js';

describe('le code d’une classe', () => {
  it('31 symboles, sans 0, O, 1, I ni L', () => {
    expect(ALPHABET).toHaveLength(31);
    for (const c of '0O1IL') expect(ALPHABET.includes(c)).toBe(false);
  });
  it('se tape comme on veut : minuscules, espaces, tiret', () => {
    expect(normCode(' k7qm-2xrp ')).toBe('K7QM2XRP');
    expect(formatCode('k7qm2xrp')).toBe('K7QM-2XRP');
    expect(formatCode('K7Q')).toBe('K7Q');
    expect(codeComplet('k7qm 2xrp')).toBe(true);
  });
  it('est refusé avant tout aller-retour s’il ne peut pas exister', () => {
    expect(codeComplet('K7QM2XR')).toBe(false);          // 7 caractères
    expect(codeComplet('K7QM2XR0')).toBe(false);         // un zéro
    expect(codeComplet('K7QM2XRI')).toBe(false);         // un I
    expect(normCode('ABCDEFGHJK')).toHaveLength(8);      // tronqué à 8
  });
  it('se retrouve dans un lien collé', () => {
    expect(codeDepuisTexte('https://folio.app/?rejoindre=K7QM-2XRP')).toBe('K7QM2XRP');
    expect(codeDepuisTexte('https://folio.app/flashcard/?x=1&rejoindre=k7qm2xrp#haut')).toBe('K7QM2XRP');
    expect(codeDepuisTexte('K7QM 2XRP')).toBe('K7QM2XRP');
  });
  it('fait un lien d’invitation propre, même depuis une adresse chargée', () => {
    expect(lienRejoindre('https://x.github.io/flashcard/?go=stats#a', 'k7qm-2xrp'))
      .toBe('https://x.github.io/flashcard/?rejoindre=K7QM2XRP');
  });
});

describe('ce que la base répond', () => {
  it('chaque statut a un titre, et un ton qui dit quoi faire', () => {
    for (const s of ['apercu', 'inscrit', 'collegue', 'attente', 'deja', 'refuse', 'ferme', 'expire',
      'complet', 'archive', 'etablissement', 'role', 'inconnu', 'trop', 'demandes', 'connexion']) {
      const m = messageStatut(s);
      expect(m.titre.length, s).toBeGreaterThan(3);
      expect(['ok', 'attente', 'ko']).toContain(m.ton);
    }
    expect(messageStatut('attente').ton).toBe('attente');
    expect(messageStatut('inscrit').ton).toBe('ok');
    expect(messageStatut('trop').ton).toBe('ko');
  });
  it('un statut inconnu de l’app ne laisse jamais un écran vide', () => {
    expect(messageStatut('nouveau-statut-serveur').titre).toBe('Impossible pour l’instant');
  });
});

describe('les inscriptions d’une classe', () => {
  const base = { ouvert: true, validation: true, places: 30, effectif: 12, archivee: false, fin: null };
  const t0 = Date.parse('2026-10-24T10:00:00Z');
  it('ouvertes, sur validation ou à tous', () => {
    expect(etatInscriptions(base, t0)).toMatchObject({ k: 'ouvert', ouvert: true, t: 'Ouvertes, sur validation' });
    expect(etatInscriptions({ ...base, validation: false }, t0).t).toBe('Ouvertes à tous');
  });
  it('archivée l’emporte sur tout, puis fermée, expirée, complète', () => {
    expect(etatInscriptions({ ...base, archivee: true, ouvert: false }, t0).k).toBe('archive');
    expect(etatInscriptions({ ...base, ouvert: false }, t0).k).toBe('ferme');
    expect(etatInscriptions({ ...base, fin: '2026-10-24T09:59:00Z' }, t0).k).toBe('expire');
    expect(etatInscriptions({ ...base, effectif: 30 }, t0).k).toBe('complet');
  });
  it('dit combien de temps le code reste valable', () => {
    expect(finTexte(null, t0)).toBe('sans limite de durée');
    expect(finTexte('2026-10-24T10:52:00Z', t0)).toBe('encore 52 min');
    expect(finTexte('2026-10-24T15:00:00Z', t0)).toBe('encore 5 h');
    expect(finTexte('2026-10-31T10:00:00Z', t0)).toBe('encore 7 jours');
    expect(finTexte('2026-10-24T09:00:00Z', t0)).toBe('expiré');
  });
  it('les durées proposées sont celles que la base accepte', () => {
    for (const d of DUREES) expect(d.min >= 0 && d.min <= 525600).toBe(true);
    expect(DUREES.some(d => d.min === 0)).toBe(true);
  });
  it('le nombre de places : entre 1 et 300, jamais sous l’effectif', () => {
    expect(erreurPlaces(30, 12)).toBe('');
    expect(erreurPlaces(0, 0)).toMatch(/Entre 1 et 300/);
    expect(erreurPlaces(301, 0)).toMatch(/Entre 1 et 300/);
    expect(erreurPlaces(10.5, 0)).toMatch(/Entre 1 et 300/);
    expect(erreurPlaces(10, 12)).toBe('La classe compte déjà 12 élèves');
  });
});

const eleve = (who, x = {}) => ({ user_id: who, who, handle: who.toLowerCase(), donnes: 3, rendus: 3,
  retard: 0, jamais: false, pct: 70, pages7: 5, inscrit: '2026-09-02T08:00:00Z', ...x });

describe('l’état d’un élève', () => {
  it('le plus grave l’emporte', () => {
    expect(etatEleve(eleve('A', { jamais: true, retard: 2 })).k).toBe('jamais');
    expect(etatEleve(eleve('A', { retard: 2, rendus: 1 })).t).toBe('2 devoirs en retard');
    expect(etatEleve(eleve('A', { retard: 1, rendus: 2 })).t).toBe('1 devoir en retard');
    expect(etatEleve(eleve('A', { rendus: 1 })).t).toBe('2 en cours');
    expect(etatEleve(eleve('A')).k).toBe('ok');
    expect(etatEleve(eleve('A', { donnes: 0, rendus: 0 })).k).toBe('neutre');
  });
});

describe('trier et chercher', () => {
  const l = [eleve('Zoé', { pct: 90, pages7: 1, inscrit: '2026-09-01' }),
             eleve('Émile', { retard: 2, rendus: 1, pct: 40, pages7: 9, inscrit: '2026-10-01' }),
             eleve('adam', { jamais: true, pct: 0, pages7: 0, inscrit: '2026-09-15' }),
             eleve('Bob', { rendus: 2, pct: 60, pages7: 3, inscrit: '2026-09-10' })];
  it('« qui décroche » met le retard, puis les jamais venus, en tête', () => {
    expect(trierEleves(l, 'suivi').map(m => m.who)).toEqual(['Émile', 'adam', 'Bob', 'Zoé']);
  });
  it('par nom, à la française (accents et casse ignorés)', () => {
    expect(trierEleves(l, 'nom').map(m => m.who)).toEqual(['adam', 'Bob', 'Émile', 'Zoé']);
  });
  it('par réussite, activité, arrivée', () => {
    expect(trierEleves(l, 'reussite')[0].who).toBe('Zoé');
    expect(trierEleves(l, 'activite')[0].who).toBe('Émile');
    expect(trierEleves(l, 'arrivee')[0].who).toBe('Émile');
  });
  it('ne modifie pas la liste reçue', () => {
    const avant = l.map(m => m.who);
    trierEleves(l, 'nom');
    expect(l.map(m => m.who)).toEqual(avant);
  });
  it('cherche dans le nom et le pseudo, sans accent ni majuscule', () => {
    expect(filtrerEleves(l, 'emile').map(m => m.who)).toEqual(['Émile']);
    expect(filtrerEleves(l, 'ÉMI').map(m => m.who)).toEqual(['Émile']);
    expect(filtrerEleves(l, 'ZO').map(m => m.who)).toEqual(['Zoé']);
    expect(filtrerEleves(l, '', 'jamais').map(m => m.who)).toEqual(['adam']);
    expect(filtrerEleves(l, '', 'ko').map(m => m.who)).toEqual(['Émile']);
    expect(filtrerEleves(l, '', 'tous')).toHaveLength(4);
  });
  it('un élève jamais connecté qui a un devoir échu est aussi « en retard », comme au tableau de bord', () => {
    const k = [eleve('Absent', { jamais: true, retard: 1, rendus: 0 }), eleve('Lent', { retard: 2, rendus: 1 }), eleve('Sage', { rendus: 3 })];
    expect(etatEleve(k[0]).k).toBe('jamais');                                  // son état : le plus grave
    expect(filtrerEleves(k, '', 'ko').map(m => m.who)).toEqual(['Absent', 'Lent']);
    expect(filtrerEleves(k, '', 'jamais').map(m => m.who)).toEqual(['Absent']);
    expect(k.filter(m => correspond(m, 'ko'))).toHaveLength(syntheseAccueil([{ retard: 2 }]).retard);
  });
});

describe('la synthèse d’une classe', () => {
  const l = [eleve('A', { pct: 85 }), eleve('B', { pct: 50, rendus: 2 }), eleve('C', { pct: 30, retard: 1, rendus: 2 }),
             eleve('D', { jamais: true, pct: 0, pages7: 0 })];
  const s = syntheseClasse(l);
  it('chaque élève est compté une fois, dans son état', () => {
    expect(s.paquets.map(p => [p.k, p.l.length])).toEqual([['ok', 1], ['am', 1], ['ko', 1], ['jamais', 1]]);
    expect(s.paquets.reduce((a, p) => a + p.l.length, 0)).toBe(4);
  });
  it('la moyenne ne compte que les élèves notés, la répartition par tranches de 20', () => {
    expect(s.moyenne).toBe(55);
    expect(s.notes).toBe(3);
    expect(s.tranches.map(t => t.n)).toEqual([0, 1, 1, 0, 1]);
  });
  it('à reprendre : retard, jamais venus, moins de 45 %', () => {
    expect(s.aReprendre.map(m => m.who)).toEqual(['C', 'D']);
  });
  it('activité de la semaine', () => {
    expect(s.actifs).toBe(3);
    expect(s.pages).toBe(15);
  });
  it('une classe vide ne divise pas par zéro', () => {
    expect(syntheseClasse([])).toMatchObject({ n: 0, moyenne: 0, paquets: [], aReprendre: [] });
  });
});

describe('l’accueil du professeur', () => {
  const cl = [
    { id: 'a', name: '2nde 4', effectif: 30, attente: 3, retard: 5, jamais: 2, encours: 2, devoirs: 4, actifs7: 20 },
    { id: 'b', name: '1re B', effectif: 0, attente: 0, retard: 0, jamais: 0, encours: 0, devoirs: 0 },
    { id: 'c', name: 'Option', effectif: 12, attente: 0, retard: 0, jamais: 0, devoirs: 0 },
    { id: 'd', name: 'Ancienne', effectif: 28, attente: 4, retard: 9, archivee: true }
  ];
  it('les totaux ignorent les classes archivées', () => {
    expect(syntheseAccueil(cl)).toEqual({ classes: 3, eleves: 42, attente: 3, retard: 5, jamais: 2, encours: 2, actifs: 20 });
  });
  it('à traiter : demandes d’abord, puis retards, jamais venus, classes vides, sans devoir', () => {
    expect(aTraiter(cl).map(x => `${x.k}:${x.cid}`)).toEqual(['attente:a', 'retard:a', 'jamais:a', 'vide:b', 'sansdevoir:c']);
  });
  it('les archives à part', () => {
    const r = rangerClasses(cl);
    expect(r.actives.map(c => c.id)).toEqual(['a', 'b', 'c']);
    expect(r.archives.map(c => c.id)).toEqual(['d']);
  });
});

describe('les devoirs', () => {
  it('côté prof : en retard tant que tout le monde n’a pas rendu', () => {
    const d = { due: '2026-10-20', effectif: 30, ouvert: 25, rendu: 20 };
    expect(etatDevoir(d, '2026-10-24')).toMatchObject({ tard: true, pasOuvert: 5, taux: 67, echeance: 'il y a 4 jours' });
    expect(etatDevoir({ ...d, rendu: 30 }, '2026-10-24').tard).toBe(false);
    expect(etatDevoir({ ...d, effectif: 0, ouvert: 0, rendu: 0 }, '2026-10-24').taux).toBe(0);
  });
  it('côté élève : rendu, en retard, commencé, à faire', () => {
    expect(etatDevoirEleve({ etat: 'rendu', due: '2026-10-01' }, '2026-10-24').k).toBe('ok');
    expect(etatDevoirEleve({ etat: 'commence', due: '2026-10-01' }, '2026-10-24').t).toBe('En retard');
    expect(etatDevoirEleve({ etat: 'commence', due: '2026-10-30', vus: 3, n: 10 }, '2026-10-24').t).toBe('3/10 cartes');
    expect(etatDevoirEleve({ etat: 'a_faire', due: '2026-10-30' }, '2026-10-24').t).toBe('À faire');
  });
  it('rangés par jour d’échéance', () => {
    const m = parJour([{ id: 1, due: '2026-10-30' }, { id: 2, due: '2026-10-30' }, { id: 3, due: null }]);
    expect(Object.keys(m)).toEqual(['2026-10-30']);
    expect(m['2026-10-30']).toHaveLength(2);
  });
});

/* M16.T5 : un professeur à Nouméa, un élève à Los Angeles, un serveur à
   Paris — la même échéance doit se lire le même jour pour tous. */
describe('aucun décalage de fuseau', () => {
  const fuseau = process.env.TZ;
  afterEach(() => { process.env.TZ = fuseau; });
  // [fuseau, décalage attendu le 24/10/2026 à midi, en minutes] : la preuve que le fuseau s'applique
  for (const [tz, decalage] of [['Pacific/Kiritimati', -840], ['America/Los_Angeles', 420],
                                ['Europe/Paris', -120], ['Pacific/Noumea', -660]]) {
    it(`échéances et calendrier justes en ${tz}`, () => {
      process.env.TZ = tz;
      expect(new Date(2026, 9, 24, 12).getTimezoneOffset()).toBe(decalage);
      expect(joursEntre('2026-10-24', '2026-10-25')).toBe(1);
      expect(joursEntre('2026-03-28', '2026-03-30')).toBe(2);         // passage à l'heure d'été (Europe)
      expect(joursEntre('2026-10-24', '2026-11-02')).toBe(9);         // retour à l'heure d'hiver
      expect(echeance('2026-10-25', '2026-10-24')).toBe('demain');
      expect(echeance('2026-10-24', '2026-10-24')).toBe('aujourd’hui');
      expect(echeance('2026-10-23', '2026-10-24')).toBe('hier');
      expect(echeance('2026-10-31', '2026-10-24')).toBe('dans 7 jours');
      expect(jourLong('2026-10-24')).toBe('samedi 24 octobre');
      expect(jourCourt('2026-10-24')).toBe('24/10');
      expect(dansJours(7, new Date(2026, 9, 24, 23, 30))).toBe('2026-10-31');
      expect(iso(new Date(2026, 9, 24, 0, 5))).toBe('2026-10-24');
      const g = grilleMois(2026, 9);                                   // octobre 2026 commence un jeudi
      expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
      expect(g[g.length - 1]).toBe('2026-10-31');
    });
  }
});

describe('Prénom NOM, rien d’autre', () => {
  it('même mise en forme que la base (nom_propre)', () => {
    expect(nomPropre('alice', 'martin')).toBe('Alice MARTIN');
    expect(nomPropre('  jean-pierre ', 'de la  fontaine')).toBe('Jean-Pierre DE LA FONTAINE');
    expect(nomPropre('élodie', 'ñúñez')).toBe('Élodie ÑÚÑEZ');
    expect(nomPropre("marie-ève", "d'arc")).toBe("Marie-Ève D'ARC");
  });
  it('un nom fait de lettres, pas d’un pseudo', () => {
    expect(nomValide('Élodie')).toBe(true);
    expect(nomValide("O'Neil")).toBe(true);
    expect(nomValide('Dark_Sasuke')).toBe(false);
    expect(nomValide('Lucas93')).toBe(false);
    expect(nomValide('<b>x</b>')).toBe(false);
    expect(nomValide('')).toBe(false);
    expect(nomValide('a'.repeat(41))).toBe(false);
  });
});

describe('lire une liste de classe collée', () => {
  const noms = l => lireListeEleves(l).eleves.map(e => e.complet);
  it('l’export Pronote : « NOM Prénom », nom en capitales, même composé', () => {
    expect(noms('MARTIN Alice\nDE LA FONTAINE Jean-Pierre\nN’DIAYE Awa')).toEqual(
      ['Alice MARTIN', 'Jean-Pierre DE LA FONTAINE', 'Awa N’DIAYE']);
  });
  it('« Prénom Nom » sans capitales : le dernier mot est le nom', () => {
    expect(noms('Alice Martin\nLéo Dubois')).toEqual(['Alice MARTIN', 'Léo DUBOIS']);
    expect(noms('Alice MARTIN')).toEqual(['Alice MARTIN']);
  });
  it('un tableur : « Nom ; Prénom », tabulations, colonnes en trop, ligne d’en-tête', () => {
    expect(noms('Nom;Prénom;Classe\nMartin;Alice;2nde 4\nDubois\tLéo\tx')).toEqual(['Alice MARTIN', 'Léo DUBOIS']);
    expect(noms('Prénom,Nom\nAlice,MARTIN')).toEqual(['Alice MARTIN']);
  });
  it('un nom complet dans la première colonne, la classe dans la seconde', () => {
    expect(noms('MARTIN Alice;2nde 4')).toEqual(['Alice MARTIN']);
  });
  it('doublons retirés (casse et accents), lignes illisibles rendues, 60 au plus', () => {
    const r = lireListeEleves('Alice Martin\nalice martin\nalice MARTÎN\nZorro\nxX_dark_Xx 93\n\n');
    expect(r.eleves.map(e => e.complet)).toEqual(['Alice MARTIN']);         // comme cle_nom() en base
    expect(noms('ALICE martin')).toEqual(['Martin ALICE']);                  // les capitales désignent le nom
    expect(r.ignorees).toEqual(['Zorro', 'xX_dark_Xx 93']);
    const longue = lireListeEleves(Array.from({ length: 70 }, (_, i) => `Élève ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26]}${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(i / 26)]}`).join('\n'));
    expect(longue.eleves).toHaveLength(60);
    expect(longue.trop).toBe(10);
  });
});

describe('la carte de connexion', () => {
  it('l’identifiant devient une adresse qui ne peut recevoir aucun courriel', () => {
    expect(emailCarte(' Alice.Martin ')).toBe('alice.martin@eleves.folio.invalid');
    expect(emailCarte('alice.martin@eleves.folio.invalid')).toBe('alice.martin@eleves.folio.invalid');
    expect(normIdentifiant('jean pierre.dupont2')).toBe('jeanpierre.dupont2');
  });
  it('le QR porte l’identifiant et le code, et se relit', () => {
    const l = lienCarte('https://x.github.io/flashcard/?go=stats', 'alice.martin2', 'k7qm-2xrp');
    expect(l).toBe('https://x.github.io/flashcard/?carte=alice.martin2-K7QM2XRP');
    expect(lireCarte(l.slice(l.indexOf('?')))).toEqual({ identifiant: 'alice.martin2', code: 'K7QM2XRP' });
  });
  it('une carte abîmée ne tente rien', () => {
    expect(lireCarte('?carte=alice.martin-K7QM')).toBeNull();
    expect(lireCarte('?carte=-K7QM2XRP')).toBeNull();
    expect(lireCarte('?go=stats')).toBeNull();
  });
  it('chaque statut de création a son libellé', () => {
    for (const s of ['cree', 'deja', 'homonyme', 'complet', 'invalide']) expect(CREATION[s][1].length).toBeGreaterThan(3);
  });
});

