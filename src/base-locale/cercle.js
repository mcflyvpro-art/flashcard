// Le cercle des lecteurs (amis, clubs, parties en direct) rejoué en mémoire
// pour les parcours de bout en bout (2026-10-24). Même contrat que
// faux-classes.js : on émule ce que l'app appelle et ce qu'elle lit en retour
// (noms de colonnes, statuts, forme de `salle_etat`), pas la sécurité — la
// RLS, les limites d'essais et le calcul exact des points se prouvent en base
// (supabase/tests/defis_direct.sql). Les points suivent la même règle : de
// 500 à 1 000 selon la vitesse, + 50 par bonne réponse d'affilée.
//
// Les clubs vivent dans les tables `groups` / `group_members` du faux
// serveur (l'app les modifie aussi par PATCH et DELETE directs) ; les salles
// dans `store.ce`. `store.lectureMs` règle les secondes de lecture avant les
// choix (3 000 en vrai ; un parcours peut le raccourcir).
import { uuid as randomUUID } from './uuid.js';
import { offreDe } from './abonnements.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tire = n => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const tab = (store, name) => (store.tables[name] = store.tables[name] || []);

function modele(store) {
  store.ce = store.ce || { salles: [], questions: {}, joueurs: [], reponses: [] };
  return store.ce;
}

const profil = (store, uid) => tab(store, 'profiles').find(p => p.id === uid) || {};
const emailDe = (store, uid) => (store.users.find(u => u.id === uid) || {}).email || '';
const nomDe = (store, uid) => {
  const p = profil(store, uid);
  return p.handle || (p.name || '').split(' ')[0] || emailDe(store, uid).split('@')[0] || 'Joueur';
};
const pagesDe = (store, uid, jours = 7) => tab(store, 'reviews')
  .filter(r => r.user_id === uid && Date.now() - Date.parse(r.created_at || 0) < jours * 864e5);

/* ---------- amis ---------- */
function mesAmis(store, uid) {
  return tab(store, 'friends').filter(f => f.user_id === uid || f.friend_id === uid).map(f => {
    const autre = f.user_id === uid ? f.friend_id : f.user_id, p = profil(store, autre);
    return { id: autre, handle: p.handle || '', name: p.name || nomDe(store, autre), status: f.status,
      sens: f.user_id === uid ? 'envoyee' : 'recue' };
  });
}

function classement(store, uid, jours) {
  const ids = [uid, ...mesAmis(store, uid).filter(f => f.status === 'ok').map(f => f.id)];
  return ids.map(id => {
    const l = pagesDe(store, id, jours > 0 ? jours : 36500);
    return { uid: id, who: profil(store, id).name || nomDe(store, id), handle: profil(store, id).handle || '',
      n: l.length, ok: l.filter(r => r.correct).length, jours: new Set(l.map(r => String(r.created_at).slice(0, 10))).size };
  }).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
}

/* ---------- clubs ---------- */
const membresDe = (store, gid) => tab(store, 'group_members').filter(m => m.group_id === gid);
const membre = (store, gid, uid) => membresDe(store, gid).some(m => m.user_id === uid);

function mesClubs(store, m, uid) {
  return tab(store, 'group_members').filter(x => x.user_id === uid).map(x => {
    const g = tab(store, 'groups').find(y => y.id === x.group_id);
    if (!g) return null;
    const mem = membresDe(store, g.id), n = id => pagesDe(store, id).length, mes = n(uid);
    const direct = m.salles.find(s => s.group_id === g.id && s.etat !== 'fini');
    return { id: g.id, nom: g.name, code: g.code, chef: g.owner === uid, embleme: g.embleme || 'livre', teinte: g.teinte || 0,
      devise: g.devise || '', membres: mem.length, pages: mem.reduce((a, y) => a + n(y.user_id), 0), mes_pages: mes,
      mon_rang: 1 + mem.filter(y => n(y.user_id) > mes).length, en_direct: direct ? direct.id : null };
  }).filter(Boolean).sort((a, b) => a.nom.localeCompare(b.nom));
}

