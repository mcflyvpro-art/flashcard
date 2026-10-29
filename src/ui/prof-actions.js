// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { shuffle } from '../file.js';
import { auth, me, menu, online, prefs, prof, setAnimate, view, visuels } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { plain } from './carte-media.js';
import {
  codeComplet, codeDepuisTexte, dansJours, etatInscriptions, formatCode, iso, lienRejoindre, messageStatut,
  nomPropre, normCode
} from '../classe.js';
import { deck, plur } from '../core/coeur-sync.js';
import { DUELQ } from '../core/defis.js';
import {
  agendaPull, attentePull, cartesBloquePull, cartesDuDevoir, classePull, codeCollegue, codePull, defiClasse, demandesPull, ecrire,
  exclusPull, fichePull, profPull, relire, repeindre, semainePull
} from '../core/espace-prof.js';
import { messageErreur } from '../core/eleve-classes.js';
import { sendMotProf } from '../core/menus-c.js';
import { toast } from './import-cartes.js';
import { closeMenu, openMenu, paintMenu } from './menus-a.js';
import { classeOuverte } from './prof-accueil.js';
import { baseApp, devoirOuvert, listeLivres } from './prof-feuilles.js';
import { resetComp } from './creation.js';
import { actionsEtab, chercherEleves, majBoutonGroupe } from './prof-etab.js';
import { ouvrirDefi } from './defi-nouveau.js';
import { choisirJetonClasse, surVisuels } from '../core/visuels.js';
import { emblemeDe, rangCouleur } from '../jeton.js';

/* ══════════ ce que font les boutons de l'espace professeur ══════════
   Chaque bouton porte `data-pf="action"` (et `data-id`, `data-v`) ; un seul
   écouteur, sur le document, sert la page et les feuilles. Les autres
   gestionnaires de l'app (interactions.js, menus-c.js) ne reconnaissent
   aucun de ces attributs et laissent passer. */

/* ---------- aller quelque part ---------- */
export function allerAccueil() {
  if (!prof.classes) profPull();
  if (!prof.semaine) semainePull();
  go('prof');
}

export function ouvrirClasse(id, tab) {
  if (!prof.classes) profPull();       // ouverte par son adresse, sans passer par l'accueil
  if (prof.open !== id) {
    prof.roster = null; prof.devoirs = null; prof.demandes = null; prof.equipe = null; prof.exclus = null;
    prof.sel = new Set(); prof.q = ''; prof.filtre = 'tous'; prof.vue = 'liste'; prof.mois = null;
  }
  prof.open = id; prof.tab = tab || 'eleves'; prof.f = {};
  classePull(id);
  if (prof.tab === 'reglages') exclusPull(id);
  go('profclasse');
}

export function ouvrirAgenda(mois) {
  if (!prof.classes) profPull();
  prof.mois = mois || prof.mois || iso(new Date());
  const d = new Date(+prof.mois.slice(0, 4), +prof.mois.slice(5, 7) - 1, 1, 12);
  const du = iso(new Date(d.getFullYear(), d.getMonth(), 1 - 7, 12));
  const au = iso(new Date(d.getFullYear(), d.getMonth() + 1, 7, 12));
  prof.agenda = null; agendaPull(du, au);
  if (view.name !== 'profagenda') go('profagenda'); else { setAnimate(false); render(); }
}

export function ouvrir(f, init) {
  prof.feuille = f; prof.f = init || {};
  openMenu('pf');
}

/* Deux temps pour ce qui ne se défait pas : le premier appui arme le
   bouton, le second (dans les trois secondes) agit. */
function arme(b, texte) {
  if (b.dataset.arme) return true;
  b.dataset.arme = '1';
  const lab = b.querySelector('span'), avant = lab ? lab.textContent : '';
  b.classList.add('arme');
  if (lab) lab.textContent = texte || 'Confirmer ?';
  setTimeout(() => {
    if (!b.isConnected) return;
    delete b.dataset.arme; b.classList.remove('arme'); if (lab) lab.textContent = avant;
  }, 3000);
  return false;
}

async function copier(t, quoi) {
  try { await navigator.clipboard.writeText(t); toast(I.check, quoi + ' copié'); }
  catch (e) { toast(I.x, 'Copie impossible : sélectionnez-le à la main'); }
}

