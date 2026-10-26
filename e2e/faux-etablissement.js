// Les fonctions « établissement » de la base (migrations 20261025233000 et
// 20261026001000), rejouées en mémoire pour les parcours : un seul code
// (établissement ou professeur particulier), la classe choisie, les
// groupes, les consoles du référent et de l'éditeur. Même contrat que
// faux-classes.js, dont il partage le modèle des classes (`store.cl`) :
// on émule ce que l'app appelle et ce qu'elle lit, pas la sécurité — elle
// se prouve en base (supabase/tests/etablissement.sql).
//
// Le modèle propre tient dans `store.et` : établissements (licence, codes,
// suivi commercial), qui appartient à quel établissement, codes des
// professeurs particuliers.
import { randomUUID } from 'node:crypto';
import { modele } from './faux-classes.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tire = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nomValide = t => /^[\p{L}][\p{L} '’.-]{0,39}$/u.test(String(t || '').trim());
const nomPropre = (p, n) => {
  const cap = s => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return `${cap(String(p).trim())} ${String(n).trim().toUpperCase()}`;
};
const auj = () => new Date().toISOString().slice(0, 10);
const dansJours = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export function etab(store) {
  store.et = store.et || { orgs: [], membres: {}, codesProfs: {}, journal: [] };
  return store.et;
}

/* Un établissement prêt à l'emploi pour un parcours : licence, codes, classes. */
export function semerEtablissement(store, o = {}) {
  const et = etab(store), m = modele(store);
  const org = { id: randomUUID(), nom: o.nom || 'Lycée Camus', ville: o.ville || 'Nîmes', kind: 'lycee', uai: '',
    offre: o.offre || 'demo', places: o.places === undefined ? 60 : o.places, fin: o.fin === undefined ? dansJours(30) : o.fin,
    exemples: !!o.exemples, codes: { eleve: tire(), prof: tire(), ref: o.sansRef ? null : tire(), refFin: dansJours(30) },
    suivi: { statut: o.statut || 'demo', source: 'editeur', contact_nom: o.contact || '', contact_fonction: '', contact_email: '',
      contact_tel: '', eleves_estimes: null, budget_euros: null, prix_euros: null, besoins: [], message: '', notes: '', relance: null },
    cree: new Date().toISOString() };
  et.orgs.push(org);
  const ids = (o.classes || []).map(nom => {
    const id = randomUUID();
    m.classes.push({ id, name: nom, niveau: nom.split(' ')[0], matiere: '', code: tire(), owner: o.owner || null,
      ouvert: true, validation: false, places: 40, fin: null, archivee: false, org: org.id, genre: 'classe' });
    return id;
  });
  return { org, classes: ids };
}

const orgDe = (et, uid) => et.orgs.find(o => o.id === et.membres[uid]);
const homeDe = (m, oid, uid) => m.membres.map(x => m.classes.find(c => c.id === x.cid && x.uid === uid))
  .find(c => c && c.org === oid && (c.genre || 'classe') === 'classe');

function duCode(et, k) {
  for (const o of et.orgs) {
    if (o.codes.eleve === k) return { org: o, quel: 'eleve' };
    if (o.codes.prof === k) return { org: o, quel: 'prof' };
    if (o.codes.ref === k) return { org: o, quel: 'ref' };
  }
  return null;
}
const profDuCode = (et, k) => Object.keys(et.codesProfs).find(uid => et.codesProfs[uid] === k) || null;

function verdictEtab(store, et, m, o, quel, uid) {
  const role = m.roles[uid] || 'eleve';
  if (o.fin && o.fin < auj()) return 'licence';
  if (et.membres[uid] === o.id) return 'deja';
  if (et.membres[uid]) return 'autre';
  if (m.comptes[uid]) return 'gere';
  if (quel === 'eleve' && role !== 'eleve') return 'role';
  if (quel !== 'eleve' && !['eleve', 'prof'].includes(role)) return 'role';
  const eleves = Object.keys(et.membres).filter(u => et.membres[u] === o.id && (m.roles[u] || 'eleve') === 'eleve').length;
  if (quel === 'eleve' && o.places != null && eleves >= o.places) return 'plein';
  return 'ok';
}

function verdictProf(m, p, uid) {
  if (p === uid) return 'soi';
  if (m.comptes[uid]) return 'gere';
  if ((m.roles[uid] || 'eleve') !== 'eleve') return 'role';
  if (m.membres.some(x => x.uid === uid && m.classes.some(c => c.id === x.cid && c.owner === p && !c.org))) return 'deja';
  return 'ok';
}

const classesOrg = (m, o) => m.classes.filter(c => c.org === o.id && (c.genre || 'classe') === 'classe' && !c.archivee);
const classesProf = (m, p) => m.classes.filter(c => c.owner === p && !c.org && !c.archivee);
const liste = l => l.map(c => ({ id: c.id, nom: c.name, niveau: c.niveau || '' }));

