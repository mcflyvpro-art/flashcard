// Folio+ dans l'app : lire ce que dit la base, le dire en clair (src/abonnement.js),
// et l'appareil, pour le bon téléchargement (src/plateformes.js).
import { describe, expect, it } from 'vitest';
import { FORMULES, VENTE_OUVERTE, dateLisible, erreurDe, euros, lireOffre, lireRetour, resume } from '../src/abonnement.js';
import { GESTES, MAGASINS, installer, mobile, partout, peutVendre, plateforme } from '../src/plateformes.js';

describe('ce que dit la base', () => {
  it('une réponse absente ou d’une base sans la fonction : Folio gratuit', () => {
    for (const r of [null, undefined, [], 'x', {}]) expect(lireOffre(r)).toEqual({ offre: 'gratuit', etablissement: '', licenceFin: null, abonnement: null });
  });
  it('un abonnement', () => {
    const o = lireOffre({ offre: 'plus', abonnement: { statut: 'actif', formule: 'annuel', source: 'stripe',
      fin_periode: '2027-11-02T10:00:00Z', fin_prevue: false } });
    expect(o.offre).toBe('plus');
    expect(o.abonnement).toEqual({ statut: 'actif', formule: 'annuel', source: 'stripe', fin: '2027-11-02T10:00:00Z', finPrevue: false });
  });
  it('une offre inconnue ne donne rien', () => expect(lireOffre({ offre: 'illimite' }).offre).toBe('gratuit'));
});

describe('ce que l’écran en dit', () => {
  const ab = (x = {}) => ({ statut: 'actif', formule: 'annuel', source: 'stripe', fin: '2027-11-02T10:00:00Z', finPrevue: false, ...x });
  it('Folio gratuit : on peut payer', () => {
    expect(resume(lireOffre(null))).toEqual({ titre: 'Folio', ligne: 'Gratuit', alerte: '', payer: true, gerer: false });
  });
  it('Folio+ annuel : la date de renouvellement, et le portail', () => {
    const r = resume({ offre: 'plus', abonnement: ab() });
    expect(r.titre).toBe('Folio+');
    expect(r.ligne).toBe('Annuel · renouvelé le 2 novembre 2027');
    expect(r.payer).toBe(false);
    expect(r.gerer).toBe(true);
  });
  it('résilié : la date de fin ; impayé : l’alerte', () => {
    expect(resume({ offre: 'plus', abonnement: ab({ finPrevue: true }) }).ligne).toBe('Se termine le 2 novembre 2027');
    const r = resume({ offre: 'plus', abonnement: ab({ statut: 'impaye' }) });
    expect(r.ligne).toBe('Paiement refusé : mets ta carte à jour');
    expect(r.alerte).toMatch(/carte/);
  });
  it('acheté dans un magasin : géré là-bas, pas de portail Stripe', () => {
    const r = resume({ offre: 'plus', abonnement: ab({ source: 'apple', formule: 'mensuel' }) });
    expect(r.ligne).toBe('Mensuel · renouvelé le 2 novembre 2027 · géré dans l’App Store');
    expect(r.gerer).toBe(false);
  });
  it('Campus : offert par l’établissement ; un abonnement qui court en double se signale', () => {
    expect(resume({ offre: 'campus', etablissement: 'Lycée Démo', licenceFin: '2027-07-31', abonnement: null }))
      .toEqual({ titre: 'Folio Campus', ligne: 'Offert par Lycée Démo jusqu’au 31 juillet 2027', alerte: '', payer: false, gerer: false });
    const r = resume({ offre: 'campus', etablissement: 'Lycée Démo', abonnement: ab() });
    expect(r.alerte).toMatch(/continue d’être prélevé/);
    expect(r.gerer).toBe(true);
    expect(resume({ offre: 'campus', etablissement: 'L', abonnement: ab({ finPrevue: true }) }).alerte).toBe('');
  });
  it('un abonnement fini : de nouveau Folio gratuit, les factures restent', () => {
    const r = resume({ offre: 'gratuit', abonnement: ab({ statut: 'fini' }) });
    expect(r.ligne).toBe('Ton abonnement Folio+ a pris fin');
    expect(r.payer).toBe(true);
    expect(r.gerer).toBe(true);
  });
});