/* ---------- la classe ---------- */
const cid = () => prof.open;

async function reglages(changer) {
  const c = classeOuverte(); if (!c) return;
  const v = { ouvert: c.ouvert, validation: c.validation, nb_places: c.places, minutes: -1, ...changer };
  const r = await ecrire('prof_reglages', { cid: c.id, ...v });
  if (r) {
    Object.assign(c, { ouvert: v.ouvert, validation: v.validation, places: v.nb_places });
    if (v.minutes >= 0) c.fin = v.minutes ? new Date(Date.now() + v.minutes * 60000).toISOString() : null;
    toast(I.check, etatInscriptions(c).t);
  }
  relire(); repeindre(true);
}

async function admettre(ids) {
  const n = await ecrire('prof_admettre', { cid: cid(), qui: ids });
  if (n !== null) {
    const reste = ids.length - (+n || 0);
    toast(I.check, `${plur(+n || 0, 'élève')} accepté${(+n || 0) > 1 ? 's' : ''}${reste > 0 ? ` · ${reste} en attente (plus de place)` : ''}`);
  }
  relire();
}

async function refuser(ids, bloquer) {
  if (await ecrire('prof_refuser', { cid: cid(), qui: ids, exclure: !!bloquer },
    bloquer ? 'Refusé et bloqué : la place vous revient' : 'Refusé : la place vous revient')) relire();
}

async function retirerGo() {
  const ids = prof.f.qui || [], choix = prof.f.choix || 'retirer';
  let ok = 0;
  for (const qui of ids) {
    if (await ecrire('prof_retirer', { cid: cid(), qui, exclure: choix === 'exclure' })) ok++;
  }
  if (ok) toast(I.check, `${plur(ok, 'élève')} retiré${ok > 1 ? 's' : ''}`);
  prof.sel = new Set(); closeMenu(); relire();
}

async function messageGo() {
  const t = String(prof.f.msg || '').trim();
  if (!t) return toast(I.x, 'Écrivez d’abord le message');
  if (prof.f.qui) {
    let ok = 0;
    for (const qui of prof.f.qui) {
      try { await sendMotProf(qui, t); ok++; } catch (e) { /* compté ci-dessous : le toast dit combien sont partis */ }
    }
    toast(ok ? I.check : I.x, ok ? `Message envoyé à ${plur(ok, 'élève')}` : 'Envoi impossible');
  } else {
    const n = await ecrire('prof_message_classe', { cid: cid(), mot: t });
    if (n === null) return;
    toast(I.check, `Message envoyé à ${plur(+n || 0, 'élève')}`);
  }
  prof.sel = new Set(); closeMenu(); repeindre();
}

/* ---------- rejoindre l'équipe d'une classe ---------- */
/* Depuis un lien « ?rejoindre= » ouvert par un professeur (eleve-classes.js). */
export function rejoindreCollegue(code) {
  allerAccueil();
  ouvrir('rejoindre', { code: formatCode(code) });
  voirCollegue();
}

async function voirCollegue() {
  const k = normCode(prof.f.code);
  if (!codeComplet(k)) return;
  if (!online) return toast(I.cloud, 'Hors ligne : réessaie une fois connecté');
  try {
    const r = await codeCollegue(k, false);
    prof.f.apercu = r && r.statut === 'apercu' ? r : null;
    prof.f.reponse = r ? (r.statut === 'apercu' ? null : r.statut) : 'inconnu';
  } catch (e) { prof.f.reponse = 'erreur'; toast(I.x, messageErreur(e).slice(0, 140) || 'Impossible pour l’instant'); }
  if (menu === 'pf' && prof.feuille === 'rejoindre') paintMenu();
}

async function entrerCollegue() {
  const a = prof.f.apercu; if (!a) return;
  try {
    const r = await codeCollegue(normCode(prof.f.code), true);
    const s = r ? r.statut : 'inconnu';
    if (s !== 'collegue' && s !== 'deja') { prof.f.apercu = null; prof.f.reponse = s; return paintMenu(); }
    toast(I.check, messageStatut(s).titre);
    closeMenu(); prof.annees = null; await profPull();
    ouvrirClasse(a.class_id);
  } catch (e) { toast(I.x, messageErreur(e).slice(0, 140) || 'Impossible pour l’instant'); }
}

