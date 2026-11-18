/* ══════════ les règles d'une classe ══════════
   Ce que l'écran « Mes classes » de l'élève décide, sans DOM ni réseau
   (règle 1 de CLAUDE.md) : la forme d'un code, le nom d'un élève, ce que
   veut dire un statut d'inscription, les échéances, l'état d'un devoir. Le
   suivi d'une classe — l'état d'un élève, l'ordre d'une liste, les chiffres
   d'une synthèse, une liste collée — est dans src/classe-suivi.js, qui ne
   part qu'avec l'espace professeur et la console du référent (2026-11-18 :
   au démarrage de chaque élève, il pesait pour rien). Les écrans ne font
   qu'afficher ce qui sort d'ici ; test/classe.test.js le vérifie.

   Les dates voyagent en « AAAA-MM-JJ » et ne sont jamais converties en
   Date sans heure : `new Date('2026-10-24')` est minuit UTC, donc la veille
   au soir à Los Angeles. On construit toujours une date locale à midi. */

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

export const espaces = s => String(s || '').trim().replace(/\s+/g, ' ');

export const nomPropre = (prenom, nom) =>
  espaces(prenom).toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
  + ' ' + espaces(nom).toUpperCase();

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

/* ---------- les dates ---------- */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
  String(d.getDate()).padStart(2, '0')}`;

export const auJour = s => (s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12) : null);

export const joursEntre = (a, b) => Math.round((auJour(b).getTime() - auJour(a).getTime()) / 864e5);

export const jourCourt = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

export function echeance(due, auj = iso(new Date())) {
  if (!due) return '';
  const j = joursEntre(auj, due);
  if (j < -1) return `il y a ${-j} jours`;
  return { '-1': 'hier', 0: 'aujourd’hui', 1: 'demain' }[j] || `dans ${j} jours`;
}

/* ---------- un devoir ---------- */
/* Le devoir côté élève : « à faire », « commencé », « rendu », et en
   retard s'il n'est pas rendu à temps. */
export function etatDevoirEleve(d, auj = iso(new Date())) {
  if (d.etat === 'rendu') return { k: 'ok', t: 'Rendu' };
  if (d.due && d.due < auj) return { k: 'ko', t: 'En retard' };
  if (d.etat === 'commence') return { k: 'am', t: d.vus ? `${d.vus}/${d.n} cartes` : 'Commencé' };
  return { k: 'neutre', t: 'À faire' };
}

/* Les classes rangées comme un emploi du temps : actives d'abord, puis par
   niveau (la base les donne déjà dans l'ordre scolaire), archives à part. */
export function rangerClasses(classes) {
  const l = classes || [];
  return { actives: l.filter(c => !c.archivee), archives: l.filter(c => c.archivee) };
}
