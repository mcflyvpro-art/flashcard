/* Le professeur particulier en licence et les comptes ouverts par l'éditeur
   (migrations 20261029090000 à 20261029093000), rejoués en mémoire pour les
   parcours et la démo. Même contrat que les autres modules de la base
   locale : ce que l'app appelle et ce qu'elle lit, pas la sécurité — elle se
   prouve en base (supabase/tests/prof_particulier.sql).

   Le modèle tient dans `store.lp` : la licence de chaque professeur
   particulier (`profs`), ses demandes de places (`demandes`), les comptes
   dont le mot de passe est encore provisoire (`provisoires`). */
import { uuid as randomUUID } from './uuid.js';
import { modele } from './classes.js';
import { erreur, etab } from './etablissement.js';

const auj = () => new Date().toISOString().slice(0, 10);
const debutMois = () => auj().slice(0, 8) + '01';

export function licences(store) {
  store.lp = store.lp || { profs: {}, demandes: [], provisoires: {} };
  return store.lp;
}

/* ---------- le mot de passe provisoire ---------- */
export const estProvisoire = (store, uid) => !!licences(store).provisoires[uid];
export const marquerProvisoire = (store, uid) => { licences(store).provisoires[uid] = new Date().toISOString(); };
// le déclencheur mdp_choisi : un mot de passe changé n'est plus provisoire
export const mdpChoisi = (store, uid) => { delete licences(store).provisoires[uid]; };

/* compte_ouvrir : un compte ouvert par quelqu'un d'autre, mot de passe provisoire. */
export function ouvrirCompte(store, b) {
  if (String(b.pw || '').length < 10) erreur('Mot de passe : dix caractères au moins');
  const ad = String(b.adresse || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ad)) erreur('Adresse e-mail invalide');
  if (store.users.some(u => u.email === ad)) erreur('Cette adresse a déjà un compte');
  const id = randomUUID();
  store.users.push({ id, email: ad, password: b.pw });
  modele(store).noms[id] = String(b.nom || '').trim();
  marquerProvisoire(store, id);
  return id;
}

/* ---------- la licence d'un professeur particulier ---------- */
export function licenceProf(store, p) {
  const l = licences(store).profs[p];
  return l && (!l.fin || l.fin >= auj()) ? l : null;
}

const classesDe = (m, p) => m.classes.filter(c => c.owner === p && !c.org && !c.archivee);
export function inscritsProf(m, p) {
  const ids = new Set(classesDe(m, p).map(c => c.id));
  return new Set(m.membres.filter(x => ids.has(x.cid)).map(x => x.uid)).size;
}
// une demande en attente tient sa place
export function prisesProf(m, p) {
  const ids = new Set(classesDe(m, p).map(c => c.id));
  return new Set([...m.membres, ...m.demandes].filter(x => ids.has(x.cid)).map(x => x.uid)).size;
}
const attenteProf = (m, p) => {
  const ids = new Set(classesDe(m, p).map(c => c.id));
  return new Set(m.demandes.filter(x => ids.has(x.cid)).map(x => x.uid)).size;
};

/* campus_prof : le professeur dont la licence ouvre Campus à ce compte (lui-même, ou celui de sa classe). */
export function campusProf(store, uid) {
  if (licenceProf(store, uid)) return uid;
  const m = modele(store);
  const c = m.classes.find(k => !k.org && !k.archivee && licenceProf(store, k.owner)
    && [...m.membres, ...m.demandes].some(x => x.cid === k.id && x.uid === uid));
  return c ? c.owner : null;
}

const iaDuMois = (store, uid) => (store.tables.ai_usage || []).filter(a => a.user_id === uid && a.day >= debutMois()).length;
const estProfParticulier = (store, m, uid) => m.roles[uid] === 'prof' && !etab(store).membres[uid];
const estEditeur = (m, uid) => { if (m.roles[uid] !== 'admin') erreur('Réservé à l’éditeur'); };

function ligneProf(store, m, p) {
  const lp = licences(store), l = lp.profs[p];
  const d = lp.demandes.filter(x => x.prof === p && !x.traitee_le).sort((a, b) => b.cree_le.localeCompare(a.cree_le))[0];
  const prises = prisesProf(m, p), inscrits = inscritsProf(m, p);
  return { id: p, licence: !!l, places: l ? l.places : 0, prises, inscrits, attente: prises - inscrits, fin: l ? l.fin : null,
    ia_prof: l ? l.ia_prof : 0, ia_eleve: l ? l.ia_eleve : 0, ia_mois: iaDuMois(store, p), cents_mois: 0,
    demande_places: d ? d.places : null, demande_mot: d ? d.message : null, demande_le: d ? d.cree_le : null };
}