describe('les prix, les dates, les retours', () => {
  it('les prix de la page d’accueil', () => {
    expect(euros(FORMULES.annuel.prix)).toBe('29,99 €');
    expect(euros(FORMULES.annuel.mois)).toBe('2,50 €');
    expect(euros(FORMULES.mensuel.prix)).toBe('4,99 €');
    expect(FORMULES.annuel.sans).toBe(FORMULES.mensuel.prix * 12);
  });
  it('la vente n’ouvre qu’avec Stripe branché (docs/VENTE.md)', () => expect(VENTE_OUVERTE).toBe(false));
  it('une date lisible, rien pour une date fausse', () => {
    expect(dateLisible('2027-02-01T12:00:00Z')).toBe('1 février 2027');
    expect(dateLisible('nimporte')).toBe('');
  });
  it('les erreurs dites en clair', () => {
    expect(erreurDe('nokey')).toBe('Le paiement ouvre bientôt');
    expect(erreurDe('deja')).toMatch(/déjà actif/);
    expect(erreurDe('inconnue')).toMatch(/réessaie/);
  });
  it('« ?plus= »', () => {
    expect(lireRetour('merci')).toEqual({ etape: 'merci', formule: null });
    expect(lireRetour('Mensuel')).toEqual({ etape: null, formule: 'mensuel' });
    expect(lireRetour('1')).toEqual({ etape: null, formule: null });
    expect(lireRetour('')).toBeNull();
  });
});

describe('l’appareil', () => {
  const UA = {
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0',
    chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 15000.0.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    linux: 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/131.0'
  };
  it('reconnaît chaque famille, l’iPad qui se dit Mac compris', () => {
    expect(plateforme({ ua: UA.iphone })).toEqual({ os: 'ios', natif: false });
    expect(plateforme({ ua: UA.ipad, touches: 5 }).os).toBe('ios');
    expect(plateforme({ ua: UA.ipad, touches: 0 }).os).toBe('mac');
    expect(plateforme({ ua: UA.android }).os).toBe('android');
    expect(plateforme({ ua: UA.windows }).os).toBe('windows');
    expect(plateforme({ ua: UA.chromebook }).os).toBe('chromeos');
    expect(plateforme({ ua: UA.linux }).os).toBe('linux');
    expect(plateforme().os).toBe('autre');
  });
  it('dans l’app des magasins : natif, et rien ne s’y vend', () => {
    const p = plateforme({ ua: UA.iphone, capacitor: 'ios' });
    expect(p).toEqual({ os: 'ios', natif: true });
    expect(peutVendre(p)).toBe(false);
    expect(peutVendre(plateforme({ ua: UA.iphone }))).toBe(true);
    expect(plateforme({ ua: UA.windows, capacitor: 'web' }).natif).toBe(false);
    expect(mobile(p)).toBe(true);
  });
  it('installer : le magasin quand l’app y est, sinon le navigateur', () => {
    const p = plateforme({ ua: UA.android });
    expect(installer(p)).toEqual({ type: 'navigateur', os: 'android' });
    expect(installer(p, { ...MAGASINS, android: 'https://play.google.com/store/apps/details?id=online.folioflashcard.app' }))
      .toEqual({ type: 'magasin', os: 'android', lien: 'https://play.google.com/store/apps/details?id=online.folioflashcard.app', nom: 'Google Play' });
    expect(installer({ os: 'ios', natif: true })).toEqual({ type: 'deja' });
  });
  it('partout : l’appareil qu’on tient d’abord, chacun avec son geste', () => {
    const l = partout(plateforme({ ua: UA.windows }));
    expect(l.map(x => x.os)).toEqual(['windows', 'ios', 'android', 'mac']);
    expect(l[0].ici).toBe(true);
    expect(l.every(x => x.geste && !x.lien)).toBe(true);
    expect(partout(plateforme({ ua: UA.linux })).map(x => x.os)).toEqual(['ios', 'android', 'mac', 'windows']);
  });
  it('les magasins restent vides tant que l’app n’y est pas publiée', () => {
    expect(Object.values(MAGASINS).every(v => v === '')).toBe(true);
    expect(Object.keys(GESTES)).toEqual(expect.arrayContaining(['ios', 'android', 'mac', 'windows']));
  });
});