/* ---------- donner un devoir ---------- */
const carteNue = c => {
  const o = { f: plain(c.f), b: plain(c.b) };
  for (const k of ['fi', 'bi', 'fa', 'ba', 't', 'g']) if (c[k]) o[k] = c[k];
  return o;
};

function compNeuf(x) {
  const cibles = new Set(prof.open && view.name === 'profclasse' ? [prof.open] : []);
  return { nom: '', matiere: (classeOuverte() || {}).matiere || '', due: dansJours(7), cibles, ...x };
}

/* Depuis un livre de la bibliothèque — ou au retour de l'éditeur, quand le
   livre vient d'être écrit pour ce devoir (quiz.js). */
export function donnerLivre(d) {
  const cartes = d.cards.map(carteNue).filter(c => c.f || c.fi || c.fa);
  if (!cartes.length) return toast(I.x, 'Ce livre n’a aucune carte');
  prof.comp = compNeuf({ ...(prof.comp || {}), livre: d.id, nom: d.name, cartes,
    riches: cartes.filter(c => c.fi || c.bi || c.fa || c.ba).length });
  ouvrir('donner');
}

async function redonner() {
  const d = devoirOuvert(); if (!d) return;
  let brutes;
  try { brutes = await cartesDuDevoir(d.id); } catch (e) { return toast(I.x, 'Impossible pour l’instant'); }
  const cartes = brutes.map(c => (Array.isArray(c) ? { f: plain(c[0]), b: plain(c[1]) } : carteNue(c))).filter(c => c.f || c.fi || c.fa);
  if (!cartes.length) return toast(I.x, 'Ce devoir n’a plus de carte');
  prof.comp = compNeuf({ nom: d.nom, matiere: d.matiere || '', cartes, cibles: new Set() });
  ouvrir('donner');
}

async function donnerGo() {
  const k = prof.comp; if (!k) return;
  const n = await ecrire('prof_give', { cids: [...k.cibles], nom: k.nom.trim(), matiere: (k.matiere || '').trim(),
    cartes: k.cartes, due: k.due }, r => `${plur(k.cartes.length, 'carte')} à ${plur(+r || 0, 'classe')}`);
  if (!n) return;
  const premiere = [...k.cibles][0];
  prof.comp = null; closeMenu(); relire(); semainePull();
  if (view.name === 'profclasse') { prof.tab = 'devoirs'; repeindre(); }
  else if (!/^prof/.test(view.name)) ouvrirClasse(premiere, 'devoirs');   // retour de l'éditeur de livre
}

/* Un défi de dix questions tirées du devoir, pour toute la classe. */
async function defi() {
  const d = devoirOuvert(); if (!d) return;
  const classe = d.class_id || prof.open;
  let cartes;
  try { cartes = await cartesDuDevoir(d.id); } catch (e) { return toast(I.x, 'Impossible pour l’instant'); }
  const uniq = [];
  for (const c of cartes) {
    const [f, b] = Array.isArray(c) ? c : [c.f, c.b];
    const fb = [plain(f).trim(), plain(b).trim()];
    if (fb[1] && !uniq.some(x => x[1] === fb[1])) uniq.push(fb);
  }
  if (uniq.length < 4) return toast(I.x, 'Il faut 4 réponses différentes');
  const q = shuffle(uniq.slice()).slice(0, DUELQ);
  try {
    await defiClasse({ classe, nom: d.nom, cartes: q, qui: prefs.name || (me && me.handle) || 'Professeur' });
    toast(I.bolt, 'Défi lancé · ' + plur(q.length, 'question'));
  } catch (e) { toast(I.x, 'Défi impossible'); }
}

/* ---------- la table des actions ----------
   Construite à l'appel, jamais au niveau du module (cycles d'imports, voir
   CLAUDE.md). */
