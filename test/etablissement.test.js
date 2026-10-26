import { describe, it, expect } from 'vitest';
import {
  aRelancer, BESOINS, bienvenue, bilanSuivi, changeLe, compterEtapes, courrielReferent, cycleDe, ETAPES, etatLicence, filtrerSuivi,
  lienCourriel, messageDemande, messageEtab, motDePasseProvisoire, NIVEAUX, nouvelleDemande, ORDRE_ETAPES, prochainPas, renouvellement, ROLES_CODE, RYTHMES, trierSuivi, uaiValide
} from '../src/etablissement.js';

describe('messageEtab — la réponse de la base, en clair', () => {
  it('chaque statut connu a un titre et un ton', () => {
    for (const s of ['ok', 'deja', 'choisir', 'classe', 'autre', 'gere', 'role', 'soi', 'plein', 'complet', 'licence',
      'nom', 'inconnu', 'trop', 'connexion']) {
      const m = messageEtab(s);
      expect(m.titre.length).toBeGreaterThan(5);
      expect(['ok', 'ko']).toContain(m.ton);
    }
  });
  it('un statut inconnu ne laisse jamais un écran vide', () => {
    expect(messageEtab('n-importe-quoi')).toEqual({ ton: 'ko', titre: 'Impossible pour l’instant', texte: 'Réessaie dans un moment.' });
  });
  it('trois rôles nommés', () => {
    expect(Object.keys(ROLES_CODE)).toEqual(['eleve', 'prof', 'ref']);
  });
});

describe('bienvenue — ce qu’on dit en entrant', () => {
  it('élève : son établissement et sa classe', () => {
    expect(bienvenue({ type: 'etab', quel: 'eleve', nom: 'Lycée Camus', classe: '2nde A' })).toBe('Bienvenue · Lycée Camus · 2nde A');
  });
  it('référent, professeur, professeur particulier', () => {
    expect(bienvenue({ type: 'etab', quel: 'ref', nom: 'Lycée Camus' })).toBe('Tu es référent · Lycée Camus');
    expect(bienvenue({ type: 'etab', quel: 'prof', nom: 'Lycée Camus' })).toBe('Bienvenue · Lycée Camus');
    expect(bienvenue({ type: 'prof', nom: 'M. Durand', classe: 'Mes élèves' })).toBe('Tu suis M. Durand · Mes élèves');
  });
});

describe('le suivi commercial', () => {
  it('cinq étapes, dans l’ordre de la vente', () => {
    expect(Object.keys(ETAPES)).toEqual(['prospect', 'demo', 'client', 'pause', 'perdu']);
    expect(Object.keys(BESOINS).length).toBeGreaterThan(3);
  });
});

describe('etatLicence — où en est la licence', () => {
  const auj = '2026-10-25';
  it('places prises sur places achetées, date au format français', () => {
    const l = etatLicence({ offre: 'etablissement', places: 400, eleves: 312, licence_fin: '2027-08-31' }, auj);
    expect(l).toMatchObject({ k: 'ok', places: '312 / 400', libre: 88, fin: '31/08/2027', offre: 'Licence', pc: 78 });
  });
  it('pleine dès que les élèves atteignent les places', () => {
    expect(etatLicence({ places: 60, eleves: 60, licence_fin: '2027-01-01' }, auj).k).toBe('pleine');
  });
  it('bientôt finie à 30 jours ou moins, échue la veille', () => {
    expect(etatLicence({ places: 60, eleves: 3, licence_fin: '2026-11-24', offre: 'demo' }, auj)).toMatchObject({ k: 'bientot', jours: 30, offre: 'Démo' });
    expect(etatLicence({ places: 60, eleves: 3, licence_fin: '2026-10-24' }, auj)).toMatchObject({ k: 'echue', jours: -1 });
  });
  it('échue passe avant pleine : c’est ce qu’il faut régler d’abord', () => {
    expect(etatLicence({ places: 2, eleves: 2, licence_fin: '2026-01-01' }, auj).k).toBe('echue');
  });
  it('sans plafond ni fin : un simple décompte', () => {
    expect(etatLicence({ places: null, eleves: 1, licence_fin: null }, auj)).toMatchObject({ k: 'ok', places: '1 élève', fin: 'sans fin', libre: null });
  });
});

