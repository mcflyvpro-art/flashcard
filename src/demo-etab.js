/* ══════════ la démo sans compte : un lycée fictif (2026-10-26) ══════════
   Un visiteur essaie Folio comme élève, professeur ou référent, sans compte
   et sans rien écrire nulle part (docs/PARCOURS.md, § 4.1). L'app tourne
   comme d'habitude ; seules ses demandes à la base sont servies ici, par
   `reponseDemo(role, fonction, arguments)` : les lectures reçoivent le
   « Lycée Démo Folio », une écriture rend `undefined` (l'écran dit alors
   que rien n'est enregistré). Pur, testé dans test/demo-etab.test.js ;
   branché par ui/demo.js. Les formes rendues sont celles des vraies
   fonctions (voir aussi les faux de e2e/, qui les rejouent pour les tests). */
import { dansJours, iso } from './classe.js';

export const ETAB = { id: 'demo-org', nom: 'Lycée Démo Folio', ville: 'Nîmes', kind: 'lycee',
  codeEleves: 'DEMXPK47', codeProfs: 'PRFQWT58' };
export const ROLES_DEMO = { eleve: 'demo-eleve', prof: 'demo-prof', ref: 'demo-ref' };

const ANNEE = '2026-2027';
const CLASSES = [
  { id: 'demo-2a', name: '2nde A', niveau: '2nde', genre: 'classe' },
  { id: 'demo-2b', name: '2nde B', niveau: '2nde', genre: 'classe' },
  { id: 'demo-1b', name: '1re B', niveau: '1re', genre: 'classe' },
  { id: 'demo-tc', name: 'Tle C', niveau: 'Tle', genre: 'classe' },
  { id: 'demo-spe', name: 'Spé maths', niveau: '', genre: 'groupe' }
];
const PROFS = [
  { id: 'demo-prof', nom: 'Marc DURAND', matiere: 'Mathématiques' },
  { id: 'demo-p2', nom: 'Sophie LAMBERT', matiere: 'Anglais' },
  { id: 'demo-p3', nom: 'Karim BENALI', matiere: 'Histoire-géo' }
];
// [classe, matière, prof, principal]
const SERVICES = [['demo-2b', 'Mathématiques', 'demo-prof', true], ['demo-1b', 'Mathématiques', 'demo-prof', false],
  ['demo-spe', 'Mathématiques', 'demo-prof', true], ['demo-2b', 'Anglais', 'demo-p2', false], ['demo-2a', 'Anglais', 'demo-p2', true],
  ['demo-2b', 'Histoire-géo', 'demo-p3', false], ['demo-tc', 'Histoire-géo', 'demo-p3', true]];
const NOMS = ['Léa MARTIN', 'Hugo PETIT', 'Inès MOREAU', 'Nathan LEROY', 'Chloé GIRARD', 'Lucas FAURE', 'Emma BLANC',
  'Adam ROUSSEL', 'Jade FONTAINE', 'Louis MERCIER', 'Manon CHEVALIER', 'Gabriel GARNIER', 'Zoé LAMBERT', 'Raphaël FAURE',
  'Lina BONNET', 'Arthur DUPUIS', 'Camille ROGER', 'Noah MOREL', 'Sarah HENRY', 'Tom NICOLAS'];
const CLASSE_DE = i => ['demo-2b', 'demo-2a', 'demo-1b', 'demo-tc'][i < 8 ? 0 : i % 4];
export const ELEVES = NOMS.map((nom, i) => ({ id: i === 0 ? 'demo-eleve' : 'demo-e' + i, nom, classe: CLASSE_DE(i),
  vu: i % 5 !== 3, pct: [92, 76, 58, 0, 81, 67, 88, 44][i % 8], spe: [0, 2, 4, 6, 9].includes(i) }));

