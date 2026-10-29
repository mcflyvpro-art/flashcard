// M08.T2 — budget de poids, vérifié après chaque build (npm run check, donc
// en CI). Un élève ouvre l'app sur un forfait mobile, parfois en 4G
// faiblarde : chaque kilo-octet compte au démarrage. Au-delà, le build
// échoue — on décide alors en connaissance de cause (alléger, ou relever
// le budget ici, dans un commit qui dit pourquoi).
//
// Depuis l'espace professeur (2026-10-24), JS et CSS se comptent en deux parts.
// Le démarrage : ce que dist/index.html charge (script d'entrée et ses
// modulepreload) — c'est lui que tout le monde attend, élèves compris, et
// c'est lui qui garde les 120 Ko d'origine. Les morceaux chargés à la
// demande (aujourd'hui le seul espace professeur, ui/prof-porte.js, et sa
// feuille de style) ne pèsent que chez qui les ouvre : ils ont leur propre
// plafond, pour qu'ils ne grossissent pas non plus sans qu'on le décide.
//
// 2026-10-25 : le journal de lecture devient le troisième morceau (après
// l'espace professeur et la partie en direct) — 4,8 Ko de JS et 2,5 Ko de
// CSS à lui seul. Le plafond « à la demande » additionne les trois, que
// personne ne charge ensemble (un élève n'ouvre jamais l'espace prof) : il
// passe de 30 à 40 Ko (JS) et de 12 à 16 Ko (CSS), pour garder la même
// marge par morceau ; le démarrage, lui, garde ses 120 Ko.
//
// 2026-10-25 (bis) : le démarrage n'avait plus un octet de marge ; la
// sauvegarde, l'entretien de la bibliothèque (réparation, doublons) et le
// courrier refait sortent en morceaux à la demande, et la page d'une classe
// et le profil d'un lecteur suivent le même chemin. Le plafond « à la
// demande » passe de 40 à 56 Ko (JS) et de 16 à 22 Ko (CSS) — toujours la
// même marge par morceau, et toujours personne qui les charge tous ; le
// démarrage garde ses 120 Ko (115 aujourd'hui).
//
// 2026-10-26 : les consoles du référent et de l'éditeur, refaites, sortent
// du démarrage (qui redescend à 112 Ko) en morceaux que seul un référent ou
// l'éditeur ouvre — 10 et 8,5 Ko à elles deux, JS et CSS —, avec le
// formulaire « Demander une démo » de l'écran de connexion (2 Ko). Le
// plafond « à la demande » passe de 56 à 68 Ko (JS) et de 22 à 27 Ko (CSS) :
// la même marge par morceau, et toujours personne qui les charge tous.
//
// 2026-10-26 (bis) : la démo sans compte embarque une base locale entière
// (le Supabase en mémoire des parcours, src/base-locale/, et le monde du
// Lycée Démo Mirandola) — 22 Ko de JS. Elle ne se charge que chez un visiteur
// sans compte qui clique « Essayer », jamais chez un élève, un professeur
// ou un référent : elle a son plafond à elle (30 Ko JS, 3 Ko CSS) au lieu
// de gonfler celui des comptes. Ses fichiers se reconnaissent à leur nom
// (`demo-…`, ui/demo.js et sa feuille).
//
// 2026-10-26 : la racine devient la page d'accueil du site (dist/index.html)
// et l'app passe à /app (dist/app.html) : le démarrage de l'app se lit
// désormais dans app.html. La page d'accueil a sa propre part, « site » :
// son HTML (le texte que lisent les moteurs y est en entier) plus ce
// qu'elle charge, et seulement ce qu'elle charge — un visiteur qui ne fait
// que regarder ne télécharge jamais l'app. Images et vidéos à part : elles
// arrivent à mesure qu'on fait défiler.
//
// 2026-10-26 (ter) : les consoles du référent et de l'éditeur grandissent (la
// licence, les factures, les échanges, les documents du contrat). Elles ne
// se chargent que chez un référent ou l'éditeur — quelques comptes par
// établissement, jamais un élève ni un professeur : elles quittent le
// plafond « à la demande » des comptes pour un plafond à elles (30 Ko JS,
// 8 Ko CSS), comme la démo. Leurs fichiers se reconnaissent à leur nom
// (`ref-…`, `admin-…`, `facture-…`, `documents-…`).
//
// 2026-10-28 : la porte d'installation (ui/pwa.js et sa feuille, `pwa-…`).
// Elle ne se charge que dans le navigateur d'un téléphone, avant toute
// connexion, et plus jamais une fois l'app installée : un plafond à elle
// (10 Ko JS, 5 Ko CSS), comme la démo, plutôt que de prendre la marge des
// morceaux que chargent les comptes.
//
// 2026-10-28 (bis) : l'écran Mirandola+ (ui/plus.js, src/licence.js et sa
// feuille, `plus-…`) montre maintenant la licence en détail, les avantages
// et les gestes de résiliation. On l'ouvre pour payer ou pour regarder sa
// licence — quelques fois par an —, jamais en révisant : un plafond à lui
// (10 Ko JS, 4 Ko CSS), comme la porte d'installation, au lieu de prendre
// la marge des écrans qu'on ouvre tous les jours.
//
// 2026-10-29 : la base locale de la démo rejoue aussi la licence d'un
// professeur particulier, sa salle d'attente et les comptes que l'éditeur
// ouvre (src/base-locale/licences.js) — sans elle, la démo et les parcours
// verraient ces écrans vides. Le plafond de la démo passe de 30 à 32 Ko :
// il ne se charge toujours que chez un visiteur sans compte.
//
// 2026-10-29 : l'avatar passe de sept traits à quatorze (quatorze peaux,
// vingt-deux coiffures dont le hijab, le turban, les locks et les nattes
// collées, la barbe, les lunettes, les bijoux, la tenue… — demandé pour que
// chacun s'y retrouve). Ses dessins ne peuvent pas attendre : le visage de
// chacun est sur les tout premiers écrans (le cercle, la classe, le
// classement), et un visage dessiné en deux temps clignoterait. Le
// démarrage, qui n'avait plus un octet de marge (120,0 Ko), passe à 126 Ko :
// 4,6 Ko de dessins, et un peu de marge. Dans le même temps, l'accueil d'un
// nouveau compte et le tuto (ui/bienvenue.js, ui/tuto.js et leurs règles,
// `bienvenue-…`, `tuto-…`) quittent le plafond « à la demande » pour un
// plafond à eux (22 Ko JS, 6 Ko CSS) : ils ne servent qu'une fois par compte,
// comme la porte d'installation, et grandissent avec la page que le tuto
// écrit lui-même et l'éditeur de visage.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// octets gzip, tous fichiers de la part cumulés
const BUDGET = { js: 126 * 1024, css: 25 * 1024, jsDemande: 68 * 1024, cssDemande: 27 * 1024, jsDemo: 32 * 1024, cssDemo: 3 * 1024,
  jsGestion: 30 * 1024, cssGestion: 8 * 1024, jsPorte: 10 * 1024, cssPorte: 5 * 1024, jsPlus: 10 * 1024, cssPlus: 4 * 1024,
  jsPremiers: 22 * 1024, cssPremiers: 6 * 1024, site: 48 * 1024 };