function apercu(store, et, m, b, uid) {
  const k = norm(b.code), e = duCode(et, k);
  if (e) {
    const s = verdictEtab(store, et, m, e.org, e.quel, uid);
    return { type: 'etab', statut: s, quel: e.quel, nom: e.org.nom, ville: e.org.ville, genre: e.org.kind,
      classes: e.quel === 'eleve' && s === 'ok' ? liste(classesOrg(m, e.org)) : [] };
  }
  const p = profDuCode(et, k);
  if (p) {
    const s = verdictProf(m, p, uid);
    return { type: 'prof', statut: s, nom: m.noms[p] || 'Professeur', classes: s === 'ok' ? liste(classesProf(m, p)) : [] };
  }
  return null;
}

function entrer(store, et, m, b, uid) {
  const k = norm(b.code), e = duCode(et, k), p = e ? null : profDuCode(et, k);
  if (!e && !p) return { statut: 'inconnu' };
  const s = e ? verdictEtab(store, et, m, e.org, e.quel, uid) : verdictProf(m, p, uid);
  if (s !== 'ok') return { statut: s };
  if (!nomValide(b.son_prenom) || !nomValide(b.son_nom)) return { statut: 'nom' };
  const nom = nomPropre(b.son_prenom, b.son_nom);
  let c = null;
  if (e) {
    if (e.quel === 'eleve') {
      if (b.classe) { c = classesOrg(m, e.org).find(x => x.id === b.classe); if (!c) return { statut: 'classe' }; }
      else if (classesOrg(m, e.org).length) return { statut: 'choisir' };
    }
    m.noms[uid] = nom; et.membres[uid] = e.org.id; m.roles[uid] = e.quel;
    if (c) m.membres.push({ cid: c.id, uid, depuis: new Date().toISOString() });
    if (e.quel === 'ref') {
      e.org.codes.ref = null;
      if (e.org.exemples && !m.classes.some(x => x.org === e.org.id)) {
        for (const [n, niv] of [['2nde A — exemple', '2nde'], ['1re B — exemple', '1re'], ['Tle C — exemple', 'Tle']]) {
          m.classes.push({ id: randomUUID(), name: n, niveau: niv, matiere: '', code: tire(), owner: uid, ouvert: true,
            validation: false, places: 40, fin: null, archivee: false, org: e.org.id, genre: 'classe' });
        }
      }
    }
    et.journal.push({ org: e.org.id, acte: e.quel === 'eleve' ? 'élève entré avec le code' : e.quel === 'prof'
      ? 'professeur entré avec le code' : 'référent entré avec son code', detail: { nom, classe: c && c.name }, at: new Date().toISOString() });
    return { statut: 'ok', type: 'etab', quel: e.quel, nom: e.org.nom, classe: c ? c.name : null };
  }
  const siennes = classesProf(m, p);
  if (b.classe) { c = siennes.find(x => x.id === b.classe); if (!c) return { statut: 'classe' }; }
  else if (siennes.length > 1) return { statut: 'choisir' };
  else c = siennes[0];
  if (!c) {
    c = { id: randomUUID(), name: 'Mes élèves', niveau: '', matiere: 'Cours', code: tire(), owner: p, ouvert: true,
      validation: false, places: 40, fin: null, archivee: false, org: null, genre: 'classe' };
    m.classes.push(c);
  }
  m.membres.push({ cid: c.id, uid, depuis: new Date().toISOString(), who: nom });
  if (!m.noms[uid]) m.noms[uid] = nom;
  return { statut: 'ok', type: 'prof', nom: m.noms[p] || 'Professeur', classe: c.name };
}

function monEcole(et, m, uid) {
  const o = orgDe(et, uid);
  if (!o) return [];
  const c = homeDe(m, o.id, uid);
  return [{ org_id: o.id, org: o.nom, org_kind: o.kind, ville: o.ville, class_id: c ? c.id : null, classe: c ? c.name : null,
    niveau: c ? c.niveau : null, filiere: null, cycle: null, effectif: c ? m.membres.filter(x => x.cid === c.id).length : 0,
    role: m.roles[uid] || 'eleve' }];
}

/* La table des fonctions, construite à l'appel (elle lit `store`). */
export function fonctionsEtab(store, m, uid) {
  const et = etab(store);
  return {
    my_school: () => monEcole(et, m, uid),
    code_apercu: b => apercu(store, et, m, b, uid),
    rejoindre: b => entrer(store, et, m, b, uid),
    prof_mon_code: b => {
      if (!et.codesProfs[uid] || (b && b.nouveau)) et.codesProfs[uid] = tire();
      return et.codesProfs[uid];
    }
  };
}