function actions() {
  const c = () => classeOuverte() || {};
  return {
    accueil: allerAccueil,
    agenda: () => ouvrirAgenda(),
    relire: () => { prof.err = 0; prof.classes = null; render(); profPull(); },
    archives: () => { prof.archives = !prof.archives; repeindre(); },
    classe: id => ouvrirClasse(id),
    aller: (id, v) => {
      if (v === 'inviter') { ouvrirClasse(id); return ouvrir('inviter'); }
      if (v === 'donner') { ouvrirClasse(id); prof.comp = null; return ouvrir('donner'); }
      ouvrirClasse(id, v === 'demandes' ? 'demandes' : 'eleves');
      prof.filtre = v === 'retard' ? 'ko' : v === 'jamais' ? 'jamais' : 'tous';
      repeindre();
    },
    'aller-attente': () => { const k = (prof.classes || []).find(x => x.attente && !x.archivee); if (k) ouvrirClasse(k.id, 'demandes'); },
    mois: (id, v) => (view.name === 'profagenda' ? ouvrirAgenda(v) : (prof.mois = v, repeindre())),
    jour: (id, v) => { prof.jour = prof.jour === v ? null : v; repeindre(); },
    onglet: (id, v) => {
      prof.tab = v; prof.sel = new Set();
      if (v === 'reglages' && !prof.exclus) exclusPull(cid());
      if (v === 'demandes') demandesPull(cid()).then(neuf => { if (neuf) repeindre(); });   // sans attendre le prochain tour
      repeindre();
    },
    filtre: (id, v) => { prof.filtre = v; repeindre(); },
    'filtre-ko': () => { prof.tab = 'eleves'; prof.filtre = 'ko'; repeindre(); },
    'filtre-jamais': () => { prof.tab = 'eleves'; prof.filtre = 'jamais'; repeindre(); },
    vue: (id, v) => { prof.vue = v; repeindre(); },
    coche: id => { prof.sel.has(id) ? prof.sel.delete(id) : prof.sel.add(id); repeindre(); },
    'coche-tout': () => {
      const vis = [...$.querySelectorAll('.pf-t-eleves .pf-tr[data-id]')].filter(n => !n.hidden).map(n => n.dataset.id);
      const tous = vis.every(id => prof.sel.has(id));
      vis.forEach(id => (tous ? prof.sel.delete(id) : prof.sel.add(id)));
      repeindre();
    },
    'sel-vider': () => { prof.sel = new Set(); repeindre(); },
    'sel-message': () => ouvrir('message', { qui: [...prof.sel] }),
    'sel-retirer': () => ouvrir('retirer', { qui: [...prof.sel] }),
    eleve: id => { prof.eleve = id; prof.fiche = null; fichePull(cid(), id); ouvrir('eleve'); },
    mot: () => ouvrir('message', { qui: [prof.eleve] }),
    nommer: () => {
      const m = (prof.roster || []).find(x => x.user_id === prof.eleve) || { who: '' };
      const mots = m.who.split(' '), i = mots.findIndex(w => w.length > 1 && w === w.toUpperCase());
      ouvrir('nommer', i > 0 ? { prenom: mots.slice(0, i).join(' '), nomfam: mots.slice(i).join(' ') } : { prenom: m.who, nomfam: '' });
    },
    'nommer-go': async () => {
      if (await ecrire('prof_nommer_eleve', { cid: cid(), qui: prof.eleve, prenom: prof.f.prenom || '', nom: prof.f.nomfam || '' },
        r => 'Nom enregistré · ' + r)) { closeMenu(); relire(); }
    },
    retirer: () => ouvrir('retirer', { qui: [prof.eleve] }),
    'f-choix': (id, v) => { prof.f.choix = v; paintMenu(); },
    'retirer-go': retirerGo,
    inviter: () => ouvrir('inviter'),
    fermer: () => { closeMenu(); repeindre(); },
    tableau: () => { if (prof.code === null) codePull(); ouvrir('tableau'); },
    admettre: id => admettre([id]),
    'admettre-tout': () => admettre((prof.demandes || []).map(d => d.user_id)),
    refuser: id => refuser([id], false),
    bloquer: (id, v, b) => { if (arme(b, 'Bloquer ?')) refuser([id], true); },
    message: () => ouvrir('message'),
    'message-go': messageGo,
    actions: () => ouvrir('actions'),
    blason: () => ouvrir('blason'),
    'blason-emb': k => { const v = visuels['c:' + cid()] || {}; choisirJetonClasse(cid(), k, rangCouleur(cid(), v.teinte)); paintMenu(); },
    'blason-teinte': i => { const v = visuels['c:' + cid()] || {}; choisirJetonClasse(cid(), emblemeDe(cid(), v.cle), +i); paintMenu(); },
    reglages: () => { closeMenu(); prof.tab = 'reglages'; if (!prof.exclus) exclusPull(cid()); repeindre(); },
    'r-ouvert': () => reglages({ ouvert: !c().ouvert }),
    'r-validation': () => reglages({ validation: !c().validation }),
    'r-places': (id, v) => reglages({ nb_places: Math.min(300, Math.max(1, (c().places || 1) + (+v || 0))) }),
    'r-duree': (id, v) => reglages({ minutes: +v || 0, ouvert: true }),
    'copier-code': () => copier(c().code || '', 'Code'),
    'copier-lien': () => copier(lienRejoindre(baseApp(), c().code || ''), 'Lien'),
    'copier-collegue': () => copier(c().code_collegue || '', 'Code collègue'),
    'nouveau-code': async (id, v, b) => {
      if (!arme(b, 'L’ancien cessera de marcher')) return;
      if (await ecrire('prof_nouveau_code', { cid: cid() }, 'Nouveau code')) relire();
    },
    'collegue-on': async () => { if (await ecrire('prof_code_collegue', { cid: cid(), actif: true }, 'Code collègue valable 7 jours')) relire(); },
    'collegue-off': async () => { if (await ecrire('prof_code_collegue', { cid: cid(), actif: false }, 'Code collègue désactivé')) relire(); },
    'retirer-collegue': async (id, v, b) => { if (arme(b, '?') && await ecrire('prof_retirer_collegue', { cid: cid(), qui: id }, 'Collègue retiré')) relire(); },
    quitter: async (id, v, b) => { if (arme(b, 'Quitter vraiment ?') && await ecrire('prof_quitter', { cid: cid() }, 'Classe quittée')) { prof.open = null; prof.classes = null; allerAccueil(); } },
    reintegrer: async id => { if (await ecrire('prof_reintegrer', { cid: cid(), qui: id }, 'Exclusion levée')) exclusPull(cid()); },
    'enregistrer-classe': async () => {
      if (await ecrire('prof_modifier_classe', { cid: cid(), nom: prof.f.nom ?? c().name, niveau: prof.f.niveau ?? (c().niveau || '') }, 'Classe enregistrée')) { prof.f = {}; relire(); }
    },
    archiver: async (id, v, b) => { if (arme(b, 'Archiver ?') && await ecrire('prof_archiver', { cid: cid(), archiver: true }, 'Classe archivée')) { closeMenu(); relire(); } },
    desarchiver: async () => { if (await ecrire('prof_archiver', { cid: cid(), archiver: false }, 'Classe désarchivée')) { closeMenu(); relire(); } },
    supprimer: () => ouvrir('supprimer'),
    'supprimer-go': async () => {
      if (await ecrire('prof_supprimer_classe', { cid: cid(), confirmation: prof.f.conf || '' }, 'Classe supprimée')) {
        closeMenu(); prof.open = null; prof.classes = null; prof.annees = null; allerAccueil();
      }
    },
    creer: () => ouvrir('creer'),
    rejoindre: () => ouvrir('rejoindre', { code: '' }),
    'rejoindre-voir': () => voirCollegue(),
    'rejoindre-go': () => entrerCollegue(),
    'creer-go': async () => {
      const id = await ecrire('prof_creer_classe', { nom: prof.f.nom || '', niveau: prof.f.niveau || '', matiere: prof.f.matiere || '' }, 'Classe créée');
      if (!id || id === true) return;
      closeMenu(); prof.annees = null; await profPull();
      ouvrirClasse(id); ouvrir('inviter');
    },
    devoir: id => { prof.work = id; prof.cartes = null; prof.f = {}; cartesBloquePull(id); ouvrir('devoir'); },
    echeance: async (id, v) => {
      if (await ecrire('prof_set_due', { aid: prof.work, due: v }, 'À rendre le ' + v.split('-').reverse().slice(0, 2).join('/'))) {
        const d = devoirOuvert(); if (d) d.due = v;
        prof.semaine = null; relire(); paintMenu();
      }
    },
    'f-mois': (id, v) => { prof.f.mois = v; paintMenu(); },
    relancer: async () => { await ecrire('prof_relance', { aid: prof.work, mot: '' }, r => (r ? plur(+r, 'élève') + ' relancé' + (r > 1 ? 's' : '') : 'Personne à relancer')); },
    defi,
    redonner,
    'retirer-devoir': async (id, v, b) => {
      if (arme(b, '?') && await ecrire('prof_del_work', { aid: prof.work }, 'Devoir retiré')) { closeMenu(); prof.semaine = null; relire(); }
    },
    donner: () => { prof.comp = null; ouvrir('donner'); },
    /* Une partie en direct pour la classe ouverte (Kahoot, en classe) : l'écran
       du défi, cette classe déjà choisie ; la salle se projette ensuite. */
    direct: () => { const c = classeOuverte(); if (c) ouvrirDefi({ ou: 'classe:' + c.id, mode: 'direct', retour: { name: 'profclasse', id: c.id } }); },
    livre: id => { const d = deck(id); if (d) donnerLivre(d); },
    'livre-neuf': () => { prof.comp = compNeuf(); closeMenu(); resetComp({ cours: true, pour: 'devoir' }); go('import'); },
    cible: id => { const s = prof.comp.cibles; s.has(id) ? s.delete(id) : s.add(id); paintMenu(); },
    due: (id, v) => { prof.comp.due = v; paintMenu(); },
    'donner-go': donnerGo,
    // « un seul code » : le code à donner, choisir ses classes, former un groupe (ui/prof-etab.js)
    ...actionsEtab({ ouvrir, ouvrirClasse, arme, allerAccueil })
  };
}