// les devoirs, avec de vraies pages : l'élève de la démo peut les lire
const DEVOIRS = [
  { id: 'demo-d1', cid: 'demo-2b', nom: 'Fonctions affines', matiere: 'Mathématiques', auteur: 'demo-prof', due: 2,
    cartes: [['f(x) = 3x − 2 : coefficient directeur ?', '3'], ['f(x) = 3x − 2 : ordonnée à l’origine ?', '−2'],
      ['Une fonction affine est représentée par…', 'une droite'], ['f(x) = ax + b avec a > 0 : la fonction est…', 'croissante'],
      ['Antécédent de 7 par f(x) = 2x + 1 ?', '3']] },
  { id: 'demo-d2', cid: 'demo-2b', nom: 'Irregular verbs — série 1', matiere: 'Anglais', auteur: 'demo-p2', due: 5,
    cartes: [['to go', 'went — gone'], ['to take', 'took — taken'], ['to see', 'saw — seen'], ['to bring', 'brought — brought'],
      ['to think', 'thought — thought'], ['to write', 'wrote — written']] },
  { id: 'demo-d3', cid: 'demo-1b', nom: 'Second degré', matiere: 'Mathématiques', auteur: 'demo-prof', due: 9,
    cartes: [['Discriminant de ax² + bx + c', 'b² − 4ac'], ['Δ < 0 : combien de racines réelles ?', 'aucune']] },
  { id: 'demo-d4', cid: 'demo-spe', nom: 'Suites arithmétiques', matiere: 'Mathématiques', auteur: 'demo-prof', due: -1,
    cartes: [['uₙ₊₁ = uₙ + r : r s’appelle…', 'la raison'], ['uₙ = u₀ + …', 'n·r']] }
];

const nomProf = id => (PROFS.find(p => p.id === id) || {}).nom || '';
const membres = cid => (cid === 'demo-spe' ? ELEVES.filter(e => e.spe) : ELEVES.filter(e => e.classe === cid));
const classe = cid => CLASSES.find(c => c.id === cid);
const devoirsDe = cid => DEVOIRS.filter(d => d.cid === cid);
const sans = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* L'avancement d'un élève sur un devoir, inventé mais stable. */
const rendu = (e, d) => e.vu && (e.pct >= 60 || d.due < 0);

function ligneDevoir(d, auj) {
  const m = membres(d.cid);
  return { id: d.id, nom: d.nom, matiere: d.matiere, n: d.cartes.length, due: dansJours(d.due, auj), donne: iso(auj),
    mien: d.auteur === 'demo-prof', auteur: nomProf(d.auteur), effectif: m.length, ouvert: m.filter(e => e.vu).length,
    rendu: m.filter(e => rendu(e, d)).length, pct: 72, class_id: d.cid, classe: classe(d.cid).name };
}

function ligneClassePourProf(c, auj) {
  const sv = SERVICES.filter(s => s[0] === c.id && s[2] === 'demo-prof'), m = membres(c.id), ds = devoirsDe(c.id);
  const dernier = ds.filter(d => d.auteur === 'demo-prof').slice(-1)[0];
  return { id: c.id, name: c.name, niveau: c.niveau, cycle: 'lycee_gt', filiere: '', annee_scolaire: ANNEE, code: '',
    matiere: sv.map(s => s[1]).join(' · ') || null, principal: sv.some(s => s[3]), effectif: m.length,
    devoirs: ds.length, encours: ds.filter(d => d.due >= 0).length, retard: m.filter(e => !e.vu).length,
    pas_ouvert: m.filter(e => !e.vu).length, jamais: m.filter(e => !e.vu).length, actifs7: m.filter(e => e.vu).length,
    pct: 74, dernier: dernier ? dernier.nom : null, dernier_due: dernier ? dansJours(dernier.due, auj) : null,
    gere: c.genre === 'groupe' || sv.some(s => s[3]), createur: c.genre === 'groupe', etab: true, attente: 0,
    archivee: false, ouvert: false, validation: false, places: 40, fin: null, code_collegue: null, fin_collegue: null, genre: c.genre };
}

function roster(cid, auj) {
  const ds = devoirsDe(cid);
  return membres(cid).map((e, i) => ({ user_id: e.id, who: e.nom, handle: '', rendus: ds.filter(d => rendu(e, d)).length,
    donnes: ds.length, pct: e.vu ? e.pct : 0, vu: e.vu ? new Date(auj.getTime() - (i + 1) * 3600e3).toISOString() : null,
    jamais: !e.vu, pages7: e.vu ? 20 + i * 7 : 0, jours7: e.vu ? 1 + (i % 6) : 0, retard: e.vu ? 0 : ds.filter(d => d.due < 0).length,
    inscrit: iso(auj), carte: false, identifiant: null }));
}

const personne = (e, auj) => ({ id: e.id, email: '', handle: null, name: e.nom, role: 'eleve', classe: classe(e.classe).name,
  class_id: e.classe, matiere: null, derniere: e.vu ? auj.toISOString() : null, jamais: !e.vu, carte: false });