const NOMS = { js: 'JS au démarrage', css: 'CSS au démarrage', jsDemande: 'JS à la demande', cssDemande: 'CSS à la demande',
  jsDemo: 'JS de la démo sans compte', cssDemo: 'CSS de la démo sans compte',
  jsGestion: 'JS des consoles (référent, éditeur)', cssGestion: 'CSS des consoles (référent, éditeur)',
  jsPorte: 'JS de la porte d’installation', cssPorte: 'CSS de la porte d’installation',
  jsPlus: 'JS de l’écran Mirandola+', cssPlus: 'CSS de l’écran Mirandola+',
  jsPremiers: 'JS des premiers pas (accueil, tuto)', cssPremiers: 'CSS des premiers pas (accueil, tuto)',
  site: 'Page d’accueil (HTML + CSS + JS)' };
const dir = 'dist/assets';
const gz = b => gzipSync(b, { level: 9 }).length;
const app = readFileSync('dist/app.html', 'utf8');
const site = readFileSync('dist/index.html', 'utf8');
const auDemarrage = f => app.includes('/assets/' + f);
const duSite = f => site.includes('/assets/' + f);
const total = { js: 0, css: 0, jsDemande: 0, cssDemande: 0, jsDemo: 0, cssDemo: 0, jsGestion: 0, cssGestion: 0,
  jsPorte: 0, cssPorte: 0, jsPlus: 0, cssPlus: 0, jsPremiers: 0, cssPremiers: 0, site: gz(site) };
for (const f of readdirSync(dir)) {
  const ext = f.split('.').pop();
  if (ext !== 'js' && ext !== 'css') continue;
  const n = gz(readFileSync(`${dir}/${f}`));
  if (duSite(f)) total.site += n;
  if (duSite(f) && !auDemarrage(f)) continue;
  const part = auDemarrage(f) ? ext : /^demo-/.test(f) ? ext + 'Demo' : /^pwa-/.test(f) ? ext + 'Porte'
    : /^plus-/.test(f) ? ext + 'Plus' : /^(ref-|admin-|facture-|documents-)/.test(f) ? ext + 'Gestion'
      : /^(tuto|bienvenue)-/.test(f) ? ext + 'Premiers' : ext + 'Demande';
  total[part] += n;
}
let ok = true;
for (const k of Object.keys(BUDGET)) {
  const ko = (n) => (n / 1024).toFixed(1) + ' Ko';
  const dedans = total[k] <= BUDGET[k];
  console.log(`${dedans ? '✓' : '✗'} ${NOMS[k]} ${ko(total[k])} gzip / budget ${ko(BUDGET[k])}`);
  ok = ok && dedans;
}
process.exit(ok ? 0 : 1);
