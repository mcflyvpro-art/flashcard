/* ══════════ les règles d'une classe ══════════
   Tout ce que l'espace professeur et l'écran « Mes classes » de l'élève
   décident, sans DOM ni réseau (règle 1 de CLAUDE.md) : la forme d'un code,
   ce que veut dire un statut d'inscription, l'état d'un élève, l'ordre
   d'une liste, les chiffres d'une synthèse, les échéances. Les écrans ne
   font qu'afficher ce qui sort d'ici ; test/classe.test.js le vérifie.

   Les dates voyagent en « AAAA-MM-JJ » et ne sont jamais converties en
   Date sans heure : `new Date('2026-10-24')` est minuit UTC, donc la veille
   au soir à Los Angeles. On construit toujours une date locale à midi. */

import { norm } from './normaliser.js';

/* ---------- le code d'une classe ---------- */
// Ni 0/O ni 1/I/L : un code se recopie depuis le tableau, au fond de la salle.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 8;

export const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LONGUEUR_CODE);

export const codeComplet = s => {
  const k = normCode(s);
  return k.length === LONGUEUR_CODE && [...k].every(c => ALPHABET.includes(c));
};

/* « K7QM2XRP » se lit « K7QM-2XRP » : deux groupes de quatre se dictent et
   se recopient sans se perdre au milieu. */
export const formatCode = s => {
  const k = normCode(s);
  return k.length > 4 ? k.slice(0, 4) + '-' + k.slice(4) : k;
};

/* Un élève colle ce qu'on lui a envoyé : le code seul, ou le lien entier. */
export function codeDepuisTexte(t) {
  const s = String(t || '');
  const m = /[?&#]rejoindre=([A-Za-z0-9-]+)/.exec(s);
  return normCode(m ? m[1] : s);
}

export const lienRejoindre = (base, code) => `${String(base).replace(/[?#].*$/, '')}?rejoindre=${normCode(code)}`;

/* ---------- le nom d'un élève : Prénom NOM, rien d'autre ----------
   Même mise en forme que `nom_propre()` en base (migration
   20261024125435) : l'aperçu que voit le professeur avant de créer les
   comptes est exactement ce qui sera enregistré. */
const NOM_OK = /^\p{L}[\p{L} '’.-]{0,39}$/u;

export const nomValide = t => NOM_OK.test(String(t || '').trim());

const espaces = s => String(s || '').trim().replace(/\s+/g, ' ');

export const nomPropre = (prenom, nom) =>
  espaces(prenom).toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
  + ' ' + espaces(nom).toUpperCase();

const cleNom = s => espaces(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Un mot tout en capitales (deux lettres au moins) : c'est le nom de
   famille, comme l'écrivent Pronote et les listes d'appel. */
const enCapitales = w => /\p{L}.*\p{L}/u.test(w) && w === w.toUpperCase() && w !== w.toLowerCase();

function decoupeColonnes(cols) {
  const [a, b] = cols;
  if (enCapitales(b) && !enCapitales(a)) return { prenom: a, nom: b };
  return { prenom: b, nom: a };                  // « Nom ; Prénom », l'ordre des exports scolaires
}

function decoupeMots(mots) {
  const caps = mots.filter(enCapitales), autres = mots.filter(w => !enCapitales(w));
  if (caps.length && autres.length) return { prenom: autres.join(' '), nom: caps.join(' ') };
  return { prenom: mots.slice(0, -1).join(' '), nom: mots[mots.length - 1] };
}

const ENTETE = /^(nom|prénom|prenom|élève|eleve|élèves|eleves)\b/i;

const lisible = e => !!e && nomValide(e.prenom) && nomValide(e.nom);

/* Une ligne : deux colonnes « nom / prénom », ou un nom complet dans la
   première colonne (« MARTIN Alice ; 2nde 4 » : la suite est ignorée). */
function lireLigne(l) {
  const cols = l.split(/\t|;|,/).map(espaces).filter(Boolean);
  if (cols.length >= 2) {
    const e = decoupeColonnes(cols);
    if (lisible(e)) return e;
  }
  const mots = espaces(cols[0] || l).split(' ');
  const e = mots.length >= 2 ? decoupeMots(mots) : null;
  return lisible(e) ? e : null;
}

/* Une liste collée depuis Pronote, un tableur ou un traitement de texte :
   « MARTIN Alice », « Alice Martin », « Martin;Alice », « Martin<tab>Alice ».
   Rend les élèves reconnus (doublons retirés, 60 au plus) et les lignes
   qu'on n'a pas su lire, pour que le professeur les voie plutôt que de les
   perdre. */
export function lireListeEleves(texte, max = 60) {
  const eleves = [], ignorees = [], vus = new Set();
  for (const brute of String(texte || '').split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || (ENTETE.test(l) && /nom/i.test(l))) continue;
    const e = lireLigne(l);
    if (!e) { ignorees.push(l); continue; }
    const k = cleNom(nomPropre(e.prenom, e.nom));
    if (vus.has(k)) continue;
    vus.add(k);
    eleves.push({ prenom: espaces(e.prenom), nom: espaces(e.nom), complet: nomPropre(e.prenom, e.nom) });
  }
  return { eleves: eleves.slice(0, max), ignorees, trop: Math.max(0, eleves.length - max) };
}

/* ---------- la carte de connexion ----------
   L'identifiant « prenom.nom » est l'adresse « prenom.nom@eleves.folio.invalid »
   du compte : `.invalid` est réservé, aucun courriel ne peut y partir. Le
   QR de la carte ouvre l'app avec « ?carte=identifiant-CODE ». */
export const DOMAINE_CARTE = 'eleves.folio.invalid';

export const normIdentifiant = s => String(s || '').trim().toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9.]/g, '');