describe('le rythme des codes — quand un code change de lui-même', () => {
  it('trois rythmes, aucun « jamais »', () => {
    expect(Object.keys(RYTHMES)).toEqual(['semaine', 'mois', 'trimestre']);
  });
  it('le premier passage de la tâche de nuit (02:53 UTC) après l’échéance', () => {
    expect(renouvellement('2026-11-02T14:00:00Z').toISOString()).toBe('2026-11-03T02:53:00.000Z');
    expect(renouvellement('2026-11-02T01:00:00Z').toISOString()).toBe('2026-11-02T02:53:00.000Z');
    expect(renouvellement(null)).toBe(null);
    expect(renouvellement('pas une date')).toBe(null);
  });
  it('dit le jour, ou « cette nuit » à moins d’un jour', () => {
    const lundi = new Date('2026-10-26T15:00:00Z');
    expect(changeLe('2026-11-02T14:00:00Z', lundi, 'Europe/Paris')).toBe('Nouveau code le mar. 3 nov.');
    expect(changeLe('2026-10-26T20:00:00Z', lundi, 'Europe/Paris')).toBe('Nouveau code cette nuit');
    expect(changeLe('2026-10-20T20:00:00Z', lundi, 'Europe/Paris')).toBe('Nouveau code cette nuit');   // échu : au prochain passage
    expect(changeLe(undefined, lundi)).toBe('');
  });
});

describe('motDePasseProvisoire — pour un professeur inscrit par le référent', () => {
  it('douze caractères lisibles en trois groupes, plus de dix comme le demande la base', () => {
    const m = motDePasseProvisoire();
    expect(m).toMatch(/^[a-km-np-z2-9]{4}-[a-km-np-z2-9]{4}-[a-km-np-z2-9]{4}$/);
    expect(m.length).toBeGreaterThanOrEqual(10);
  });
  it('ni 0, ni O, ni 1, ni l, ni i', () => {
    let k = 0;
    const tous = Array.from({ length: 31 }, () => motDePasseProvisoire(() => (k++ % 31) / 31)).join('');
    expect(tous).not.toMatch(/[0o1li]/);
  });
});

describe('uaiValide — le numéro d’un établissement', () => {
  it('sept chiffres et une lettre, casse et espaces ignorés', () => {
    expect(uaiValide('0300021K')).toBe(true);
    expect(uaiValide(' 0300021k ')).toBe(true);
    expect(uaiValide('300021K')).toBe(false);
    expect(uaiValide('03000210')).toBe(false);
    expect(uaiValide('')).toBe(false);
  });
});

describe('cycleDe — le cycle d’une classe d’après son niveau', () => {
  it('collège, lycée, professionnel, prépa, supérieur', () => {
    expect(['6e', '3e'].map(cycleDe)).toEqual(['college', 'college']);
    expect(['2nde', '1re', 'Tle'].map(cycleDe)).toEqual(['lycee_gt', 'lycee_gt', 'lycee_gt']);
    expect(cycleDe('Bac pro')).toBe('lycee_pro');
    expect(cycleDe('Prépa')).toBe('cpge');
    expect(cycleDe('BTS')).toBe('sup');
  });
  it('un niveau inconnu ne devine rien', () => {
    expect(cycleDe('Autre')).toBe('');
    expect(cycleDe('')).toBe('');
  });
  it('chaque niveau proposé a son cycle, sauf « Autre »', () => {
    expect(NIVEAUX.filter(n => !cycleDe(n))).toEqual(['Autre']);
  });
});