function creerClub(store, b, uid) {
  const g = { id: randomUUID(), name: String(b.nom || '').trim(), code: tire(8), owner: uid, embleme: b.embleme || 'livre',
    teinte: +b.teinte || 0, devise: b.devise || '', created_at: new Date().toISOString() };
  tab(store, 'groups').push(g);
  tab(store, 'group_members').push({ id: randomUUID(), group_id: g.id, user_id: uid, joined_at: g.created_at });
  return [{ id: g.id, code: g.code }];
}

function rejoindreClub(store, b, uid) {
  const k = String(b.join_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const g = tab(store, 'groups').find(x => x.code === k);
  if (!g) return [];
  if (!membre(store, g.id, uid)) tab(store, 'group_members').push({ id: randomUUID(), group_id: g.id, user_id: uid, joined_at: new Date().toISOString() });
  return [{ id: g.id, name: g.name }];
}

function membresClub(store, b, uid) {
  const g = tab(store, 'groups').find(x => x.id === b.club);
  if (!g || !membre(store, g.id, uid)) return [];
  return membresDe(store, g.id).map(x => {
    const l = pagesDe(store, x.user_id);
    return { user_id: x.user_id, nom: profil(store, x.user_id).name || nomDe(store, x.user_id), pseudo: profil(store, x.user_id).handle || '',
      chef: g.owner === x.user_id, depuis: x.joined_at, pages: l.length, justes: l.filter(r => r.correct).length,
      jours: new Set(l.map(r => String(r.created_at).slice(0, 10))).size, moi: x.user_id === uid };
  }).sort((a, z) => z.pages - a.pages);
}

/* ---------- salles en direct ---------- */
const joueursDe = (m, sid) => m.joueurs.filter(j => j.salle_id === sid && !j.exclu);
const enClasse = (store, cid, uid) => !!(store.cl && store.cl.membres.some(x => x.cid === cid && x.uid === uid))
  || !!(store.cl && store.cl.classes.some(c => c.id === cid && c.owner === uid));

function ouvrir(store, m, b, uid) {
  for (const s of m.salles) if (s.hote === uid && s.etat !== 'fini') s.etat = 'fini';
  let pin;
  do pin = String(Math.floor(Math.random() * 1e6)).padStart(6, '0'); while (m.salles.some(s => s.pin === pin && s.etat !== 'fini'));
  const s = { id: randomUUID(), pin, hote: uid, hote_nom: profil(store, uid).name || nomDe(store, uid), class_id: b.classe || null,
    group_id: b.club || null, titre: b.titre, jeu: b.jeu, duree: b.duree, total: b.questions.length, etat: 'attente', rang: -1,
    debut: null, fin: null, created_at: Date.now() };
  m.salles.push(s); m.questions[s.id] = b.questions;
  return [{ id: s.id, pin }];
}

function rejoindre(store, m, b, uid) {
  const p = String(b.code || '').replace(/\D/g, '');
  if (p.length !== 6) return [{ statut: 'format', salle: null, titre: null }];
  const s = m.salles.find(x => x.pin === p && x.etat !== 'fini');
  if (!s) return [{ statut: 'inconnu', salle: null, titre: null }];
  if (s.hote === uid) return [{ statut: 'hote', salle: s.id, titre: s.titre }];
  if (s.class_id && !enClasse(store, s.class_id, uid)) return [{ statut: 'classe', salle: null, titre: null }];
  if (s.group_id && !membre(store, s.group_id, uid)) return [{ statut: 'club', salle: null, titre: null }];
  const j = m.joueurs.find(x => x.salle_id === s.id && x.user_id === uid);
  if (j && j.exclu) return [{ statut: 'exclu', salle: null, titre: null }];
  // dans une salle de classe, le nom de classe de l'élève (« Prénom NOM »), comme salle_rejoindre (20261029120000)
  const deClasse = s.class_id && store.cl && store.cl.membres.find(x => x.cid === s.class_id && x.uid === uid);
  const nom = (deClasse && (deClasse.who || profil(store, uid).name)) || nomDe(store, uid);
  if (!j) m.joueurs.push({ salle_id: s.id, user_id: uid, nom, score: 0, serie: 0, justes: 0, exclu: false,
    vu_rang: null, vu_at: null, joined_at: Date.now() });
  return [{ statut: 'ok', salle: s.id, titre: s.titre }];
}

const iso = t => (t == null ? null : new Date(t).toISOString());
const reponsesDe = (m, s) => m.reponses.filter(r => r.salle_id === s.id && r.rang === s.rang);
const top = (m, s, uid, n) => joueursDe(m, s.id).slice().sort((a, b) => b.score - a.score || a.joined_at - b.joined_at)
  .slice(0, n).map(j => ({ nom: j.nom, score: j.score, justes: j.justes, moi: j.user_id === uid }));

function avancerSeul(m, s) {
  if (s.etat === 'question' && (Date.now() > s.fin || (joueursDe(m, s.id).length && reponsesDe(m, s).length >= joueursDe(m, s.id).length))) {
    s.etat = 'correction';
  }
}

function correction(m, s, q) {
  const n = s.jeu === 'qcm' ? q.c.length : s.jeu === 'vf' ? 2 : 0, rs = reponsesDe(m, s);
  return { bonne: q.b, reponse: q.r, repartition: Array.from({ length: n }, (_, k) => rs.filter(r => r.choix === k).length),
    justes: rs.filter(r => r.juste).length };
}

function etat(store, m, b, uid) {
  const s = m.salles.find(x => x.id === b.salle);
  if (!s) return { etat: 'absent' };
  const hote = s.hote === uid, j = m.joueurs.find(x => x.salle_id === s.id && x.user_id === uid);
  if (!hote && (!j || j.exclu)) return { etat: j && j.exclu ? 'exclu' : 'absent' };
  avancerSeul(m, s);
  const visibles = s.etat === 'correction' || (s.etat === 'question' && Date.now() >= s.debut);
  if (j && s.etat === 'question' && visibles && j.vu_rang !== s.rang) { j.vu_rang = s.rang; j.vu_at = Date.now(); }
  const q = (m.questions[s.id] || [])[s.rang];
  const res = { id: s.id, etat: s.etat, rang: s.rang, total: s.total, titre: s.titre, jeu: s.jeu, duree: s.duree, pin: s.pin, hote,
    hote_nom: s.hote_nom, debut: iso(s.debut), fin: iso(s.fin), maintenant: new Date().toISOString(),
    joueurs: joueursDe(m, s.id).length, repondu: reponsesDe(m, s).length,
    classe: s.class_id && store.cl ? (store.cl.classes.find(c => c.id === s.class_id) || {}).name || null : null,
    club: s.group_id ? (tab(store, 'groups').find(g => g.id === s.group_id) || {}).name || null : null };
  if (q && (s.etat === 'question' || s.etat === 'correction')) res.question = { enonce: q.e, choix: visibles || hote ? q.c || [] : [] };
  if (q && s.etat === 'correction') res.correction = correction(m, s, q);
  if (s.etat === 'correction' || s.etat === 'fini') res.top = top(m, s, uid, s.etat === 'fini' ? 100 : 5);
  if (s.etat === 'attente') res.liste = joueursDe(m, s.id).map(x => hote ? { id: x.user_id, nom: x.nom } : { nom: x.nom, moi: x.user_id === uid });
  if (j && !j.exclu) {
    const d = m.reponses.find(r => r.salle_id === s.id && r.rang === s.rang && r.user_id === uid);
    res.moi = { nom: j.nom, score: j.score, serie: j.serie, justes: j.justes,
      place: 1 + joueursDe(m, s.id).filter(x => x.score > j.score).length, repondu: !!d,
      derniere: s.etat === 'correction' && d ? { juste: d.juste, points: d.points, choix: d.choix } : null };
  }
  return res;
}

function repondre(m, b, uid) {
  const s = m.salles.find(x => x.id === b.salle);
  const j = s && m.joueurs.find(x => x.salle_id === s.id && x.user_id === uid);
  if (!s || !j || j.exclu) return 'absent';
  if (s.etat !== 'question' || s.rang !== b.rang || Date.now() < s.debut || Date.now() > s.fin + 1500) return 'ferme';
  if (m.reponses.some(r => r.salle_id === s.id && r.rang === s.rang && r.user_id === uid)) return 'deja';
  const q = m.questions[s.id][s.rang];
  const juste = s.jeu === 'ecrit' ? (q.a || []).includes(b.texte) : b.choix === q.b;
  const ms = Math.max(0, Math.min(s.duree * 1000, Date.now() - (j.vu_rang === s.rang && j.vu_at ? j.vu_at : s.debut)));
  const prec = m.reponses.find(r => r.salle_id === s.id && r.rang === s.rang - 1 && r.user_id === uid && r.juste);
  const serie = !juste ? 0 : prec ? j.serie + 1 : 1;
  const points = juste ? Math.round(1000 * (1 - ms / (s.duree * 1000) / 2)) + Math.min(Math.max(serie - 1, 0), 5) * 50 : 0;
  m.reponses.push({ salle_id: s.id, rang: s.rang, user_id: uid, choix: s.jeu === 'ecrit' ? null : b.choix, juste, points, ms });
  j.score += points; j.serie = serie; j.justes += juste ? 1 : 0;
  avancerSeul(m, s);
  return 'ok';
}

function avancer(store, m, b, uid) {
  const s = m.salles.find(x => x.id === b.salle);
  if (!s || s.hote !== uid) return [403, { message: 'Cette salle n’est pas la tienne' }];
  if (s.etat !== b.depuis || s.rang !== b.rang_vu) return s.etat;
  const lecture = store.lectureMs == null ? 3000 : store.lectureMs;
  const question = r => { s.etat = 'question'; s.rang = r; s.debut = Date.now() + lecture; s.fin = s.debut + s.duree * 1000; return 'question'; };
  if (s.etat === 'attente') return joueursDe(m, s.id).length ? question(0) : 'vide';
  if (s.etat === 'question') { s.etat = 'correction'; return 'correction'; }
  if (s.etat === 'correction') { if (s.rang + 1 >= s.total) { s.etat = 'fini'; s.fini_at = Date.now(); return 'fini'; } return question(s.rang + 1); }
  return s.etat;
}

function ouvertes(store, m, uid) {
  return m.salles.filter(s => s.etat !== 'fini' && !m.joueurs.some(j => j.salle_id === s.id && j.user_id === uid && j.exclu)
    && (s.hote === uid || m.joueurs.some(j => j.salle_id === s.id && j.user_id === uid)
      || (s.class_id && enClasse(store, s.class_id, uid)) || (s.group_id && membre(store, s.group_id, uid))))
    .map(s => ({ id: s.id, pin: s.pin, titre: s.titre, jeu: s.jeu, hote_nom: s.hote_nom, etat: s.etat, joueurs: joueursDe(m, s.id).length,
      classe: s.class_id && store.cl ? (store.cl.classes.find(c => c.id === s.class_id) || {}).name || null : null,
      club: s.group_id ? (tab(store, 'groups').find(g => g.id === s.group_id) || {}).name || null : null,
      class_id: s.class_id, group_id: s.group_id, dedans: m.joueurs.some(j => j.salle_id === s.id && j.user_id === uid && !j.exclu),
      hote: s.hote === uid, created_at: iso(s.created_at) }));
}

function terminees(store, m, b, uid) {
  return m.salles.filter(s => s.etat === 'fini' && s.rang >= 0 && ((b.club && s.group_id === b.club) || (b.classe && s.class_id === b.classe)))
    .map(s => {
      const t = top(m, s, uid, 100), moi = t.findIndex(x => x.moi);
      return { id: s.id, titre: s.titre, jeu: s.jeu, hote_nom: s.hote_nom, fini_at: iso(s.fini_at), joueurs: t.length,
        podium: t.slice(0, 3).map(x => ({ nom: x.nom, score: x.score })), moi: moi < 0 ? null : { score: t[moi].score, place: moi + 1 } };
    });
}

/* ---------- le profil d'un lecteur (20261025200000) ----------
   Les mêmes trois statuts qu'en base : complet pour soi, un ami ou un membre
   d'un même club, réduit pour une demande en attente, « inconnu » sinon. Les
   chiffres exacts (fuseau, séries) se prouvent dans supabase/tests/profil.sql. */
const jourDe = t => new Date(t).toISOString().slice(0, 10);
function serieEtRecord(jours) {
  let serie = 0, record = 0, cours = 0;
  for (let i = 0; i < jours.length; i++) { cours = jours[i] ? cours + 1 : 0; record = Math.max(record, cours); }
  for (let i = jours.length - (jours[jours.length - 1] ? 1 : 2); i >= 0 && jours[i]; i--) serie++;
  return { serie, record };
}
function profilDe(store, moi, u) {
  const p = profil(store, u);
  const lien = tab(store, 'friends').find(f => (f.user_id === moi && f.friend_id === u) || (f.user_id === u && f.friend_id === moi));
  const ami = !!lien && lien.status === 'ok';
  const clubs = tab(store, 'groups').filter(g => u !== moi && membre(store, g.id, moi) && membre(store, g.id, u));
  const complet = u === moi || ami || clubs.length > 0;
  if (!complet && !lien) return { statut: 'inconnu' };
  const base = { statut: complet ? 'ok' : 'prive', moi: u === moi, nom: p.name || nomDe(store, u), pseudo: p.handle || '',
    depuis: '2026-09-01', ami, clubs: clubs.map(g => ({ id: g.id, nom: g.name, embleme: g.embleme, teinte: g.teinte })) };
  if (!complet) return base;
  const l = tab(store, 'reviews').filter(r => r.user_id === u), age = r => Date.now() - Date.parse(r.created_at || 0);
  const jours = Array.from({ length: 35 }, (_, i) => {
    const d = jourDe(Date.now() - (34 - i) * 864e5);
    return l.filter(r => jourDe(r.created_at) === d).length;
  });
  const mois = l.filter(r => age(r) < 30 * 864e5), noms = {};
  for (const r of l) if (r.subject_name) noms[r.subject_name] = (noms[r.subject_name] || 0) + 1;
  return { ...base, ...serieEtRecord(jours), jours, toujours: l.length, mois: mois.length,
    semaine: l.filter(r => age(r) < 7 * 864e5).length,
    justes: mois.length ? Math.round(100 * mois.filter(r => r.correct).length / mois.length) : null,
    matieres: Object.entries(noms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nom, n]) => ({ nom, n })),
    heure: l.length ? new Date(l[0].created_at).getHours() : null, livres: new Set(mois.map(r => r.deck_id)).size };
}