export const emailCarte = identifiant => `${normIdentifiant(identifiant)}@${DOMAINE_CARTE}`;

export const lienCarte = (base, identifiant, code) =>
  `${String(base).replace(/[?#].*$/, '')}?carte=${normIdentifiant(identifiant)}-${normCode(code)}`;

export function lireCarte(search) {
  const v = new URLSearchParams(String(search || '')).get('carte') || '';
  const i = v.lastIndexOf('-');
  if (i < 1) return null;
  const identifiant = normIdentifiant(v.slice(0, i)), code = normCode(v.slice(i + 1));
  return identifiant && codeComplet(code) ? { identifiant, code } : null;
}

/* Ce que la base répond, ligne par ligne, quand le professeur crée les comptes. */
export const CREATION = {
  cree: ['ok', 'Créé'],
  deja: ['neutre', 'Déjà dans la classe'],
  homonyme: ['am', 'Existe déjà dans l’établissement'],
  complet: ['ko', 'Classe complète'],
  invalide: ['ko', 'Nom illisible']
};

/* ---------- ce que répond la base quand on tape un code ----------
   `ton` : ok (c'est fait), attente (rien à faire qu'attendre), ko (il faut
   autre chose qu'un nouvel essai). Les textes parlent à un élève de onze
   ans : ce qui se passe, et quoi faire. */