describe('le suivi commercial — ce qui presse, ce qu’on compte', () => {
  const auj = '2026-10-26';
  const orgs = [
    { name: 'Lycée Zola', statut: 'client', eleves: 800, prix_euros: 2400, licence_fin: '2027-07-01', places: 900 },
    { name: 'Collège Hugo', statut: 'prospect', source: 'demande', ville: 'Lyon', contact_nom: 'M. Péguy' },
    { name: 'Lycée Camus', statut: 'demo', eleves: 40, places: 60, licence_fin: '2026-11-05', relance: '2026-10-26' },
    { name: 'Lycée Aragon', statut: 'perdu', relance: '2026-01-01' },
    { name: 'Lycée Baudelaire', statut: 'client', eleves: 300, prix_euros: 900, licence_fin: '2026-11-01', places: 400 }
  ];
  it('les étapes, dans l’ordre du chemin', () => {
    expect(ORDRE_ETAPES).toEqual(Object.keys(ETAPES));
    expect(compterEtapes(orgs)).toEqual({ tous: 5, prospect: 1, demo: 1, client: 2, pause: 0, perdu: 1 });
  });
  it('une relance due, jamais pour un perdu ; une demande neuve tant qu’on n’a rien noté', () => {
    expect(aRelancer(orgs[2], auj)).toBe(true);
    expect(aRelancer({ ...orgs[2], relance: '2026-10-27' }, auj)).toBe(false);
    expect(aRelancer(orgs[3], auj)).toBe(false);
    expect(nouvelleDemande(orgs[1])).toBe(true);
    expect(nouvelleDemande({ ...orgs[1], notes: 'Appelé le 26' })).toBe(false);
  });
  it('la liste : la demande, la relance, la licence qui finit, puis par nom', () => {
    expect(trierSuivi(orgs, auj).map(o => o.name)).toEqual(['Collège Hugo', 'Lycée Camus', 'Lycée Baudelaire', 'Lycée Aragon', 'Lycée Zola']);
  });
  it('filtrer par étape et chercher sans accent', () => {
    expect(filtrerSuivi(orgs, 'client').length).toBe(2);
    expect(filtrerSuivi(orgs, 'tous', 'peguy').map(o => o.name)).toEqual(['Collège Hugo']);
    expect(filtrerSuivi(orgs, 'demo', 'lyon')).toEqual([]);
  });
  it('les chiffres du haut', () => {
    expect(bilanSuivi(orgs, auj)).toEqual({ demos: 1, clients: 2, eleves: 1140, revenu: 3300, relances: 1, demandes: 1 });
  });
  it('le prochain pas : transmettre le code, lancer la démo, passer en licence, suivre', () => {
    expect(prochainPas({ statut: 'demo', code_ref: 'ABCDEFGH' }, auj)).toBe('code');
    expect(prochainPas(orgs[1], auj)).toBe('demo');
    expect(prochainPas(orgs[2], auj)).toBe('licence');
    expect(prochainPas(orgs[4], auj)).toBe('licence');            // client dont la licence finit dans 6 jours
    expect(prochainPas(orgs[0], auj)).toBe('suivre');
  });
  it('le courriel du code référent : le code lisible, la date en clair, un lien mailto encodé', () => {
    const c = courrielReferent({ etab: 'Lycée Camus', contact: 'Mme Roux', code: 'ABCD2345', fin: '2026-11-25T10:00:00Z',
      site: 'https://www.folioflashcard.online/' });
    expect(c.sujet).toBe('Folio · l’accès de Lycée Camus');
    expect(c.corps).toContain('Bonjour Mme Roux,');
    expect(c.corps).toContain('ABCD-2345');
    expect(c.corps).toContain('jusqu’au 25/11/2026');
    const l = lienCourriel('dir@camus.fr', c);
    expect(l.startsWith('mailto:dir%40camus.fr?subject=Folio')).toBe(true);
    expect(decodeURIComponent(l.split('body=')[1])).toBe(c.corps);
  });
});

describe('messageDemande — le formulaire public', () => {
  it('merci, déjà reçue, et chaque refus dit quoi corriger', () => {
    expect(messageDemande('ok').ton).toBe('ok');
    expect(messageDemande('deja').ton).toBe('ok');
    for (const s of ['email', 'champs', 'trop']) expect(messageDemande(s).ton).toBe('ko');
    expect(messageDemande('???').titre).toBe('Envoi impossible');
  });
});