/* Le blason d'une classe vient d'arriver (ou de changer) : ce qui se teinte
   à sa couleur dans l'espace se repeint, sans jamais couper une saisie. */
surVisuels(ch => { if (ch.some(k => k[0] === 'c') && /^prof/.test(view.name)) repeindre(); });

document.addEventListener('click', e => {
  const b = e.target.closest('[data-pf]');
  if (!b || b.disabled) return;
  const f = actions()[b.dataset.pf];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b.dataset.v, b);
});

/* ---------- la saisie ----------
   On écrit dans l'état sans repeindre (le curseur resterait en place mais
   la feuille clignoterait) ; seuls les morceaux qui en dépendent changent. */
/* La feuille « groupe » : la recherche se relance, le bouton suit le nom. */
function apercuGroupe(cle) {
  if (cle === 'f.gq') chercherEleves();
  if (prof.feuille === 'groupe' && cle === 'f.nom') majBoutonGroupe();
}

function apercus(cle) {
  apercuGroupe(cle);
  if (cle === 'f.conf') {
    const c = classeOuverte(), b = document.getElementById('pfsupp');
    if (b && c) b.disabled = (prof.f.conf || '').trim().toLowerCase() !== c.name.trim().toLowerCase();
  }
  if (cle === 'f.prenom' || cle === 'f.nomfam') {
    const a = document.getElementById('pfnomapercu'); if (a) a.textContent = nomPropre(prof.f.prenom || '', prof.f.nomfam || '');
  }
}