const STATUTS = {
  apercu: ['ok', 'C’est bien ta classe ?', 'Vérifie le nom et le professeur avant de rejoindre.'],
  inscrit: ['ok', 'Bienvenue dans ta classe', 'Tes devoirs apparaîtront ici.'],
  collegue: ['ok', 'Tu fais partie de l’équipe', 'La classe apparaît dans tes classes.'],
  attente: ['attente', 'Demande envoyée', 'Ton professeur doit t’accepter. Tu verras la classe ici dès qu’il l’aura fait.'],
  deja: ['ok', 'Tu es déjà dans cette classe', ''],
  refuse: ['ko', 'Inscription refusée', 'Ton professeur n’a pas accepté ta demande. Parle-lui en directement.'],
  ferme: ['ko', 'Inscriptions fermées', 'Ton professeur a fermé les inscriptions. Demande-lui de les rouvrir.'],
  expire: ['ko', 'Ce code a expiré', 'Demande le nouveau code à ton professeur.'],
  complet: ['ko', 'La classe est complète', 'Ton professeur doit ajouter des places.'],
  archive: ['ko', 'Cette classe est archivée', 'Elle n’accepte plus personne.'],
  etablissement: ['ko', 'Cette classe n’est pas pour ce compte', 'Elle appartient à un autre établissement, ou ton compte n’est pas celui de ton école.'],
  role: ['ko', 'Ce code n’est pas pour ce compte', 'Les élèves et les professeurs n’ont pas le même code.'],
  inconnu: ['ko', 'Code inconnu', 'Vérifie les huit caractères : sans 0, O, 1, I ni L.'],
  trop: ['ko', 'Trop d’essais', 'Par sécurité, réessaie dans une heure.'],
  nom: ['ko', 'Ton prénom et ton nom', 'Ton professeur doit savoir qui tu es : écris ton vrai prénom et ton vrai nom.'],
  demandes: ['ko', 'Trop de demandes en attente', 'Attends qu’un professeur réponde à tes demandes en cours.'],
  connexion: ['ko', 'Connecte-toi d’abord', '']
};

export function messageStatut(statut) {
  const [ton, titre, texte] = STATUTS[statut] || ['ko', 'Impossible pour l’instant', 'Réessaie dans un moment.'];
  return { ton, titre, texte };
}

/* ---------- les inscriptions d'une classe, en un mot ---------- */
export function etatInscriptions(c, maintenant = Date.now()) {
  if (c.archivee) return { k: 'archive', t: 'Archivée', ouvert: false };
  if (!c.ouvert) return { k: 'ferme', t: 'Inscriptions fermées', ouvert: false };
  if (c.fin && Date.parse(c.fin) <= maintenant) return { k: 'expire', t: 'Code expiré', ouvert: false };
  if (c.places && c.effectif >= c.places) return { k: 'complet', t: 'Complète', ouvert: false };
  return { k: 'ouvert', t: c.validation ? 'Ouvertes, sur validation' : 'Ouvertes à tous', ouvert: true };
}

/* Les durées qu'on propose pour un code : le temps d'un cours, d'une
   journée, d'une semaine. En minutes, comme la base les reçoit. */
export const DUREES = [
  { min: 60, t: '1 heure', s: 'le temps du cours' },
  { min: 1440, t: '24 heures', s: '' },
  { min: 10080, t: '7 jours', s: '' },
  { min: 43200, t: '30 jours', s: '' },
  { min: 0, t: 'Sans limite', s: '' }
];

