// La licence d'un établissement, rejouée en mémoire (migration
// 20261026130000) : licence_tableau, facture, facturation_enregistrer, les
// factures et les avoirs de l'éditeur (totaux calculés ici comme en base,
// numérotation continue par série et par année, photographie du vendeur et
// du client), les échanges, ref_retirer et l'ouverture d'un compte de
// professeur par le référent. Même contrat que le reste de la base locale :
// ce que l'app appelle et lit, pas la sécurité — elle se prouve en base
// (supabase/tests/licence.sql).
import { uuid as randomUUID } from './uuid.js';
import { erreur, membresOrg, placesLibres, placesPrises, referent, tracer } from './etablissement.js';

const auj = () => new Date().toISOString().slice(0, 10);
const dans = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const SUJETS = ['places', 'renouvellement', 'facture', 'question'];
const editeur = (m, uid) => m.roles[uid] === 'admin';

function etat(et) {
  et.factures = et.factures || [];
  et.compteurs = et.compteurs || {};
  et.echanges = et.echanges || [];
  et.vendeur = et.vendeur || null;
  return et;
}

/* L'établissement dont on parle : le sien pour un référent, celui qu'il désigne pour l'éditeur. */
function licenceOrg(et, m, uid, org) {
  if (org && editeur(m, uid)) return et.orgs.find(o => o.id === org) || erreur('Établissement inconnu');
  const o = referent(et, m, uid);
  if (org && org !== o.id) erreur('Réservé au référent de l’établissement');
  return o;
}

function numero(et, serie) {
  const a = new Date().getFullYear(), k = `${serie}${a}`;
  et.compteurs[k] = (et.compteurs[k] || 0) + 1;
  return `${serie}-${a}-${String(et.compteurs[k]).padStart(4, '0')}`;
}

const sansLignes = f => {
  const reste = { ...f };
  delete reste.vendeur; delete reste.client; delete reste.lignes;
  return reste;
};

function tableau(store, et, m, o) {
  const f = o.facturation || null, v = et.vendeur;
  return {
    org: o.nom, offre: o.offre, places: o.places, licence_fin: o.fin,
    eleves: membresOrg(et, o).filter(u => (m.roles[u] || 'eleve') === 'eleve').length,
    profs: membresOrg(et, o).filter(u => m.roles[u] === 'prof').length,
    prises: placesPrises(et, m, o),
    prix: o.suivi ? o.suivi.prix_euros : null,
    facturation: f,
    factures: et.factures.filter(x => x.org_id === o.id)
      .sort((a, b) => b.emise_le.localeCompare(a.emise_le) || b.numero.localeCompare(a.numero)).map(sansLignes),
    echanges: et.echanges.filter(e => e.org_id === o.id).map(e => ({ id: e.id, de: e.de, sujet: e.sujet, message: e.message,
      cree: e.cree, lu: e.lu, auteur: e.de === 'folio' ? 'Folio' : m.noms[e.auteur] || '' })),
    vendeur: v ? { raison_sociale: v.raison_sociale, forme: v.forme, adresse: v.adresse, code_postal: v.code_postal, ville: v.ville,
      siret: v.siret, email: v.email, regime_tva: v.regime_tva } : null
  };
}

const propre = (fiche, champs) => Object.fromEntries(champs.map(k => [k, String((fiche || {})[k] || '').trim()]));
const CLIENT = ['nom', 'adresse', 'code_postal', 'ville', 'siret', 'service', 'engagement', 'email'];
const VENDEUR = ['raison_sociale', 'forme', 'adresse', 'code_postal', 'ville', 'siret', 'immatriculation', 'tva_intracom', 'iban', 'bic', 'email'];

