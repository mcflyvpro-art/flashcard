// Les fonctions « classes » de la base, rejouées en mémoire pour les parcours
// professeur ↔ élève (2026-10-24). Même contrat que faux-supabase.js : on
// émule ce que l'app appelle et ce qu'elle lit en retour (noms de colonnes,
// statuts de `class_preview`/`class_join`), pas la sécurité — la RLS, les
// limites d'essais et les droits se prouvent en base (supabase/tests/).
//
// Le modèle tient dans `store.cl` : classes, membres, salle d'attente,
// exclus, devoirs. L'avancement d'un devoir se lit, comme le déclencheur
// `avancement_devoir`, dans les révisions envoyées par l'app (cartes
// « a:<devoir>:<rang> »).
import { randomUUID } from 'node:crypto';
import { etab, fonctionsEtab } from './faux-etablissement.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ANNEE = '2026-2027';
const tire = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const nomValide = t => /^[\p{L}][\p{L} '’.-]{0,39}$/u.test(String(t || '').trim());
const nomPropre = (p, n) => {
  const cap = s => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return `${cap(String(p).trim())} ${String(n).trim().toUpperCase()}`;
};

export function modele(store) {
  store.cl = store.cl || { classes: [], membres: [], demandes: [], exclus: [], devoirs: [], roles: {}, comptes: {}, noms: {} };
  return store.cl;
}

/* Un professeur, tel que la base le connaît : son rôle et son nom affiché. */
export function faireProfesseur(store, email, nom) {
  const u = store.users.find(x => x.email === email);
  const m = modele(store);
  m.roles[u.id] = 'prof'; m.noms[u.id] = nom;
  return u.id;
}

/* Un compte personnel tel que la vraie base le voit (my_role répond
   « eleve ») — sans cet appel, un compte de test garde la réponse vide. */
export function faireEleve(store, email) {
  const u = store.users.find(x => x.email === email);
  modele(store).roles[u.id] = 'eleve';
  return u.id;
}

const classeDe = (m, cid) => m.classes.find(c => c.id === cid);
const membresDe = (m, cid) => m.membres.filter(x => x.cid === cid);
const nomDe = (m, uid, store) => m.noms[uid] || (store.users.find(u => u.id === uid) || {}).email || 'Élève';

/* Ce qu'un élève a revu d'un devoir : les révisions des cartes « a:<id>:<rang> ». */
function avancement(store, d, uid) {
  const vues = new Set((store.tables.reviews || [])
    .filter(r => r.user_id === uid && String(r.card_id || '').startsWith(`a:${d.id}:`)).map(r => r.card_id));
  const ouvert = d.ouverts.has(uid);
  const n = d.cartes.length;
  const etat = vues.size >= n ? 'rendu' : vues.size || ouvert ? 'commence' : 'pas ouvert';
  return { vus: vues.size, etat, pct: vues.size ? 80 : 0 };
}

function ligneClasse(store, m, c, uid) {
  const mem = membresDe(m, c.id), devs = m.devoirs.filter(d => d.cid === c.id);
  const dernier = devs[devs.length - 1];
  return {
    id: c.id, name: c.name, niveau: c.niveau, cycle: '', filiere: '', annee_scolaire: ANNEE, code: c.code,
    matiere: c.matiere, principal: false, effectif: mem.length, devoirs: devs.length, encours: devs.length,
    retard: 0, pas_ouvert: 0, jamais: mem.filter(x => !x.vu).length, actifs7: 0, pct: 0,
    dernier: dernier ? dernier.nom : null, dernier_due: dernier ? dernier.due : null,
    gere: c.owner === uid, createur: c.owner === uid, etab: false,
    attente: m.demandes.filter(x => x.cid === c.id).length, archivee: !!c.archivee,
    ouvert: c.ouvert, validation: c.validation, places: c.places, fin: c.fin,
    code_collegue: null, fin_collegue: null
  };
}

function roster(store, m, cid) {
  const devs = m.devoirs.filter(d => d.cid === cid);
  return membresDe(m, cid).map(x => {
    const av = devs.map(d => avancement(store, d, x.uid));
    const rendus = av.filter(a => a.etat === 'rendu').length;
    return { user_id: x.uid, who: nomDe(m, x.uid, store), handle: '', rendus, donnes: devs.length,
      pct: rendus ? 80 : 0, vu: x.vu || null, jamais: !x.vu, pages7: av.reduce((s, a) => s + a.vus, 0),
      jours7: av.some(a => a.vus) ? 1 : 0, retard: 0, inscrit: x.depuis,
      carte: !!m.comptes[x.uid], identifiant: (m.comptes[x.uid] || {}).identifiant || null };
  });
}

function devoirsClasse(store, m, cid, uid) {
  const effectif = membresDe(m, cid).length;
  return m.devoirs.filter(d => d.cid === cid).map(d => {
    const av = membresDe(m, cid).map(x => avancement(store, d, x.uid));
    return { id: d.id, nom: d.nom, matiere: d.matiere, n: d.cartes.length, due: d.due, donne: d.donne,
      mien: d.auteur === uid, auteur: nomDe(m, d.auteur, store), effectif,
      ouvert: av.filter(a => a.etat !== 'pas ouvert').length, rendu: av.filter(a => a.etat === 'rendu').length,
      pct: av.some(a => a.vus) ? 80 : 0, class_id: cid, classe: classeDe(m, cid).name };
  });
}

/* Le verdict d'un code, dans l'ordre où la base le rend. */
function verdict(store, m, code, uid) {
  const c = m.classes.find(x => x.code === String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  if (!c) return ['inconnu', null];
  if (m.roles[uid] === 'prof') return ['role', c];
  if (membresDe(m, c.id).some(x => x.uid === uid)) return ['deja', c];
  if (m.exclus.some(x => x.cid === c.id && x.uid === uid)) return ['refuse', c];
  if (m.demandes.some(x => x.cid === c.id && x.uid === uid)) return ['attente', c];
  if (c.archivee) return ['archive', c];
  if (!c.ouvert) return ['ferme', c];
  if (membresDe(m, c.id).length >= c.places) return ['complet', c];
  return ['apercu', c];
}

const fiche = (store, m, statut, c) => [{ statut, class_id: c ? c.id : null, nom: c ? c.name : null, niveau: c ? c.niveau : null,
  prof: c ? nomDe(m, c.owner, store) : null, etab: null, validation: c ? c.validation : null, collegue: false }];

function rejoindre(store, m, b, uid) {
  const [s, c] = verdict(store, m, b.join_code, uid);
  if (s !== 'apercu') return fiche(store, m, s, c);
  if (!m.comptes[uid]) {
    if (!nomValide(b.son_prenom) || !nomValide(b.son_nom)) return fiche(store, m, 'nom', c);
    m.noms[uid] = nomPropre(b.son_prenom, b.son_nom);
  }
  const ligne = { cid: c.id, uid, depuis: new Date().toISOString() };
  if (c.validation) { m.demandes.push(ligne); return fiche(store, m, 'attente', c); }
  m.membres.push(ligne);
  return fiche(store, m, 'inscrit', c);
}

/* Un compte à carte : identifiant « prenom.nom », mot de passe = code. */
function creerEleves(store, m, b) {
  const c = classeDe(m, b.cid);
  return (b.eleves || []).map((e, i) => {
    if (!nomValide(e.prenom) || !nomValide(e.nom)) return { rang: i + 1, statut: 'invalide', user_id: null, nom: '', identifiant: null, code: null };
    const nom = nomPropre(e.prenom, e.nom);
    const base = sansAccent(`${e.prenom}.${e.nom}`).toLowerCase().replace(/[^a-z.]/g, '');
    let identifiant = base, k = 2;
    while (Object.values(m.comptes).some(x => x.identifiant === identifiant)) identifiant = base + k++;
    const code = tire(), id = randomUUID();
    store.users.push({ id, email: `${identifiant}@eleves.folio.invalid`, password: code });
    m.comptes[id] = { identifiant, nom }; m.noms[id] = nom; m.roles[id] = 'eleve';
    m.membres.push({ cid: c.id, uid: id, depuis: new Date().toISOString() });
    if (c.org) etab(store).membres[id] = c.org;          // un compte à carte d'un établissement en est membre
    return { rang: i + 1, statut: 'cree', user_id: id, nom, identifiant, code };
  });
}

function nouvellesCartes(store, m, b) {
  return (b.qui || []).filter(id => m.comptes[id]).map(id => {
    const code = tire(), u = store.users.find(x => x.id === id);
    u.password = code;
    return { user_id: id, nom: m.comptes[id].nom, identifiant: m.comptes[id].identifiant, code };
  });
}

function donner(m, b, uid) {
  for (const cid of b.cids || []) {
    m.devoirs.push({ id: randomUUID(), cid, nom: b.nom, matiere: b.matiere, cartes: b.cartes || [], due: b.due,
      donne: new Date().toISOString(), auteur: uid, ouverts: new Set() });
  }
  return (b.cids || []).length;
}

function eleveClasses(store, m, uid) {
  const etab = c => ((store.et && store.et.orgs.find(o => o.id === c.org)) || {}).nom || null;
  const l = c => ({ class_id: c.id, nom: c.name, niveau: c.niveau, etab: etab(c), prof: nomDe(m, c.owner, store),
    matieres: c.matiere, effectif: membresDe(m, c.id).length, depuis: new Date().toISOString(), peut_quitter: !c.org,
    a_faire: m.devoirs.filter(d => d.cid === c.id).length, genre: c.genre || 'classe' });
  return [
    ...m.membres.filter(x => x.uid === uid).map(x => ({ ...l(classeDe(m, x.cid)), statut: 'inscrit' })),
    ...m.demandes.filter(x => x.uid === uid).map(x => ({ ...l(classeDe(m, x.cid)), statut: 'attente' }))
  ];
}

/* La page d'une classe (20261025210000) : la même forme qu'en base. Qui voit
   quoi (blocages, salle d'attente, inconnus) se prouve dans
   supabase/tests/classe_eleve.sql. */
function eleveClasse(store, m, uid, cid) {
  const c = classeDe(m, cid);
  if (!c) return { statut: 'inconnue' };
  if (!m.membres.some(x => x.cid === cid && x.uid === uid)) {
    return m.demandes.some(x => x.cid === cid && x.uid === uid)
      ? { statut: 'attente', id: c.id, nom: c.name, niveau: c.niveau, etab: '' } : { statut: 'inconnue' };
  }
  const amis = store.tables.friends || [];
  const lien = id => (amis.find(f => (f.user_id === uid && f.friend_id === id) || (f.friend_id === uid && f.user_id === id)) || {}).status || '';
  const eleves = membresDe(m, cid).map(x => ({ id: x.uid, nom: nomDe(m, x.uid, store), pseudo: '', moi: x.uid === uid, ami: lien(x.uid) }))
    .sort((a, b) => (b.moi - a.moi) || a.nom.localeCompare(b.nom));
  return { statut: 'inscrit', id: c.id, nom: c.name, niveau: c.niveau, etab: '', peut_quitter: true,
    depuis: new Date().toISOString(), eleves,
    profs: [{ id: c.owner, nom: nomDe(m, c.owner, store), matiere: c.matiere || '', principal: true }] };
}

function eleveDevoirs(store, m, uid) {
  const mes = new Set(m.membres.filter(x => x.uid === uid).map(x => x.cid));
  return m.devoirs.filter(d => mes.has(d.cid)).map(d => {
    const a = avancement(store, d, uid);
    return { id: d.id, class_id: d.cid, classe: classeDe(m, d.cid).name, nom: d.nom, matiere: d.matiere,
      n: d.cartes.length, due: d.due, donne: d.donne, etat: a.etat === 'pas ouvert' ? 'a_faire' : a.etat, pct: a.pct, vus: a.vus };
  });
}

function admettre(m, b) {
  const qui = new Set(b.qui || []);
  const l = m.demandes.filter(x => x.cid === b.cid && qui.has(x.uid));
  m.demandes = m.demandes.filter(x => !l.includes(x));
  m.membres.push(...l);
  return l.length;
}

function refuser(m, b) {
  const qui = new Set(b.qui || []);
  const l = m.demandes.filter(x => x.cid === b.cid && qui.has(x.uid));
  m.demandes = m.demandes.filter(x => !l.includes(x));
  if (b.exclure) m.exclus.push(...l);
  return l.length;
}

function retirer(m, b) {
  const l = m.membres.filter(x => x.cid === b.cid && x.uid === b.qui);
  m.membres = m.membres.filter(x => !l.includes(x));
  if (b.exclure) m.exclus.push(...l);
  return null;
}

function reglages(m, b) {
  const c = classeDe(m, b.cid);
  Object.assign(c, { ouvert: b.ouvert, validation: b.validation, places: b.nb_places });
  if (b.minutes !== undefined && b.minutes !== null && b.minutes >= 0) {
    c.fin = b.minutes ? new Date(Date.now() + b.minutes * 60000).toISOString() : null;
  }
  return null;
}

function creerClasse(store, m, b, uid) {
  const id = randomUUID();
  m.classes.push({ id, name: b.nom, niveau: b.niveau || '', matiere: b.matiere || '', code: tire(), owner: uid,
    ouvert: true, validation: true, places: 40, fin: null, archivee: false,
    org: (store.et && store.et.membres[uid]) || null, genre: 'classe' });
  return id;
}

/* La table des fonctions : construite à l'appel (elle lit `store`). */
function fonctions(store, m, uid) {
  return {
    /* La vraie fonction répond « eleve » à un compte sans rôle. Ici, un
       compte que le test n'a pas déclaré garde la réponse vide d'avant :
       la visite guidée, réservée aux élèves, ne s'invite pas au milieu des
       parcours qui ne parlent pas de classes. */
    my_role: () => m.roles[uid] || [],
    mon_compte: () => [m.comptes[uid] ? { gere: true, nom: m.comptes[uid].nom, identifiant: m.comptes[uid].identifiant }
      : { gere: false, nom: m.noms[uid] || null, identifiant: null }],
    prof_annees: () => [{ annee: ANNEE, classes: m.classes.filter(c => c.owner === uid).length, courante: true }],
    prof_classes: () => m.classes.filter(c => c.owner === uid).map(c => ligneClasse(store, m, c, uid)),
    prof_creer_classe: b => creerClasse(store, m, b, uid),
    prof_roster: b => roster(store, m, b.cid),
    prof_devoirs: b => devoirsClasse(store, m, b.cid, uid),
    prof_demandes: b => m.demandes.filter(x => x.cid === b.cid)
      .map(x => ({ user_id: x.uid, who: nomDe(m, x.uid, store), handle: '', depuis: x.depuis })),
    prof_equipe: b => [{ teacher: uid, nom: m.noms[uid], matiere: (classeDe(m, b.cid) || {}).matiere || '',
      principal: false, moi: true, createur: true }],
    prof_exclus: b => m.exclus.filter(x => x.cid === b.cid).map(x => ({ user_id: x.uid, who: nomDe(m, x.uid, store), depuis: x.depuis })),
    prof_agenda: b => m.classes.filter(c => c.owner === uid).flatMap(c => devoirsClasse(store, m, c.id, uid))
      .filter(d => d.due >= b.du && d.due <= b.au),
    prof_eleve: () => [],
    prof_cartes: () => [],
    prof_assignment_cards: b => (m.devoirs.find(d => d.id === b.aid) || {}).cartes || [],
    prof_admettre: b => admettre(m, b),
    prof_refuser: b => refuser(m, b),
    prof_retirer: b => retirer(m, b),
    prof_reglages: b => reglages(m, b),
    prof_nouveau_code: b => (classeDe(m, b.cid).code = tire()),
    prof_give: b => donner(m, b, uid),
    prof_creer_eleves: b => creerEleves(store, m, b),
    prof_nouvelles_cartes: b => nouvellesCartes(store, m, b),
    prof_message_classe: b => membresDe(m, b.cid).length,
    class_preview: b => { const [s, c] = verdict(store, m, b.join_code, uid); return fiche(store, m, s, c); },
    /* Un code d'établissement ou de professeur (faux-etablissement.js), sinon
       l'ancien code d'une classe : la même réponse qu'en base. */
    code_apercu: b => {
      const r = fonctionsEtab(store, m, uid).code_apercu(b);
      if (r) return r;
      const [s, c] = verdict(store, m, b.code, uid);
      return { type: 'classe', fiche: fiche(store, m, s, c)[0] };
    },
    class_join: b => rejoindre(store, m, b, uid),
    eleve_classes: () => eleveClasses(store, m, uid),
    eleve_devoirs: () => eleveDevoirs(store, m, uid),
    eleve_classe: b => eleveClasse(store, m, uid, b.cid),
    eleve_ouvrir_devoir: b => {
      const d = m.devoirs.find(x => x.id === b.aid);
      if (!d) return [];
      d.ouverts.add(uid);
      return [{ nom: d.nom, matiere: d.matiere, cartes: d.cartes }];
    },
    eleve_annuler: b => { m.demandes = m.demandes.filter(x => !(x.cid === b.cid && x.uid === uid)); return null; },
    eleve_quitter: b => { m.membres = m.membres.filter(x => !(x.cid === b.cid && x.uid === uid)); return null; }
  };
}

/* Rend [statut, corps] pour une fonction connue, `null` sinon. */
export function rpcClasses(store, nom, corps, user) {
  const m = modele(store);
  const f = fonctions(store, m, user.id)[nom] || fonctionsEtab(store, m, user.id)[nom];
  if (!f) return null;
  /* Première requête authentifiée de la journée : l'élève « s'est connecté ». */
  for (const x of m.membres) if (x.uid === user.id && !x.vu) x.vu = new Date().toISOString();
  /* Une exception de la base revient en 400 avec son message, que l'app
     montre tel quel (« Cette classe compte encore 28 élèves… »). */
  try { return [200, f(corps || {})]; } catch (e) { return [400, { code: 'P0001', message: e.message }]; }
}