const personneProf = (p, auj) => ({ id: p.id, email: '', handle: null, name: p.nom, role: 'prof', classe: null, class_id: null,
  matiere: p.matiere, derniere: auj.toISOString(), jamais: false, carte: false });

function personnes(a, auj) {
  const q = sans(a.q);
  const l = [...ELEVES.map(e => personne(e, auj)), ...PROFS.map(p => personneProf(p, auj))]
    .filter(g => (!a.qrole || g.role === a.qrole) && (!a.sans_classe)
      && (!a.qclass || (a.qclass === 'demo-spe' ? ELEVES.some(e => e.id === g.id && e.spe) : g.class_id === a.qclass))
      && (!q || sans(g.name).includes(q)))
    .sort((x, y) => x.role.localeCompare(y.role) || x.name.localeCompare(y.name, 'fr'));
  const off = +a.off || 0, lim = +a.lim || 60;
  return l.slice(off, off + lim).map(g => ({ ...g, total: l.length }));
}

/* Les lectures, par fonction. `role` : celui qu'essaie le visiteur. */
function lectures(role, auj) {
  const moi = ROLES_DEMO[role];
  const mesClasses = ['demo-2b', 'demo-spe'];
  return {
    my_role: () => role,
    my_school: () => [{ org_id: ETAB.id, org: ETAB.nom, org_kind: ETAB.kind, ville: ETAB.ville,
      class_id: role === 'eleve' ? 'demo-2b' : null, classe: role === 'eleve' ? '2nde B' : null, niveau: role === 'eleve' ? '2nde' : null,
      filiere: null, cycle: null, effectif: membres('demo-2b').length, role }],
    mon_compte: () => [{ gere: false, nom: role === 'eleve' ? 'Léa MARTIN' : role === 'prof' ? 'Marc DURAND' : 'Claire ROUX', identifiant: null }],
    eleve_classes: () => mesClasses.map(cid => { const c = classe(cid), sv = SERVICES.filter(s => s[0] === cid);
      return { class_id: cid, nom: c.name, niveau: c.niveau, etab: ETAB.nom, prof: nomProf((sv.find(s => s[3]) || sv[0])[2]),
        matieres: [...new Set(sv.map(s => s[1]))].join(' · '), effectif: membres(cid).length, depuis: iso(auj), peut_quitter: false,
        a_faire: devoirsDe(cid).length, genre: c.genre, statut: 'inscrit' }; }),
    eleve_devoirs: () => DEVOIRS.filter(d => mesClasses.includes(d.cid)).map(d => ({ id: d.id, class_id: d.cid,
      classe: classe(d.cid).name, nom: d.nom, matiere: d.matiere, n: d.cartes.length, due: dansJours(d.due, auj), donne: iso(auj),
      etat: d.due < 0 ? 'rendu' : 'a_faire', pct: d.due < 0 ? 100 : 0, vus: d.due < 0 ? d.cartes.length : 0 })),
    eleve_classe: a => { const c = classe(a.cid); if (!c) return { statut: 'inconnue' };
      return { statut: 'inscrit', id: c.id, nom: c.name, niveau: c.niveau, etab: ETAB.nom, peut_quitter: false, depuis: iso(auj),
        eleves: membres(c.id).map(e => ({ id: e.id, nom: e.nom, pseudo: '', moi: e.id === moi, ami: '' })),
        profs: SERVICES.filter(s => s[0] === c.id).map(s => ({ id: s[2], nom: nomProf(s[2]), matiere: s[1], principal: s[3] })) }; },
    eleve_ouvrir_devoir: a => { const d = DEVOIRS.find(x => x.id === a.aid); return d ? [{ nom: d.nom, matiere: d.matiere, cartes: d.cartes }] : []; },
    prof_annees: () => [{ annee: ANNEE, classes: 3, courante: true }],
    prof_classes: () => CLASSES.filter(c => SERVICES.some(s => s[0] === c.id && s[2] === moi)).map(c => ligneClassePourProf(c, auj)),
    prof_roster: a => roster(a.cid, auj),
    prof_devoirs: a => devoirsDe(a.cid).map(d => ligneDevoir(d, auj)),
    prof_demandes: () => [], prof_exclus: () => [], prof_eleve: () => [], prof_cartes: () => [],
    prof_equipe: a => SERVICES.filter(s => s[0] === a.cid).map(s => ({ teacher: s[2], nom: nomProf(s[2]), matiere: s[1],
      principal: s[3], moi: s[2] === moi, createur: a.cid === 'demo-spe' && s[2] === moi })),
    prof_agenda: a => DEVOIRS.filter(d => d.auteur === moi).map(d => ligneDevoir(d, auj)).filter(d => d.due >= a.du && d.due <= a.au),
    prof_assignment_cards: a => (DEVOIRS.find(d => d.id === a.aid) || {}).cartes || [],
    prof_code_etab: () => ETAB.codeEleves,
    prof_classes_etab: () => CLASSES.filter(c => c.genre === 'classe').map(c => { const s = SERVICES.find(x => x[0] === c.id && x[2] === moi);
      return { id: c.id, nom: c.name, niveau: c.niveau, effectif: membres(c.id).length, enseigne: !!s, matiere: s ? s[1] : '' }; }),
    prof_eleves_etab: a => ELEVES.filter(e => (!a.cid || e.classe === a.cid) && (!a.q || sans(e.nom).includes(sans(a.q))))
      .map(e => ({ id: e.id, nom: e.nom, classe: classe(e.classe).name, classe_id: e.classe })),
    ref_codes: () => ({ eleve: ETAB.codeEleves, prof: ETAB.codeProfs, offre: 'demo', places: 300, licence_fin: dansJours(45, auj),
      eleves: ELEVES.length, profs: PROFS.length }),
    ref_dashboard: () => [{ org_id: ETAB.id, org: ETAB.nom, kind: ETAB.kind, ville: ETAB.ville, uai: '0300099X', classes: 4,
      eleves: ELEVES.length, profs: PROFS.length, refs: 1, services: SERVICES.length, devoirs: DEVOIRS.length,
      actifs7: ELEVES.filter(e => e.vu).length, jamais_venus: ELEVES.filter(e => !e.vu).length, sans_classe: 0, classes_vides: 0, sans_pp: 1 }],
    ref_classes: () => CLASSES.map(c => { const pp = SERVICES.find(s => s[0] === c.id && s[3]);
      return { id: c.id, name: c.name, niveau: c.niveau, cycle: 'lycee_gt', filiere: '', code: '', annee: ANNEE, effectif: membres(c.id).length,
        prevu: null, profs: SERVICES.filter(s => s[0] === c.id).length, pp: pp ? nomProf(pp[2]) : null, devoirs: devoirsDe(c.id).length,
        actifs7: membres(c.id).filter(e => e.vu).length, genre: c.genre }; }),
    ref_personnes: a => personnes(a, auj),
    ref_class_team: a => SERVICES.filter(s => s[0] === a.cid).map((s, i) => ({ teaching_id: 'demo-t' + i, teacher: s[2],
      nom: nomProf(s[2]), matiere: s[1], principal: s[3] })),
    ref_service: a => SERVICES.filter(s => s[2] === a.uid).map((s, i) => ({ teaching_id: 'demo-s' + i, class_id: s[0],
      classe: classe(s[0]).name, niveau: classe(s[0]).niveau, matiere: s[1], principal: s[3], effectif: membres(s[0]).length }))
  };
}