/* Le code collègue se met en forme sous les doigts ; un lien collé entier
   se réduit à son code. Changer le code oublie la classe trouvée. */
function saisieCode(n) {
  const v = formatCode(/rejoindre=/.test(n.value) ? codeDepuisTexte(n.value) : n.value);
  if (n.value !== v) n.value = v;
  const avait = prof.f.apercu || prof.f.reponse;
  prof.f.code = v; prof.f.apercu = null; prof.f.reponse = null;
  if (avait) { paintMenu(); const m = document.getElementById('pfcode'); if (m) { m.focus(); m.setSelectionRange(v.length, v.length); } return; }
  const b = document.getElementById('pfrv'); if (b) b.disabled = !codeComplet(v);
}

function filtrerSurPlace(q) {
  const v = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  $.querySelectorAll('.pf-t-eleves .pf-tr[data-nom]').forEach(n => {
    n.hidden = !!v && !n.dataset.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').includes(v);
  });
}

document.addEventListener('input', e => {
  const n = e.target.closest('[data-pfin]'); if (!n) return;
  const cle = n.dataset.pfin;
  if (n.dataset.pfcomp && prof.comp) {
    prof.comp[n.dataset.pfcomp] = n.value;
    const b = document.querySelector('[data-pf="donner-go"]');
    if (b) b.disabled = !(prof.comp.nom.trim() && (prof.comp.cartes || []).length && prof.comp.cibles.size && prof.comp.due);
    return;
  }
  if (cle === 'q') { prof.q = n.value; filtrerSurPlace(n.value); return; }
  if (cle === 'f.code') return saisieCode(n);
  if (cle.startsWith('f.')) prof.f[cle.slice(2)] = n.value;
  if (cle === 'f.cherche') { const l = document.getElementById('pflivres'); if (l) l.innerHTML = listeLivres(); }
  apercus(cle);
});