export function finTexte(fin, maintenant = Date.now()) {
  if (!fin) return 'sans limite de durée';
  const reste = Date.parse(fin) - maintenant;
  if (reste <= 0) return 'expiré';
  const min = Math.ceil(reste / 60000);
  if (min < 60) return `encore ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `encore ${h} h`;
  return `encore ${Math.round(h / 24)} jours`;
}

export function erreurPlaces(n, effectif) {
  if (!Number.isInteger(n) || n < 1 || n > 300) return 'Entre 1 et 300 places';
  if (n < effectif) return `La classe compte déjà ${effectif} élèves`;
  return '';
}

/* ---------- un élève ---------- */
export const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const tonReussite = p => (p >= 70 ? 'ok' : p >= 45 ? 'am' : 'ko');

/* Un élève n'a qu'un état à la fois, et c'est le plus grave qui compte. */
export function etatEleve(m) {
  if (m.jamais) return { k: 'jamais', t: 'Jamais connecté', rang: 1 };
  if (m.retard) return { k: 'ko', t: m.retard > 1 ? `${m.retard} devoirs en retard` : '1 devoir en retard', rang: 0 };
  if (!m.donnes) return { k: 'neutre', t: 'Aucun devoir', rang: 4 };
  if (m.rendus >= m.donnes) return { k: 'ok', t: 'À jour', rang: 3 };
  return { k: 'am', t: `${m.donnes - m.rendus} en cours`, rang: 2 };
}

const parNom = (a, b) => String(a.who || '').localeCompare(String(b.who || ''), 'fr', { sensitivity: 'base' });

export const TRIS = {
  suivi: 'Qui décroche',
  nom: 'Nom',
  reussite: 'Réussite',
  activite: 'Activité',
  arrivee: 'Arrivée'
};

export function trierEleves(l, tri) {
  const c = (l || []).slice();
  const cmp = {
    nom: parNom,
    reussite: (a, b) => (b.pct || 0) - (a.pct || 0) || parNom(a, b),
    activite: (a, b) => (b.pages7 || 0) - (a.pages7 || 0) || parNom(a, b),
    arrivee: (a, b) => String(b.inscrit || '').localeCompare(String(a.inscrit || '')) || parNom(a, b),
    suivi: (a, b) => etatEleve(a).rang - etatEleve(b).rang || (b.retard || 0) - (a.retard || 0)
      || (a.pct || 0) - (b.pct || 0) || parNom(a, b)
  }[tri] || parNom;
  return c.sort(cmp);
}

export const FILTRES = { tous: 'Tous', ko: 'En retard', jamais: 'Jamais connectés', ok: 'À jour' };

/* Chercher « emile » doit trouver « Émile » : un professeur tape vite, sans
   accent. (`norm` les garde exprès — au quiz, « été » n'est pas « ete ».) */
const sansAccent = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filtrerEleves(l, q, filtre) {
  const v = sansAccent(q || '');
  return (l || []).filter(m => {
    if (filtre && filtre !== 'tous' && etatEleve(m).k !== filtre) return false;
    return !v || sansAccent(m.who || '').includes(v) || sansAccent(m.handle || '').includes(v);
  });
}

/* ---------- la synthèse d'une classe ----------
   Une moyenne cache toujours deux groupes : on donne aussi la répartition
   par tranches de vingt, et la liste de ceux à reprendre. */
export function syntheseClasse(r) {
  const l = r || [];
  const groupe = k => l.filter(m => etatEleve(m).k === k);
  const notes = l.filter(m => (m.pct || 0) > 0).map(m => m.pct);
  const tranches = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]].map(([a, b]) => ({
    t: `${a}–${b > 100 ? 100 : b}`, n: notes.filter(x => x >= a && x < b).length, ton: tonReussite(a + 10)
  }));
  return {
    n: l.length,
    paquets: [
      { k: 'ok', t: 'À jour', l: groupe('ok') },
      { k: 'am', t: 'En cours', l: groupe('am') },
      { k: 'ko', t: 'En retard', l: groupe('ko') },
      { k: 'jamais', t: 'Jamais connectés', l: groupe('jamais') }
    ].filter(p => p.l.length),
    tranches,
    notes: notes.length,
    moyenne: notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0,
    actifs: l.filter(m => (m.pages7 || 0) > 0).length,
    pages: l.reduce((a, m) => a + (m.pages7 || 0), 0),
    aReprendre: trierEleves(l.filter(m => m.jamais || m.retard || ((m.pct || 0) > 0 && m.pct < 45)), 'suivi')
  };
}

/* ---------- l'accueil du professeur ---------- */
export function syntheseAccueil(classes) {
  const l = (classes || []).filter(c => !c.archivee);
  const som = k => l.reduce((a, c) => a + (c[k] || 0), 0);
  return { classes: l.length, eleves: som('effectif'), attente: som('attente'), retard: som('retard'),
           jamais: som('jamais'), encours: som('encours'), actifs: som('actifs7') };
}

/* Ce qui demande un geste aujourd'hui, du plus pressant au moins pressant.
   Une demande d'inscription attend quelqu'un devant sa porte : elle passe
   avant tout le reste. */
export function aTraiter(classes) {
  const out = [];
  for (const c of (classes || []).filter(x => !x.archivee)) {
    if (c.attente) out.push({ k: 'attente', rang: 0, cid: c.id, n: c.attente, classe: c.name });
    if (c.retard) out.push({ k: 'retard', rang: 1, cid: c.id, n: c.retard, classe: c.name });
    if (c.jamais) out.push({ k: 'jamais', rang: 2, cid: c.id, n: c.jamais, classe: c.name });
    if (!c.effectif) out.push({ k: 'vide', rang: 3, cid: c.id, n: 0, classe: c.name });
    else if (!c.devoirs) out.push({ k: 'sansdevoir', rang: 4, cid: c.id, n: 0, classe: c.name });
  }
  return out.sort((a, b) => a.rang - b.rang || b.n - a.n || String(a.classe).localeCompare(String(b.classe), 'fr'));
}

/* Les classes rangées comme un emploi du temps : actives d'abord, puis par
   niveau (la base les donne déjà dans l'ordre scolaire), archives à part. */
export function rangerClasses(classes) {
  const l = classes || [];
  return { actives: l.filter(c => !c.archivee), archives: l.filter(c => c.archivee) };
}

/* ---------- les dates ---------- */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
  String(d.getDate()).padStart(2, '0')}`;

export const auJour = s => (s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12) : null);