/* Rend [statut, corps] pour une fonction connue, `null` sinon. */
export function rpcCercle(store, nom, b, user) {
  const m = modele(store), uid = user.id, c = b || {};
  const f = {
    my_friends: () => mesAmis(store, uid),
    profil_lecteur: () => profilDe(store, uid, c.u),
    leaderboard: () => classement(store, uid, c.days),
    mes_clubs: () => mesClubs(store, m, uid),
    club_creer: () => creerClub(store, c, uid),
    join_group: () => rejoindreClub(store, c, uid),
    club_membres: () => membresClub(store, c, uid),
    club_nouveau_code: () => { const g = tab(store, 'groups').find(x => x.id === c.club && x.owner === uid); if (g) g.code = tire(8); return g ? g.code : null; },
    salle_ouvrir: () => ouvrir(store, m, c, uid),
    salle_rejoindre: () => rejoindre(store, m, c, uid),
    salle_etat: () => etat(store, m, c, uid),
    salle_repondre: () => repondre(m, c, uid),
    salle_avancer: () => avancer(store, m, c, uid),
    salle_exclure: () => { const s = m.salles.find(x => x.id === c.salle && x.hote === uid); const j = s && m.joueurs.find(x => x.salle_id === s.id && x.user_id === c.joueur); if (j) j.exclu = true; return null; },
    salle_fermer: () => { const s = m.salles.find(x => x.id === c.salle && x.hote === uid); if (s) s.etat = 'fini'; return null; },
    salles_ouvertes: () => ouvertes(store, m, uid),
    salles_terminees: () => terminees(store, m, c, uid),
    // les jetons (20261025111500) : sans contrôle de qui voit qui, prouvé en base (supabase/tests/jetons.sql)
    visuels: () => [
      ...(c.personnes || []).map(id => ({ id, genre: 'p', ...(store.jetons || {})['p:' + id] })),
      ...(c.classes || []).map(id => ({ id, genre: 'c', ...(store.jetons || {})['c:' + id] }))
    ].map(r => ({ id: r.id, genre: r.genre, cle: r.cle || null, teinte: r.teinte == null ? null : r.teinte,
      plus: r.genre === 'p' && offreDe(store, r.id) === 'plus' })),
    mon_jeton: () => { (store.jetons = store.jetons || {})['p:' + uid] = { cle: c.cle, teinte: c.rang }; return null; },
    prof_jeton_classe: () => { (store.jetons = store.jetons || {})['c:' + c.cid] = { cle: c.cle, teinte: c.rang }; return null; }
  }[nom];
  if (!f) return null;
  const r = f();
  return Array.isArray(r) && r.length === 2 && typeof r[0] === 'number' ? r : [200, r];
}

