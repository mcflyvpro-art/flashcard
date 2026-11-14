// Les devis (migration 20261114090000), rejoués en mémoire pour les
// parcours : admin_devis, devis, ref_devis_repondre, admin_devis_statut,
// admin_devis_facturer, et licence_tableau qui rend aussi `devis`. On émule
// ce que l'app appelle et lit ; la sécurité se prouve en base
// (supabase/tests/devis.sql). Branché par e2e/faux-supabase.js devant
// serveur.js, comme comptes.js : la démo sans compte ne le charge pas (son
// poids est compté) — sa licence n'a simplement pas de devis.
import { modele } from './classes.js';
import { repondre, userOf } from './serveur.js';
import { etab, orgDe } from './etablissement.js';
import { uuid } from './uuid.js';

const NOMS = ['admin_devis', 'devis', 'ref_devis_repondre', 'admin_devis_statut', 'admin_devis_facturer', 'licence_tableau'];
const refus = message => [400, { code: 'P0001', message }];
const auj = () => new Date().toISOString().slice(0, 10);
const dans = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

function numero(et) {
  const a = new Date().getFullYear(), k = `D${a}`;
  et.compteurs = et.compteurs || {};
  et.compteurs[k] = (et.compteurs[k] || 0) + 1;
  return `D-${a}-${String(et.compteurs[k]).padStart(4, '0')}`;
}

const sansLignes = (et, d) => {
  const r = { ...d, facture_numero: ((et.factures || []).find(f => f.id === d.facture_id) || {}).numero || null };
  delete r.vendeur; delete r.client; delete r.lignes;
  return r;
};

function emettre(et, b) {
  const o = et.orgs.find(x => x.id === b.org), v = et.vendeur;
  if (!o) return refus('Établissement inconnu');
  if (!v || !v.raison_sociale || !v.adresse || !v.siret) return refus('Remplis d’abord ton entreprise : raison sociale, adresse, SIRET');
  const lignes = (b.lignes || []).map(l => ({ libelle: String(l.libelle || '').trim(), quantite: +l.quantite, prix_ht: +l.prix_ht,
    total_ht: Math.round(+l.quantite * +l.prix_ht) }));
  if (!lignes.length || lignes.length > 20) return refus('Une à vingt lignes');
  if (lignes.some(l => !l.libelle || !(l.quantite > 0) || !(l.prix_ht >= 0))) return refus('Ligne illisible : un libellé, une quantité, un prix');
  const ht = lignes.reduce((a, l) => a + l.total_ht, 0);
  if (ht <= 0) return refus('Un devis de zéro euro ne s’émet pas');
  const normal = v.regime_tva === 'normal', taux = normal ? +v.taux_tva : 0, tva = normal ? Math.round((ht * taux) / 100) : 0;
  const c = { ...(o.facturation || {}) };
  if (!c.nom) c.nom = o.nom;
  if (!c.ville) c.ville = o.ville || '';
  const d = { id: uuid(), org_id: o.id, numero: numero(et), emis_le: auj(), valable_jusqua: dans(+b.valable || 30),
    periode_debut: b.debut || null, periode_fin: b.fin || null, places: b.places || null, objet: b.objet || '', lignes,
    total_ht: ht, tva, total_ttc: ht + tva, taux_tva: taux, mention_tva: normal ? '' : 'TVA non applicable, art. 293 B du CGI',
    vendeur: { ...v }, client: { ...c, uai: o.uai || '' }, statut: 'envoye', repondu_le: null, repondu_par: '', engagement: '', facture_id: null };
  (et.devis = et.devis || []).push(d);
  return [200, { id: d.id, numero: d.numero }];
}

function repondreRef(store, et, m, uid, b) {
  const d = (et.devis || []).find(x => x.id === b.did), o = orgDe(et, uid);
  if (!d || !o || o.id !== d.org_id || m.roles[uid] !== 'ref') return refus('Devis inconnu');
  if (d.statut !== 'envoye') return refus('Ce devis a déjà sa réponse');
  if (d.valable_jusqua < auj()) return refus('Ce devis n’est plus valable : demande-en un nouveau');
  const qui = String(b.nom || '').trim();
  if (b.accepte && qui.length < 3) return refus('Indique ton nom et ta fonction');
  Object.assign(d, { statut: b.accepte ? 'accepte' : 'refuse', repondu_le: new Date().toISOString(), repondu_par: qui,
    engagement: b.accepte ? String(b.engagement || '').trim() : '' });
  (et.echanges = et.echanges || []).push({ id: et.echanges.length + 1, org_id: o.id, de: 'etab', auteur: uid, sujet: 'question',
    message: b.accepte ? `Devis ${d.numero} accepté par ${qui}${d.engagement ? ` (bon de commande ${d.engagement})` : ''}.` : `Devis ${d.numero} refusé.`,
    cree: new Date().toISOString(), lu: null });
  return [200, { statut: d.statut }];
}