function facturer(et, m, uid, b) {
  if (!editeur(m, uid)) erreur('Réservé à l’éditeur');
  const o = et.orgs.find(x => x.id === b.org) || erreur('Établissement inconnu'), v = et.vendeur, c = o.facturation;
  if (!v || !v.raison_sociale || !v.adresse || !v.siret) erreur('Remplis d’abord ton entreprise : raison sociale, adresse, SIRET');
  if (!c || !c.nom || !c.adresse || !c.ville) erreur('Il manque les coordonnées de facturation de l’établissement');
  const lignes = (b.lignes || []).map(l => {
    const q = +l.quantite, pu = +l.prix_ht, libelle = String(l.libelle || '').trim();
    if (!libelle || !(q > 0) || !(pu >= 0)) erreur('Ligne illisible : un libellé, une quantité, un prix');
    return { libelle, quantite: q, prix_ht: pu, total_ht: Math.round(q * pu) };
  });
  if (!lignes.length || lignes.length > 20) erreur('Une à vingt lignes');
  const ht = lignes.reduce((a, l) => a + l.total_ht, 0);
  if (ht <= 0) erreur('Une facture de zéro euro ne s’émet pas');
  const normal = v.regime_tva === 'normal', taux = normal ? +v.taux_tva : 0, tva = normal ? Math.round((ht * taux) / 100) : 0;
  const f = { id: randomUUID(), org_id: o.id, numero: numero(et, 'F'), genre: 'facture', origine: null, emise_le: auj(),
    echeance: dans(+v.delai_jours || 30), periode_debut: b.debut || null, periode_fin: b.fin || null, objet: b.objet || '', lignes,
    total_ht: ht, tva, total_ttc: ht + tva, taux_tva: taux, mention_tva: normal ? '' : 'TVA non applicable, art. 293 B du CGI',
    vendeur: { ...v }, client: { ...c, uai: o.uai || '' }, engagement: c.engagement || '', deposee_le: null, payee_le: null };
  et.factures.push(f);
  return { id: f.id, numero: f.numero };
}

function avoir(et, m, uid, b) {
  if (!editeur(m, uid)) erreur('Réservé à l’éditeur');
  const k = et.factures.find(x => x.id === b.fid && x.genre === 'facture') || erreur('Facture inconnue');
  if (et.factures.some(x => x.origine === k.id)) erreur('Cette facture a déjà son avoir');
  const a = { ...k, id: randomUUID(), numero: numero(et, 'A'), genre: 'avoir', origine: k.id, emise_le: auj(), echeance: auj(),
    objet: `Avoir sur la facture ${k.numero}${b.motif ? ' — ' + b.motif : ''}`, total_ht: -k.total_ht, tva: -k.tva, total_ttc: -k.total_ttc,
    lignes: k.lignes.map(l => ({ ...l, quantite: -l.quantite, total_ht: -l.total_ht })), vendeur: { ...(et.vendeur || k.vendeur) },
    deposee_le: null, payee_le: null };
  et.factures.push(a);
  return { id: a.id, numero: a.numero };
}

/* Le référent ouvre le compte d'un professeur : il prend une place. */
function nouveauCompte(store, et, m, uid, b) {
  const o = referent(et, m, uid);
  if (!['eleve', 'prof'].includes(b.qrole)) erreur('Un référent ouvre des comptes d’élève et de professeur.');
  if (placesLibres(et, m, o) === 0) erreur('Toutes les places de la licence sont prises : demande-en d’autres à Folio, ou retire un compte parti');
  if (String(b.pw || '').length < 10) erreur('Au moins dix caractères');
  const ad = String(b.adresse || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ad)) erreur('Adresse e-mail invalide');
  if (store.users.some(u => u.email === ad)) erreur('Cette adresse a déjà un compte');
  const id = randomUUID();
  store.users.push({ id, email: ad, password: b.pw });
  m.noms[id] = String(b.nom || '').trim(); m.roles[id] = b.qrole; et.membres[id] = o.id;
  tracer(store, id, 'compte ouvert', { nom: m.noms[id], role: b.qrole });
  return id;
}

/* Sortir quelqu'un de l'établissement : sa place se libère, son compte reste. */
function retirer(store, et, m, uid, b) {
  const o = referent(et, m, uid);
  if (et.membres[b.cible] !== o.id) erreur('Ce compte n’est pas dans ton établissement');
  if (b.cible === uid) erreur('On ne se retire pas soi-même');
  if (['ref', 'admin'].includes(m.roles[b.cible])) erreur('Un référent ne modifie ni un éditeur ni un autre référent');
  const ici = new Set(m.classes.filter(c => c.org === o.id).map(c => c.id));
  m.membres = m.membres.filter(x => !(x.uid === b.cible && ici.has(x.cid)));
  et.services = (et.services || []).filter(x => !(x.prof === b.cible && ici.has(x.cid)));
  m.classes.filter(c => c.org === o.id && c.owner === b.cible && c.genre === 'groupe').forEach(c => { c.archivee = true; });
  delete et.membres[b.cible];
  tracer(store, b.cible, 'retiré de l’établissement', { nom: m.noms[b.cible], role: m.roles[b.cible] || 'eleve' });
  return null;
}