/* ---------- semer ---------- */
export function semerJeton(store, email, cle, teinte) {
  (store.jetons = store.jetons || {})['p:' + uidDe(store, email)] = { cle, teinte };
}

const uidDe = (store, email) => store.users.find(u => u.email === email).id;

export function semerPseudo(store, email, handle, name) {
  const id = uidDe(store, email), t = tab(store, 'profiles'), p = t.find(x => x.id === id);
  if (p) Object.assign(p, { handle, name: name || p.name }); else t.push({ id, email, handle, name: name || null });
}

export function semerAmis(store, emailA, emailB, status = 'ok') {
  tab(store, 'friends').push({ id: randomUUID(), user_id: uidDe(store, emailA), friend_id: uidDe(store, emailB), status });
}

/* Des pages lues cette semaine, pour que les classements aient de quoi classer. */
export function semerLectures(store, email, n, justes = n) {
  const id = uidDe(store, email);
  for (let k = 0; k < n; k++) tab(store, 'reviews').push({ id: randomUUID(), user_id: id, card_id: 'x' + k, deck_id: 'd',
    correct: k < justes, created_at: new Date(Date.now() - (k % 5) * 864e5 / 2).toISOString() });
}

export function semerClub(store, emailChef, nom, membres = [], o = {}) {
  const chef = uidDe(store, emailChef);
  const [{ id, code }] = creerClub(store, { nom, embleme: o.embleme || 'chouette', teinte: o.teinte || 0, devise: o.devise || '' }, chef);
  for (const e of membres) tab(store, 'group_members').push({ id: randomUUID(), group_id: id, user_id: uidDe(store, e), joined_at: new Date().toISOString() });
  return { id, code };
}

/* Un compte de plus, sans passer par l'écran d'inscription. */
export function semerCompte(store, email, mdp = 'motdepasse-solide-42') {
  const id = randomUUID();
  store.users.push({ id, email, password: mdp });
  return id;
}