function fixerLicence(store, m, uid, b) {
  estEditeur(m, uid);
  if (m.roles[b.prof] !== 'prof') erreur('Ce compte n’est pas professeur : donne-lui d’abord ce rôle');
  if (etab(store).membres[b.prof]) erreur('Ce professeur est dans un établissement : sa place est dans la licence de l’établissement');
  const n = (v, max) => (Number.isInteger(+v) && +v >= 0 && +v <= max ? +v : null);
  if (n(b.places, 5000) === null) erreur('Entre 0 et 5000 places');
  if (n(b.ia_prof, 5000) === null) erreur('IA du professeur : entre 0 et 5000 par mois');
  if (n(b.ia_eleve, 1000) === null) erreur('IA par élève : entre 0 et 1000 par mois');
  const lp = licences(store);
  lp.profs[b.prof] = { places: +b.places, ia_prof: +b.ia_prof, ia_eleve: +b.ia_eleve, fin: b.fin || null,
    maj_le: new Date().toISOString() };
  lp.demandes.filter(x => x.prof === b.prof && !x.traitee_le).forEach(x => { x.traitee_le = new Date().toISOString(); });
  return { places: +b.places, prises: prisesProf(m, b.prof) };
}

function commander(store, m, uid, b) {
  if (!estProfParticulier(store, m, uid)) erreur('Réservé aux professeurs particuliers');
  const places = +b.places;
  if (!Number.isInteger(places) || places < 1 || places > 1000) erreur('Entre 1 et 1000 places');
  const lp = licences(store), hier = new Date(Date.now() - 864e5).toISOString();
  if (lp.demandes.filter(x => x.prof === uid && x.cree_le > hier).length >= 5) erreur('Cinq demandes par jour au plus : Mirandola te répond vite');
  const d = { id: lp.demandes.length + 1, prof: uid, places, message: String(b.mot || '').trim(),
    cree_le: new Date().toISOString(), traitee_le: null };
  lp.demandes.push(d);
  return d.id;
}

function maLicence(store, m, uid) {
  const l = licences(store).profs[uid];
  if (!l) return null;
  const d = licences(store).demandes.filter(x => x.prof === uid && !x.traitee_le).pop();
  return { places: l.places, prises: prisesProf(m, uid), inscrits: inscritsProf(m, uid), attente: attenteProf(m, uid),
    fin: l.fin, active: !l.fin || l.fin >= auj(), ia_prof: l.ia_prof, ia_eleve: l.ia_eleve, ia_mois: iaDuMois(store, uid),
    demande: d ? { places: d.places, le: d.cree_le } : null };
}

function creerCompte(store, m, uid, b) {
  estEditeur(m, uid);
  if (!['prof', 'admin', 'eleve'].includes(b.qrole)) erreur('Rôle inconnu');
  const nom = String(b.nom || '').trim();
  if (nom.length < 2 || nom.length > 80) erreur('Un nom de 2 à 80 caractères');
  const id = ouvrirCompte(store, b);
  m.roles[id] = b.qrole;
  return id;
}

/* La table des fonctions, construite à l'appel (elle lit `store`). */
export function fonctionsLicences(store, m, uid) {
  return {
    prof_licence: () => maLicence(store, m, uid),
    prof_commander: b => commander(store, m, uid, b),
    admin_creer_compte: b => creerCompte(store, m, uid, b),
    admin_mdp: b => {
      estEditeur(m, uid);
      if (b.cible === uid) erreur('Ton propre mot de passe se change dans tes réglages');
      if (String(b.pw || '').length < 10) erreur('Mot de passe : dix caractères au moins');
      const u = store.users.find(x => x.id === b.cible) || erreur('Compte inconnu');
      u.password = b.pw; marquerProvisoire(store, u.id);
      return null;
    },
    admin_prof_licence: b => fixerLicence(store, m, uid, b),
    admin_profs: () => { estEditeur(m, uid);
      return Object.keys(m.roles).filter(p => estProfParticulier(store, m, p)).map(p => ligneProf(store, m, p)); },
    admin_cout_ia: () => { estEditeur(m, uid);
      const l = (store.tables.ai_usage || []);
      return { moyenne: l.length ? l.reduce((a, x) => a + (+x.cents || 0), 0) / l.length : null, appels: l.length, mois: 0 }; },
    admin_ia: b => { estEditeur(m, uid);
      const o = etab(store).orgs.find(x => x.id === b.org) || erreur('Établissement inconnu');
      Object.assign(o, { ia_prof: +b.ia_prof, ia_eleve: +b.ia_eleve });
      return null; },
    admin_orgs_ia: () => { estEditeur(m, uid);
      return etab(store).orgs.map(o => ({ org_id: o.id, ia_prof: o.ia_prof ?? 400, ia_eleve: o.ia_eleve ?? 30 })); }
  };
}

/* Pour un parcours : un professeur particulier sous licence (`places` élèves). */
export function semerLicenceProf(store, email, o = {}) {
  const u = store.users.find(x => x.email === email);
  licences(store).profs[u.id] = { places: o.places ?? 30, ia_prof: o.ia_prof ?? 400, ia_eleve: o.ia_eleve ?? 30,
    fin: o.fin ?? null, maj_le: new Date().toISOString() };
  return u.id;
}