document.addEventListener('change', e => {
  const n = e.target.closest('[data-pfch]'); if (!n) return;
  const k = n.dataset.pfch;
  if (k === 'tri') { prof.tri = n.value; n.blur(); repeindre(); }
  if (k === 'annee') { prof.annee = n.value; prof.classes = null; prof.open = null; n.blur(); render(); profPull(); }
  if (k === 'gcls') { prof.f.gcls = n.value; chercherEleves(); }
  if (k === 'places') { const v = Math.round(+n.value); n.blur(); if (v >= 1 && v <= 300) reglages({ nb_places: v }); else repeindre(true); }
});

/* Le clavier : « / » cherche un élève, Entrée ouvre la ligne qui a le
   focus, et dans une feuille Entrée valide le formulaire. */
/* Entrée dans un champ de feuille : valide le formulaire, comme le bouton. */
function entreeFeuille(e) {
  const go2 = { creer: 'creer-go', nommer: 'nommer-go', groupe: 'groupe-go',
    rejoindre: prof.f.apercu ? 'rejoindre-go' : 'rejoindre-voir' }[prof.feuille];
  const b = go2 && document.querySelector(`[data-pf="${go2}"]`);
  if (b && !b.disabled) { e.preventDefault(); b.click(); }
}

document.addEventListener('keydown', e => {
  if (!/^prof/.test(view.name)) return;
  const t = e.target, champ = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if (e.key === '/' && !champ && !menu) {
    const q = document.getElementById('pfq');
    if (q) { e.preventDefault(); q.focus(); }
  } else if (e.key === 'Enter' && !champ && t.matches('[role="button"][data-pf]')) {
    e.preventDefault(); t.click();
  } else if (e.key === 'Enter' && t.tagName === 'INPUT' && menu === 'pf') entreeFeuille(e);
});

/* ---------- ce qui se relit seul ----------
   La classe, quand son code est projeté (mode tableau) : les élèves
   arrivent un par un ; la salle d'attente, si l'onglet Demandes est ouvert
   (un ancien code de classe en remplit encore).
   Et, une fois par minute, les compteurs de l'accueil. */
let tours = 0;
const projete = () => menu === 'pf' && prof.feuille === 'tableau';

/* Le code projeté : chaque élève qui le tape entre aussitôt, la liste se relit. */
async function releveTableau() {
  await classePull(prof.open);
  if (projete()) paintMenu();
}

setInterval(async () => {
  if (document.hidden || !auth || !/^prof/.test(view.name)) return;
  tours++;
  if (projete() && prof.open) return releveTableau();
  if (prof.open && view.name === 'profclasse' && prof.tab === 'demandes') {
    if (await demandesPull(prof.open)) repeindre();
    return;
  }
  if (!(await arrivees()) && view.name === 'prof' && tours % 10 === 0 && !menu) profPull();
}, 6000);

/* Un professeur particulier : ses élèves arrivent dans la salle d'attente, il
   les voit arriver (2026-10-29). */
async function arrivees() {
  const n = await attentePull();
  if (!n) return false;
  toast(I.user, n > 1 ? `${n} élèves attendent votre validation` : 'Un élève attend votre validation');
  if (prof.open) classePull(prof.open);          // l'onglet Demandes de la classe ouverte, prêt
  return true;
}