export function fonctionsFacturation(store, et0, m, uid) {
  const et = etat(et0);
  return {
    licence_tableau: b => tableau(store, et, m, licenceOrg(et, m, uid, b && b.org)),
    facture: b => {
      const f = et.factures.find(x => x.id === b.fid) || erreur('Facture inconnue');
      licenceOrg(et, m, uid, f.org_id);
      return { ...f, origine_numero: (et.factures.find(x => x.id === f.origine) || {}).numero || null,
        avoir_numero: (et.factures.find(x => x.origine === f.id) || {}).numero || null };
    },
    facturation_enregistrer: b => {
      const o = licenceOrg(et, m, uid, b.org), f = propre(b.fiche, CLIENT);
      f.siret = f.siret.replace(/\s/g, ''); f.email = f.email.toLowerCase();
      if (f.siret && !/^\d{14}$/.test(f.siret)) erreur('Un SIRET compte quatorze chiffres');
      o.facturation = f;
      tracer(store, null, 'coordonnées de facturation', {});
      return null;
    },
    ref_ecrire: b => {
      const o = referent(et, m, uid), msg = String(b.message || '').trim();
      if (!SUJETS.includes(b.sujet)) erreur('Sujet inconnu');
      if (!msg) erreur('Le message est vide');
      const e = { id: et.echanges.length + 1, org_id: o.id, de: 'etab', auteur: uid, sujet: b.sujet, message: msg.slice(0, 2000),
        cree: new Date().toISOString(), lu: null };
      et.echanges.push(e);
      return e.id;
    },
    echanges_lus: b => {
      const o = licenceOrg(et, m, uid, b && b.org), de = b && b.org && editeur(m, uid) ? 'etab' : 'folio';
      et.echanges.filter(e => e.org_id === o.id && e.de === de && !e.lu).forEach(e => { e.lu = new Date().toISOString(); });
      return null;
    },
    ref_retirer: b => retirer(store, et, m, uid, b),
    ref_new_account: b => nouveauCompte(store, et, m, uid, b),
    admin_vendeur: () => { if (!editeur(m, uid)) erreur('Réservé à l’éditeur'); return et.vendeur || {}; },
    admin_vendeur_enregistrer: b => {
      if (!editeur(m, uid)) erreur('Réservé à l’éditeur');
      const v = propre(b.fiche, VENDEUR);
      // comme la base : sans espaces, en capitales
      for (const k of ['siret', 'iban', 'tva_intracom']) v[k] = v[k].replace(/\s/g, '').toUpperCase();
      v.bic = v.bic.toUpperCase(); v.email = v.email.toLowerCase();
      if (v.siret && !/^\d{14}$/.test(v.siret)) erreur('Un SIRET compte quatorze chiffres');
      et.vendeur = { ...v, regime_tva: b.fiche.regime_tva === 'normal' ? 'normal' : 'franchise', taux_tva: +b.fiche.taux_tva || 20,
        delai_jours: +b.fiche.delai_jours || 30 };
      return null;
    },
    admin_facturer: b => facturer(et, m, uid, b),
    admin_avoir: b => avoir(et, m, uid, b),
    admin_facture_dates: b => {
      if (!editeur(m, uid)) erreur('Réservé à l’éditeur');
      const f = et.factures.find(x => x.id === b.fid) || erreur('Facture inconnue');
      f.deposee_le = b.deposee || null; f.payee_le = b.payee || null;
      return null;
    },
    admin_repondre: b => {
      if (!editeur(m, uid)) erreur('Réservé à l’éditeur');
      if (!SUJETS.includes(b.sujet || 'question')) erreur('Sujet inconnu');
      et.echanges.filter(e => e.org_id === b.org && e.de === 'etab').forEach(e => { e.lu = e.lu || new Date().toISOString(); });
      const e = { id: et.echanges.length + 1, org_id: b.org, de: 'folio', auteur: uid, sujet: b.sujet || 'question',
        message: String(b.message || '').trim(), cree: new Date().toISOString(), lu: null };
      et.echanges.push(e);
      return e.id;
    },
    admin_echanges_attente: () => {
      if (!editeur(m, uid)) erreur('Réservé à l’éditeur');
      const n = {};
      et.echanges.filter(e => e.de === 'etab' && !e.lu).forEach(e => { n[e.org_id] = (n[e.org_id] || 0) + 1; });
      return Object.entries(n).map(([org_id, k]) => ({ org_id, n: k }));
    }
  };
}
