// Folio+ dans l'app : lire ce que dit la base, le dire en clair (src/abonnement.js),
// et l'appareil : la porte d'installation, le bon geste (src/plateformes.js).
import { describe, expect, it } from 'vitest';
import { FORMULES, GERER, RAISONS, VENTE_OUVERTE, dateLisible, erreurDe, euros, gestion, lireOffre, lireRetour, resume }
  from '../src/abonnement.js';
import { PLUS_SEUL } from '../src/offres.js';
import { MAGASINS, installer, mobile, plateforme, porte, vente } from '../src/plateformes.js';

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
  it('acheté dans un magasin : géré là-bas, jamais par le portail Stripe', () => {
    const a = ab({ source: 'apple', formule: 'mensuel' });
    const r = resume({ offre: 'plus', abonnement: a });
    expect(r.ligne).toBe('Mensuel · renouvelé le 2 novembre 2027 · géré dans l’App Store');
    expect(r.gerer).toBe(true);
    expect(gestion(a, { os: 'ios', natif: true })).toEqual({ type: 'lien', lien: GERER.apple });
    expect(gestion(a, { os: 'windows', natif: false }).type).toBe('texte');
    expect(gestion(ab({ source: 'google' }), { os: 'android', natif: true })).toEqual({ type: 'lien', lien: GERER.google });
  });
  it('un abonnement Stripe : son portail, mais jamais depuis l’app des magasins', () => {
    expect(gestion(ab(), { os: 'mac', natif: false })).toEqual({ type: 'stripe' });
    expect(gestion(ab(), { os: 'ios', natif: true }).type).toBe('texte');
  });
  it('Folio+ offert (les comptes d’avant le 2026-10-27, l’éditeur) : rien à gérer', () => {
    const a = ab({ source: 'offert', formule: null, fin: null });
    expect(resume({ offre: 'plus', abonnement: a })).toEqual({ titre: 'Folio+', ligne: 'Offert', alerte: '', payer: false, gerer: false });
    expect(gestion(a, { os: 'mac', natif: false })).toBeNull();
  });
  it('chaque geste bridé a sa raison, dite en tête de l’écran Folio+', () => {
    for (const f of PLUS_SEUL.filter(x => x !== 'journal')) expect(RAISONS[f]).toBeTruthy();
    expect(RAISONS.journal).toBeTruthy();
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
  it('la vente est ouverte (2026-10-27) : un compte gratuit a l’onglet Folio+', () => expect(VENTE_OUVERTE).toBe(true));
  it('une date lisible, rien pour une date fausse', () => {
    expect(dateLisible('2027-02-01T12:00:00Z')).toBe('1 février 2027');
    expect(dateLisible('nimporte')).toBe('');
    expect(dateLisible(null)).toBe('');
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
  it('dans l’app des magasins : l’achat intégré ; ailleurs, Stripe', () => {
    const p = plateforme({ ua: UA.iphone, capacitor: 'ios' });
    expect(p).toEqual({ os: 'ios', natif: true });
    expect(vente(p)).toBe('magasin');
    expect(vente(plateforme({ ua: UA.windows }))).toBe('stripe');
    expect(plateforme({ ua: UA.windows, capacitor: 'web' }).natif).toBe(false);
    expect(mobile(p)).toBe(true);
  });
  it('installer : le magasin quand l’app y est ; un téléphone, l’écran d’accueil ; un ordinateur, son navigateur', () => {
    const p = plateforme({ ua: UA.android });
    expect(installer(p)).toEqual({ type: 'ecran', os: 'android' });
    expect(installer(plateforme({ ua: UA.iphone }))).toEqual({ type: 'ecran', os: 'ios' });
    expect(installer(plateforme({ ua: UA.windows }))).toEqual({ type: 'navigateur', os: 'windows' });
    expect(installer(p, { ...MAGASINS, android: 'https://play.google.com/store/apps/details?id=online.folioflashcard.app' }))
      .toEqual({ type: 'magasin', os: 'android', lien: 'https://play.google.com/store/apps/details?id=online.folioflashcard.app', nom: 'Google Play' });
    expect(installer({ os: 'ios', natif: true })).toEqual({ type: 'deja' });
  });
  it('la porte : un téléphone ou une tablette n’entre dans l’app qu’installée (2026-10-28)', () => {
    const tel = plateforme({ ua: UA.iphone }), ipad = plateforme({ ua: UA.ipad, touches: 5 });
    expect(porte(tel, { chemin: '/connexion' })).toBe(true);
    expect(porte(ipad, { chemin: '/inscription' })).toBe(true);
    expect(porte(plateforme({ ua: UA.android }), { chemin: '/eleve/livres' })).toBe(true);
    expect(porte(tel, { installee: true, chemin: '/connexion' })).toBe(false);            // depuis son icône
    expect(porte({ os: 'android', natif: true }, { chemin: '/connexion' })).toBe(false);  // l'app des magasins
    expect(porte(plateforme({ ua: UA.windows }), { chemin: '/connexion' })).toBe(false);
    expect(porte(plateforme({ ua: UA.ipad, touches: 0 }), { chemin: '/connexion' })).toBe(false);  // un vrai Mac
    expect(porte(plateforme({ ua: UA.chromebook }), { chemin: '/connexion' })).toBe(false);
  });
  it('la porte laisse lire et essayer : la démo, les textes du cadre, la demande de démo', () => {
    const tel = plateforme({ ua: UA.iphone });
    for (const chemin of ['/essayer', '/demo/eleve', '/demo/prof/classes/x', '/mentions/cgu', '/demande-demo']) {
      expect(porte(tel, { chemin })).toBe(false);
    }
    for (const chemin of ['/', '/app', '/demonstration', '/essayer-plus', '/mentions', '/carte-eleve', '/eleve/folio-plus']) {
      expect(porte(tel, { chemin })).toBe(true);
    }
  });
  it('les magasins restent vides tant que l’app n’y est pas publiée', () => {
    expect(Object.values(MAGASINS).every(v => v === '')).toBe(true);
  });
});
