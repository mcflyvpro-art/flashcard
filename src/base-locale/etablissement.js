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
import { uuid as randomUUID } from './uuid.js';
import { modele } from './classes.js';
import { fonctionsFacturation } from './facturation.js';

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

/* Le rythme des codes (20261026110000) : la date de fin d'un code, comme
   ref_codes la rend. La tâche de nuit, elle, ne se rejoue pas : un parcours
   ou une visite de la démo ne dure pas une semaine. */
const DUREE = { semaine: 7, mois: 30, trimestre: 91 };
const jusqua = (o, quel) => new Date(Date.parse(o.codes[quel + 'Au'] || o.cree) + DUREE[o.rythme || 'semaine'] * 864e5).toISOString();

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

export const orgDe = (et, uid) => et.orgs.find(o => o.id === et.membres[uid]);
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

/* Une place par élève et par professeur (20261026130000) ; le référent n'en prend pas. */
export const placesPrises = (et, m, o) =>
  Object.keys(et.membres).filter(u => et.membres[u] === o.id && ['eleve', 'prof'].includes(m.roles[u] || 'eleve')).length;
export const placesLibres = (et, m, o) => (o.places == null ? null : Math.max(0, o.places - placesPrises(et, m, o)));

function verdictEtab(store, et, m, o, quel, uid) {
  const role = m.roles[uid] || 'eleve';
  if (o.fin && o.fin < auj()) return 'licence';
  if (et.membres[uid] === o.id) return 'deja';
  if (et.membres[uid]) return 'autre';
  if (m.comptes[uid]) return 'gere';
  if (quel === 'eleve' && role !== 'eleve') return 'role';
  if (quel !== 'eleve' && !['eleve', 'prof'].includes(role)) return 'role';
  if (quel !== 'ref' && placesLibres(et, m, o) === 0) return 'plein';
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

/* ---------- la console du référent ----------
   Les services (qui enseigne quoi, où) vivent dans `et.services` ; le
   journal dans la table `ref_audit`, que l'app lit en REST. */
export const erreur = m => { throw new Error(m); };
const estEleve = (m, u) => (m.roles[u] || 'eleve') === 'eleve';
export const membresOrg = (et, o) => Object.keys(et.membres).filter(u => et.membres[u] === o.id);
const effectif = (m, cid) => m.membres.filter(x => x.cid === cid).length;

export function tracer(store, cible, acte, detail) {
  (store.tables.ref_audit = store.tables.ref_audit || [])
    .unshift({ acte, cible, detail: detail || {}, created_at: new Date().toISOString() });
}

export function referent(et, m, uid) {
  const o = orgDe(et, uid);
  if (!o || m.roles[uid] !== 'ref') erreur('Réservé au référent de l’établissement');
  return o;
}

function personne(store, et, m, o, u) {
  const h = homeDe(m, o.id, u), user = store.users.find(x => x.id === u) || {};
  const sv = (et.services || []).find(x => x.prof === u);
  return { id: u, email: user.email, handle: null, name: m.noms[u] || user.email, role: m.roles[u] || 'eleve',
    classe: h ? h.name : null, class_id: h ? h.id : null, matiere: sv ? sv.matiere : null,
    derniere: m.membres.find(x => x.uid === u && x.vu)?.vu || null, jamais: !m.membres.some(x => x.uid === u && x.vu),
    carte: !!m.comptes[u] };
}

function personnes(store, et, m, uid, b) {
  const o = referent(et, m, uid), q = String(b.q || '').toLowerCase();
  const l = membresOrg(et, o).map(u => personne(store, et, m, o, u))
    .filter(g => !b.qrole || g.role === b.qrole)
    .filter(g => !b.qclass || m.membres.some(x => x.uid === g.id && x.cid === b.qclass))
    .filter(g => !b.sans_classe || (g.role === 'eleve' && !g.class_id))
    .filter(g => !q || (g.name || '').toLowerCase().includes(q) || (g.email || '').includes(q))
    .sort((a, c) => a.role.localeCompare(c.role) || a.name.localeCompare(c.name));
  return l.slice(b.off || 0, (b.off || 0) + (b.lim || 60)).map(g => ({ ...g, total: l.length }));
}

function tableau(et, m, uid) {
  const o = referent(et, m, uid), gens = membresOrg(et, o), cl = classesOrg(m, o), sv = (et.services || []);
  const eleves = gens.filter(u => estEleve(m, u));
  return [{ org_id: o.id, org: o.nom, kind: o.kind, ville: o.ville, uai: o.uai, classes: cl.length, eleves: eleves.length,
    profs: gens.filter(u => m.roles[u] === 'prof').length, refs: gens.filter(u => m.roles[u] === 'ref').length,
    services: sv.filter(x => cl.some(c => c.id === x.cid)).length, devoirs: 0,
    actifs7: gens.filter(u => m.membres.some(x => x.uid === u && x.vu)).length,
    jamais_venus: gens.filter(u => u !== uid && !m.membres.some(x => x.uid === u && x.vu)).length,
    sans_classe: eleves.filter(u => !homeDe(m, o.id, u)).length,
    classes_vides: cl.filter(c => !effectif(m, c.id)).length,
    sans_pp: cl.filter(c => !sv.some(x => x.cid === c.id && x.pp)).length }];
}

function classesRef(et, m, uid) {
  const o = referent(et, m, uid), sv = et.services || [];
  return m.classes.filter(c => c.org === o.id && !c.archivee).map(c => {
    const pp = sv.find(x => x.cid === c.id && x.pp);
    return { id: c.id, name: c.name, niveau: c.niveau || '', cycle: c.cycle || '', filiere: '', code: c.code, annee: '2026-2027',
      effectif: effectif(m, c.id), prevu: null, profs: sv.filter(x => x.cid === c.id).length, pp: pp ? m.noms[pp.prof] : null,
      devoirs: 0, actifs7: 0, genre: c.genre || 'classe' };
  });
}

function fonctionsRef(store, et, m, uid) {
  const sv = () => (et.services = et.services || []);
  const classe = cid => { const o = referent(et, m, uid), c = m.classes.find(x => x.id === cid && x.org === o.id);
    return c || erreur('Classe introuvable'); };
  return {
    ref_codes: () => { const o = referent(et, m, uid), gens = membresOrg(et, o);
      return { eleve: o.codes.eleve, prof: o.codes.prof, offre: o.offre, places: o.places, licence_fin: o.fin,
        eleves: gens.filter(u => estEleve(m, u)).length, profs: gens.filter(u => m.roles[u] === 'prof').length,
        rythme: o.rythme || 'semaine', eleve_jusqua: jusqua(o, 'eleve'), prof_jusqua: jusqua(o, 'prof') }; },
    ref_nouveau_code: b => { const o = referent(et, m, uid); o.codes[b.quel] = tire(); o.codes[b.quel + 'Au'] = new Date().toISOString();
      tracer(store, null, 'code changé', { role: b.quel });
      return o.codes[b.quel]; },
    ref_rythme: b => { const o = referent(et, m, uid);
      if (!DUREE[b.p]) erreur('Chaque semaine, chaque mois ou chaque trimestre');
      o.rythme = b.p; tracer(store, null, 'rythme des codes', { rythme: b.p });
      return b.p; },
    ref_dashboard: () => tableau(et, m, uid),
    ref_classes: () => classesRef(et, m, uid),
    ref_personnes: b => personnes(store, et, m, uid, b),
    ref_class_team: b => { classe(b.cid);
      return sv().filter(x => x.cid === b.cid).map(x => ({ teaching_id: x.id, teacher: x.prof, nom: m.noms[x.prof], matiere: x.matiere,
        principal: x.pp })); },
    ref_service: b => { referent(et, m, uid);
      return sv().filter(x => x.prof === b.uid).map(x => { const c = m.classes.find(k => k.id === x.cid);
        return { teaching_id: x.id, class_id: x.cid, classe: c.name, niveau: c.niveau, matiere: x.matiere, principal: x.pp,
          effectif: effectif(m, x.cid) }; }); },
    ref_save_class: b => {
      const o = referent(et, m, uid);
      if (!String(b.nom || '').trim()) erreur('Donne un nom à la classe');
      if (b.cid) { const c = classe(b.cid); c.name = b.nom; c.niveau = b.niveau; tracer(store, null, 'classe modifiée', { nom: b.nom }); return c.id; }
      const c = { id: randomUUID(), name: b.nom, niveau: b.niveau, cycle: b.cycle, matiere: '', code: tire(), owner: uid, ouvert: true,
        validation: false, places: 40, fin: null, archivee: false, org: o.id, genre: 'classe' };
      m.classes.push(c); tracer(store, null, 'classe créée', { nom: b.nom });
      return c.id;
    },
    ref_delete_class: b => { const c = classe(b.cid);
      if (effectif(m, c.id)) erreur(`Cette classe compte encore ${effectif(m, c.id)} élèves. Déplace-les d’abord.`);
      m.classes = m.classes.filter(x => x.id !== c.id); tracer(store, null, 'classe supprimée', { nom: c.name }); return null; },
    ref_set_teaching: b => { classe(b.cid);
      if (b.pp) for (const x of sv()) if (x.cid === b.cid) x.pp = false;
      let t = sv().find(x => x.cid === b.cid && x.prof === b.prof && x.matiere === b.matiere);
      if (!t) { t = { id: randomUUID(), cid: b.cid, prof: b.prof, matiere: b.matiere, pp: false }; sv().push(t); }
      t.pp = !!b.pp; tracer(store, b.prof, 'service', { matiere: b.matiere }); return t.id; },
    ref_drop_teaching: b => { referent(et, m, uid); et.services = sv().filter(x => x.id !== b.tid); return null; },
    ref_move_student: b => {
      const o = referent(et, m, uid), avant = homeDe(m, o.id, b.cible);
      if (avant) m.membres = m.membres.filter(x => !(x.uid === b.cible && x.cid === avant.id));
      if (b.vers) { const c = classe(b.vers); m.membres.push({ cid: c.id, uid: b.cible, depuis: new Date().toISOString() }); }
      tracer(store, b.cible, 'élève déplacé', { avant: avant && avant.name, apres: b.vers && classe(b.vers).name }); return null;
    },
    ref_update_account: b => { referent(et, m, uid); const avant = m.noms[b.cible];
      if (b.nom) m.noms[b.cible] = b.nom;
      tracer(store, b.cible, 'identité corrigée', { avant: { nom: avant }, apres: { nom: b.nom } }); return null; },
    ref_set_role: b => { referent(et, m, uid); const avant = m.roles[b.cible] || 'eleve'; m.roles[b.cible] = b.nouveau;
      tracer(store, b.cible, 'rôle changé', { avant, apres: b.nouveau }); return null; },
    ref_set_password: b => { referent(et, m, uid); store.users.find(x => x.id === b.cible).password = b.pw; return null; }
  };
}

/* ---------- la console de l'éditeur ----------
   Le suivi vit dans `org.suivi` (semé par semerEtablissement), la licence et
   les codes sur l'établissement ; `admin_orgs` rend la ligne à plat, comme
   la vraie fonction. */
function editeur(m, uid) { if (m.roles[uid] !== 'admin') erreur('Réservé à l’éditeur'); }

function ligneAdmin(store, et, m, o) {
  const gens = membresOrg(et, o), venus = u => m.membres.some(x => x.uid === u && x.vu);
  return { id: o.id, code: '', name: o.nom, kind: o.kind, ville: o.ville, uai: o.uai,
    classes: classesOrg(m, o).length, eleves: gens.filter(u => estEleve(m, u)).length,
    profs: gens.filter(u => m.roles[u] === 'prof').length, refs: gens.filter(u => m.roles[u] === 'ref').length,
    devoirs: 0, actifs7: gens.filter(venus).length, actifs30: gens.filter(venus).length,
    jamais_venus: gens.filter(u => !venus(u)).length, cents_mois: 0, cents_total: 0, ouvert: o.cree,
    offre: o.offre, places: o.places, licence_fin: o.fin, code_ref: o.codes.ref, code_ref_fin: o.codes.ref ? o.codes.refFin : null,
    code_eleve: o.codes.eleve, code_prof: o.codes.prof, ...o.suivi, suivi_maj: o.cree };
}

function enregistrer(store, et, m, uid, b) {
  editeur(m, uid);
  const f = b.fiche || {}, nom = String(f.nom || '').trim();
  if (nom.length < 2) erreur('Un nom de 2 à 120 caractères');
  const uai = String(f.uai || '').trim().toUpperCase();
  if (uai && !/^[0-9]{7}[A-Z]$/.test(uai)) erreur('L’UAI s’écrit 7 chiffres et une lettre');
  let o = b.org && et.orgs.find(x => x.id === b.org);
  if (b.org && !o) erreur('Établissement inconnu');
  if (!o) {
    o = semerEtablissement(store, { nom, statut: 'prospect', fin: null, places: null }).org;
    o.codes = { eleve: null, prof: null, ref: null, refFin: null };
  }
  const n = v => (v === '' || v == null ? null : +v);
  Object.assign(o, { nom, kind: f.genre || 'lycee', ville: f.ville || '', uai });
  Object.assign(o.suivi, { statut: f.statut || 'prospect', contact_nom: f.contact_nom || '', contact_fonction: f.contact_fonction || '',
    contact_email: String(f.contact_email || '').toLowerCase(), contact_tel: f.contact_tel || '', eleves_estimes: n(f.eleves_estimes),
    budget_euros: n(f.budget_euros), prix_euros: n(f.prix_euros), besoins: f.besoins || [], notes: f.notes || '', relance: f.relance || null });
  return o.id;
}

function fonctionsAdmin(store, et, m, uid) {
  const org = id => { editeur(m, uid); return et.orgs.find(x => x.id === id) || erreur('Établissement inconnu'); };
  return {
    admin_orgs: () => { editeur(m, uid); return et.orgs.map(o => ligneAdmin(store, et, m, o)); },
    admin_etat: () => { editeur(m, uid);
      return [{ comptes: store.users.length, hors_etab: store.users.filter(u => !et.membres[u.id]).length, orgs: et.orgs.length,
        actifs7: 0, cents_mois: 0, signalements: 0, masques: 0 }]; },
    admin_accounts: () => { editeur(m, uid);
      return store.users.map(u => ({ id: u.id, email: u.email, handle: null, name: m.noms[u.id] || null, role: m.roles[u.id] || 'eleve',
        cree: new Date().toISOString(), livres: 0, bloque: false })); },
    set_role: b => { editeur(m, uid); if (b.cible === uid) erreur('On ne se retire pas son propre rôle'); m.roles[b.cible] = b.nouveau; return null; },
    admin_etab_enregistrer: b => enregistrer(store, et, m, uid, b),
    admin_lancer_demo: b => { const o = org(b.org);
      Object.assign(o, { offre: 'demo', places: b.places, fin: dansJours(b.jours || 30), exemples: b.exemples !== false });
      o.codes = { eleve: o.codes.eleve || tire(), prof: o.codes.prof || tire(), ref: tire(), refFin: dansJours(30) };
      o.suivi.statut = 'demo';
      return { code_ref: o.codes.ref, ref_fin: o.codes.refFin, fin: o.fin }; },
    admin_licence: b => { const o = org(b.org);
      Object.assign(o, { places: b.places, fin: b.fin, offre: b.offre });
      o.codes.eleve = o.codes.eleve || tire(); o.codes.prof = o.codes.prof || tire();
      if (b.offre === 'etablissement') o.suivi.statut = 'client';
      return null; },
    admin_code_ref: b => { const o = org(b.org); o.codes.ref = tire(); o.codes.refFin = dansJours(30); return { code_ref: o.codes.ref }; },
    admin_supprimer_etab: b => { const o = org(b.org);
      if (membresOrg(et, o).length) erreur('Des comptes existent dans cet établissement');
      if ((et.factures || []).some(f => f.org_id === o.id)) erreur('Il a été facturé : ses factures se gardent dix ans');
      et.orgs = et.orgs.filter(x => x.id !== o.id); return null; }
  };
}

/* La demande de démo du site, sans compte : mêmes refus que la base. */
export function demanderDemoFaux(store, b) {
  const et = etab(store), mel = String(b.email || '').trim().toLowerCase();
  if (String(b.etab || '').trim().length < 2 || String(b.contact_nom || '').trim().length < 2) return 'champs';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mel)) return 'email';
  if (et.orgs.some(o => o.suivi.source === 'demande' && o.suivi.contact_email === mel)) return 'deja';
  const { org } = semerEtablissement(store, { nom: String(b.etab).trim(), ville: b.ville || '', statut: 'prospect', fin: null,
    places: null, sansRef: true });
  org.codes = { eleve: null, prof: null, ref: null, refFin: null };
  Object.assign(org.suivi, { source: 'demande', contact_nom: b.contact_nom, contact_fonction: b.fonction || '', contact_email: mel,
    contact_tel: b.tel || '', eleves_estimes: b.eleves, message: b.message || '' });
  return 'ok';
}