/* La facture et la licence passent par les fonctions déjà rejouées
   (admin_facturer, admin_licence), comme en base. */
function facturer(store, et, demande, b) {
  const d = (et.devis || []).find(x => x.id === b.did);
  if (!d) return refus('Devis inconnu');
  if (d.facture_id) return refus('Ce devis est déjà facturé');
  if (d.statut !== 'accepte') return refus('Le devis doit d’abord être accepté');
  const o = et.orgs.find(x => x.id === d.org_id);
  if (d.engagement && o.facturation) o.facturation.engagement = d.engagement;
  const appeler = (nom, body) => repondre(store, { ...demande, url: new URL(demande.url.origin + '/rest/v1/rpc/' + nom), body });
  const [st, r] = appeler('admin_facturer', { org: d.org_id, lignes: d.lignes.map(({ libelle, quantite, prix_ht }) => ({ libelle, quantite, prix_ht })),
    debut: d.periode_debut, fin: d.periode_fin, objet: `${d.objet} (devis ${d.numero})`.trim() });
  if (st !== 200) return [st, r];
  d.facture_id = r.id;
  const licence = b.licence !== false && !!d.places && !!d.periode_fin;
  if (licence) {
    appeler('admin_licence', { org: d.org_id, places: d.places, fin: d.periode_fin, offre: 'etablissement' });
    o.suivi = { ...(o.suivi || {}), prix_euros: Math.round(d.total_ht / 100) };
  }
  return [200, { ...r, licence }];
}

export function repondreDevis(store, demande) {
  const { url, headers, body } = demande, nom = url.pathname.replace('/rest/v1/rpc/', '');
  if (!url.pathname.startsWith('/rest/v1/rpc/') || !NOMS.includes(nom)) return null;
  const user = userOf(store, { headers });
  if (!user) return [401, { message: 'JWT expired' }];
  const m = modele(store), et = etab(store), b = body || {}, editeur = m.roles[user.id] === 'admin';
  if (nom === 'licence_tableau') {
    const [st, r] = repondre(store, demande);
    if (st !== 200 || !r) return [st, r];
    const o = et.orgs.find(x => x.nom === r.org && (!b.org || x.id === b.org)) || {};
    return [200, { ...r, devis: (et.devis || []).filter(d => d.org_id === o.id).map(d => sansLignes(et, d)).reverse() }];
  }
  if (nom === 'devis') {
    const d = (et.devis || []).find(x => x.id === b.did), o = orgDe(et, user.id);
    if (!d || !(editeur || (o && o.id === d.org_id && m.roles[user.id] === 'ref'))) return refus('Devis inconnu');
    return [200, { ...d, genre: 'devis', facture_numero: ((et.factures || []).find(f => f.id === d.facture_id) || {}).numero || null }];
  }
  if (nom === 'ref_devis_repondre') return repondreRef(store, et, m, user.id, b);
  if (!editeur) return refus('Réservé à l’éditeur');
  if (nom === 'admin_devis') return emettre(et, b);
  if (nom === 'admin_devis_facturer') return facturer(store, et, demande, b);
  const d = (et.devis || []).find(x => x.id === b.did);
  if (!d) return refus('Devis inconnu');
  if (!['envoye', 'accepte', 'refuse'].includes(b.statut)) return refus('Statut inconnu');
  if (d.facture_id) return refus('Ce devis est facturé : sa réponse ne change plus');
  Object.assign(d, { statut: b.statut, repondu_le: b.statut === 'envoye' ? null : new Date().toISOString(),
    repondu_par: b.statut === 'envoye' ? '' : String(b.nom || '').trim(), engagement: b.statut === 'accepte' ? String(b.engagement || '').trim() : '' });
  return [200, null];
}