/* Ce qu'un écran demande souvent et qui n'a pas de sens ici : une liste vide, sans un mot. */
const SILENCIEUSES = /^(visuels|leaderboard|my_friends|my_classmates|mes_clubs|salles_ouvertes|salles_terminees|is_mod|profil_lecteur|find_user|journal|class_preview|code_apercu)$/;

export function reponseDemo(role, fonction, args = {}, auj = new Date()) {
  const f = lectures(role, auj)[fonction];
  if (f) return f(args || {});
  if (SILENCIEUSES.test(fonction)) return fonction === 'journal' ? null : [];
  return undefined;                    // une écriture : rien n'est enregistré
}

/* Le journal du référent (table ref_audit, lue en REST). */
export const journalDemo = (auj = new Date()) => [
  { acte: 'classe créée', cible: null, created_at: new Date(auj.getTime() - 2 * 864e5).toISOString(), detail: { nom: 'Tle C' } },
  { acte: 'élève déplacé', cible: 'demo-e5', created_at: new Date(auj.getTime() - 864e5).toISOString(), detail: { avant: '2nde A', apres: '2nde B' } },
  { acte: 'identité corrigée', cible: 'demo-e3', created_at: new Date(auj.getTime() - 3600e3).toISOString(),
    detail: { avant: { nom: 'nathan leroy' }, apres: { nom: 'Nathan LEROY' } } }
];