export const joursEntre = (a, b) => Math.round((auJour(b).getTime() - auJour(a).getTime()) / 864e5);

export const dansJours = (n, depuis = new Date()) => {
  const d = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + n, 12);
  return iso(d);
};

export function echeance(due, auj = iso(new Date())) {
  if (!due) return '';
  const j = joursEntre(auj, due);
  if (j < -1) return `il y a ${-j} jours`;
  return { '-1': 'hier', 0: 'aujourd’hui', 1: 'demain' }[j] || `dans ${j} jours`;
}

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

export const jourLong = s => {
  const d = auJour(s);
  return d ? `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}` : '';
};

export const jourCourt = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

/* ---------- un devoir ---------- */
export function etatDevoir(d, auj = iso(new Date())) {
  const eff = d.effectif || 0;
  const tard = !!d.due && d.due < auj && (d.rendu || 0) < eff;
  return { tard, pasOuvert: Math.max(0, eff - (d.ouvert || 0)), taux: pc(d.rendu || 0, eff),
           echeance: echeance(d.due, auj) };
}

/* Le devoir côté élève : « à faire », « commencé », « rendu », et en
   retard s'il n'est pas rendu à temps. */
export function etatDevoirEleve(d, auj = iso(new Date())) {
  if (d.etat === 'rendu') return { k: 'ok', t: 'Rendu' };
  if (d.due && d.due < auj) return { k: 'ko', t: 'En retard' };
  if (d.etat === 'commence') return { k: 'am', t: d.vus ? `${d.vus}/${d.n} cartes` : 'Commencé' };
  return { k: 'neutre', t: 'À faire' };
}

/* Les devoirs d'un mois, rangés par jour d'échéance. */
export function parJour(devoirs) {
  const m = {};
  for (const d of devoirs || []) if (d.due) (m[d.due] = m[d.due] || []).push(d);
  return m;
}

/* La grille d'un mois : semaines du lundi au dimanche, cases vides avant
   le premier jour. */
export function grilleMois(annee, mois) {
  const decal = (new Date(annee, mois, 1, 12).getDay() + 6) % 7;
  const n = new Date(annee, mois + 1, 0, 12).getDate();
  const cases = new Array(decal).fill(null);
  for (let j = 1; j <= n; j++) cases.push(iso(new Date(annee, mois, j, 12)));
  return cases;
}