/* ---------- l'espace professeur au modèle « un seul code » (20261026030000) ---------- */
function fonctionsProf(store, et, m, uid) {
  const sv = () => (et.services = et.services || []);
  const monOrg = () => { const o = orgDe(et, uid); if (m.roles[uid] !== 'prof' || !o) erreur('Réservé aux professeurs d’un établissement'); return o; };
  return {
    prof_code_etab: () => monOrg().codes.eleve || erreur('Le référent n’a pas encore de code élèves'),
    prof_classes_etab: () => { const o = monOrg();
      return classesOrg(m, o).map(c => { const s = sv().find(x => x.cid === c.id && x.prof === uid);
        return { id: c.id, nom: c.name, niveau: c.niveau || '', effectif: effectif(m, c.id), enseigne: !!s, matiere: s ? s.matiere : '' }; }); },
    prof_enseigner: b => { const o = monOrg();
      if (!classesOrg(m, o).some(c => c.id === b.cid)) erreur('Cette classe n’est pas dans ton établissement');
      et.services = sv().filter(x => !(x.cid === b.cid && x.prof === uid));
      if (b.oui) sv().push({ id: randomUUID(), cid: b.cid, prof: uid, matiere: b.matiere || 'Cours', pp: false });
      return null; },
    prof_eleves_etab: b => { const o = monOrg(), q = String(b.q || '').toLowerCase();
      return membresOrg(et, o).filter(u => estEleve(m, u)).map(u => { const h = homeDe(m, o.id, u);
        return { id: u, nom: m.noms[u] || 'Élève', classe: h ? h.name : '', classe_id: h ? h.id : null }; })
        .filter(e => (!b.cid || e.classe_id === b.cid) && (!q || e.nom.toLowerCase().includes(q)))
        .sort((a, c) => a.classe.localeCompare(c.classe) || a.nom.localeCompare(c.nom)); },
    prof_groupe: b => { const o = monOrg();
      if (!String(b.nom || '').trim()) erreur('Un nom de groupe de 1 à 60 caractères');
      let g = b.gid && m.classes.find(c => c.id === b.gid && c.genre === 'groupe');
      if (b.gid && !g) erreur('Ce groupe n’est pas à toi');
      if (!g) {
        g = { id: randomUUID(), name: b.nom.trim(), niveau: '', matiere: b.matiere || 'Cours', code: tire(), owner: uid, ouvert: false,
          validation: false, places: 300, fin: null, archivee: false, org: o.id, genre: 'groupe' };
        m.classes.push(g);
      } else { g.name = b.nom.trim(); m.membres = m.membres.filter(x => x.cid !== g.id || (b.eleves || []).includes(x.uid)); }
      for (const u of b.eleves || []) {
        if (et.membres[u] === o.id && estEleve(m, u) && !m.membres.some(x => x.cid === g.id && x.uid === u)) {
          m.membres.push({ cid: g.id, uid: u, depuis: new Date().toISOString() });
        }
      }
      return g.id; },
    prof_ajouter_eleve: b => { const c = m.classes.find(x => x.id === b.cid && x.owner === uid && !x.org);
      if (!c) erreur('Cette classe n’est pas à toi');
      if (!m.membres.some(x => x.cid === c.id && x.uid === b.qui)) m.membres.push({ cid: c.id, uid: b.qui, depuis: new Date().toISOString() });
      return null; }
  };
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
    },
    ...fonctionsRef(store, et, m, uid),
    ...fonctionsProf(store, et, m, uid),
    ...fonctionsAdmin(store, et, m, uid),
    ...fonctionsFacturation(store, et, m, uid)
  };
}
