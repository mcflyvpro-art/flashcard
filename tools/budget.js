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
//
// 2026-10-29 (bis) : un code tapé sur le site avant d'avoir un compte attend
// la connexion d'un onglet à l'autre (src/lien-garde.js), l'accueil continue
// après un code, l'élève et le professeur voient la salle d'attente bouger
// sans recharger. Tout cela doit être là dès le premier écran (le lien
// arrive avant tout) : 0,6 Ko de plus, et le démarrage passe de 126 à 127 Ko.
//
// 2026-11-02 : la sécurité du compte. Les écrans des codes (ui/verif.js :
// confirmer son adresse, mot de passe oublié, connexion par code, la
// vérification en deux étapes) et « Sécurité du compte » (ui/securite.js,
// src/securite.js, core/compte-auth.js, le QR code) ne servent qu'à la
// connexion ou quelques fois par an : un plafond à eux (12 Ko JS, 4 Ko CSS),
// comme la porte d'installation (`verif-…`, `securite-…`, `compte-auth-…`).
// Ce qui doit garder le démarrage reste au démarrage : la porte de la
// vérification en deux étapes (rien ne se lit ni ne s'envoie avant le code),
// la session révoquée à la déconnexion, le gestionnaire de mots de passe
// prévenu à la connexion — 0,6 Ko, et le démarrage passe de 127 à 128 Ko.
//
// 2026-11-02 : le site passe à plusieurs pages (src/site/pages.js,
// docs/SEO.md) — tarifs, établissements, la répétition espacée… Chacune a
// sa part, « pages », comptée comme l'accueil (son HTML et ce qu'elle
// charge) : c'est la plus lourde qui se compare au plafond (40 Ko). Leurs
// fichiers ne tombent plus dans « à la demande » : aucun compte ne les
// charge. L'accueil y gagne ce qui relie les pages entre elles et les
// fait comprendre à Google — l'en-tête qui mène aux pages, une colonne de
// liens dans le pied, un lien sous le moteur, les tuiles et Campus, le nom
// du site et le logo en données structurées : 1 Ko, et son plafond passe
// de 48 à 50 Ko (il était à 47,7).
// 2026-11-06 : l'en-tête a deux menus (« Apprendre », « Établissements »),
// leur style, leur script, et le menu du téléphone rangé en tuiles par
// groupe : un peu moins d'1 Ko de plus partout (l'accueil passait à 50,1,
// /etablissements à 40,4). Les plafonds montent d'1 Ko : accueil 51, autres
// pages 41.
// 2026-11-04 : la page du moteur (/moteur) a son plafond à elle, 56 Ko :
// ses formules (MathML), ses six graphiques et la table des 21 paramètres
// sont écrits au build dans son HTML, pour se lire sans JavaScript et être
// lus par les moteurs de recherche ; son script charge le moteur de l'app
// (src/fsrs.js) pour les redessiner. Les autres pages gardent leurs 40 Ko.
// 2026-11-05 : la console de l'éditeur gagne tous les comptes de l'app —
// trier, filtrer, choisir plusieurs, supprimer, suspendre, confirmer une
// adresse (ui/admin-comptes.js, src/comptes.js) : 1,9 Ko, et le plafond des
// consoles passe de 30 à 33 Ko. Elles ne se chargent que chez un référent
// ou l'éditeur. Les mêmes fonctions rejouées en mémoire
// (src/base-locale/comptes.js) ne vont qu'aux parcours, jamais à la démo.
// 2026-11-05 : « J'ai un code » quitte le démarrage. La feuille
// (ui/code-entree.js) et ce qu'elle seule y amenait — les messages de chaque
// statut d'un code (src/etablissement.js, que partagent les consoles) et le
// code d'un livre (src/livre-code.js, le partage par code) — se chargent à
// la demande, par ui/code-porte.js : le démarrage repasse de 128 à 123,6 Ko
// (le cadre légal et le partage par code l'avaient mené au plafond). Un
// plafond à eux, 8 Ko JS (6,1 aujourd'hui), comme la sécurité du compte
// (`code-entree-…`, `etablissement-…`).
//
// 2026-11-06 : Mirandola Infini a son plafond (`examen-…` : l'objectif
// examen aujourd'hui, l'examen blanc demain), 14 Ko JS et 4 Ko CSS : il ne
// se charge que chez un abonné Infini. La démo passe de 32 à 33 Ko : la
// base locale y rejoue le niveau Infini et l'essai (mon_offre, mon_ia).
// Le plafond « à la demande » passe de 68 à 70 Ko : il était plein, et les
// textes du cadre (ui/legal-textes.js) disent désormais l'examen blanc —
// ce que l'IA y lit, ce qui est gardé, ce qui ne l'est pas.
// Puis à 71 Ko (2026-11-07) : la barre de l'IA sous chaque façon de créer
// (ui/prompt-ia.js) porte les photos, le PDF, l'annulation ; le démarrage,
// lui, a perdu la feuille des pages d'un PDF (124,7 → 124,5).
// 2026-11-07 : jouer un défi à son rythme a son plafond (`duel-jeu-…`), 4 Ko
// JS et 1 Ko CSS : le vrai ou faux et la réponse écrite ne tenaient plus au
// démarrage (128,1 Ko), et l'écran ne sert qu'une fois la partie lancée ;
// sorti avec l'écran du QCM, le démarrage repasse à 127,3.
// Le même jour, « Modifier avec l'IA » (`retouche-…` : la feuille et
// l'appariement des cartes, src/retouche.js) a le sien, 5 Ko JS et 1 Ko CSS :
// la barre de l'IA qu'elle porte reste comptée à la demande, avec la création.
// 2026-11-14 : le plafond « à la demande » passe de 71 à 72 Ko. Il était
// plein à l'octet près (72 704), et un changement qui ne touche aucun de ses
// morceaux le faisait basculer : le nom haché du morceau de démarrage change,
// chaque morceau qui l'importe se compresse 2 à 6 octets autrement, une
// vingtaine de morceaux, 9 octets de trop. Un plafond sans marge échoue sur
// du bruit ; celui-ci garde son rôle (rien n'y grossit d'1 Ko sans qu'on le
// décide).
// 2026-11-14 : les devis (`devis-…` : ui/devis.js, src/devis.js, core/devis.js,
// et `tarifs-…`, la grille que la console de l'éditeur lit aussi et que le
// build range désormais à part) ont leur plafond, 6 Ko JS et 1 Ko
// CSS. Ils ne se chargent que chez l'éditeur qui ouvre la fiche d'un
// établissement, ou chez un référent dont la licence porte un devis : hors
// du plafond des consoles, qui n'avait plus que 0,5 Ko de marge.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { SOUS_PAGES } from '../src/site/pages.js';

// octets gzip, tous fichiers de la part cumulés
// 2026-11-07 : l'onglet Santé de la console de l'éditeur (ui/admin-sante.js :
// les erreurs remontées par les appareils, la vigie) — les consoles passent
// de 33 à 34 Ko. Au démarrage, le rapporteur d'erreurs (src/erreurs.js,
// core/rapport-erreurs.js) DOIT y être, évalué avant tout le reste : le
// démarrage passe de 124,3 à 127,0 Ko, sous ses 128.
const BUDGET = { js: 128 * 1024, css: 25 * 1024, jsDemande: 72 * 1024, cssDemande: 27 * 1024, jsDemo: 33 * 1024, cssDemo: 3 * 1024,
  jsGestion: 34 * 1024, cssGestion: 8 * 1024, jsPorte: 10 * 1024, cssPorte: 5 * 1024, jsPlus: 10 * 1024, cssPlus: 4 * 1024,
  jsPremiers: 22 * 1024, cssPremiers: 6 * 1024, jsSecurite: 12 * 1024, cssSecurite: 4 * 1024, jsCode: 8 * 1024, cssCode: 1024, jsInfini: 14 * 1024, cssInfini: 4 * 1024, jsDefis: 4 * 1024, cssDefis: 1024, jsRetouche: 5 * 1024, cssRetouche: 1024, jsDevis: 6 * 1024, cssDevis: 1024, site: 51 * 1024, pages: 41 * 1024, moteur: 56 * 1024 };
const NOMS = { js: 'JS au démarrage', css: 'CSS au démarrage', jsDemande: 'JS à la demande', cssDemande: 'CSS à la demande',
  jsDemo: 'JS de la démo sans compte', cssDemo: 'CSS de la démo sans compte',
  jsGestion: 'JS des consoles (référent, éditeur)', cssGestion: 'CSS des consoles (référent, éditeur)',
  jsPorte: 'JS de la porte d’installation', cssPorte: 'CSS de la porte d’installation',
  jsPlus: 'JS de l’écran Mirandola+', cssPlus: 'CSS de l’écran Mirandola+',
  jsPremiers: 'JS des premiers pas (accueil, tuto)', cssPremiers: 'CSS des premiers pas (accueil, tuto)',
  jsSecurite: 'JS de la sécurité du compte', cssSecurite: 'CSS de la sécurité du compte',
  jsCode: 'JS de « J’ai un code »', cssCode: 'CSS de « J’ai un code »',
  jsInfini: 'JS de Mirandola Infini (examen)', cssInfini: 'CSS de Mirandola Infini (examen)',
  jsDefis: 'JS d’un défi à son rythme', cssDefis: 'CSS d’un défi à son rythme',
  jsRetouche: 'JS de « Modifier avec l’IA »', cssRetouche: 'CSS de « Modifier avec l’IA »',
  jsDevis: 'JS des devis', cssDevis: 'CSS des devis',
  site: 'Page d’accueil (HTML + CSS + JS)', pages: 'Autres pages du site, la plus lourde (HTML + CSS + JS)',
  moteur: 'Page du moteur (HTML + CSS + JS)' };
const dir = 'dist/assets';
const gz = b => gzipSync(b, { level: 9 }).length;
const app = readFileSync('dist/app.html', 'utf8');
const site = readFileSync('dist/index.html', 'utf8');
const autres = SOUS_PAGES.map(p => ({ nom: p.fichier, html: readFileSync('dist/' + p.fichier, 'utf8') }));
const auDemarrage = f => app.includes('/assets/' + f);
const duSite = f => site.includes('/assets/' + f);
const dUnePage = f => autres.some(x => x.html.includes('/assets/' + f));
const total = { js: 0, css: 0, jsDemande: 0, cssDemande: 0, jsDemo: 0, cssDemo: 0, jsGestion: 0, cssGestion: 0,
  jsPorte: 0, cssPorte: 0, jsPlus: 0, cssPlus: 0, jsPremiers: 0, cssPremiers: 0, jsSecurite: 0, cssSecurite: 0, jsCode: 0, cssCode: 0, jsInfini: 0, cssInfini: 0, jsDefis: 0, cssDefis: 0, jsRetouche: 0, cssRetouche: 0, jsDevis: 0, cssDevis: 0, site: gz(site), pages: 0, moteur: 0 };
const parPage = Object.fromEntries(autres.map(x => [x.nom, gz(x.html)]));
for (const f of readdirSync(dir)) {
  const ext = f.split('.').pop();
  if (ext !== 'js' && ext !== 'css') continue;
  const n = gz(readFileSync(`${dir}/${f}`));
  if (duSite(f)) total.site += n;
  for (const x of autres) if (x.html.includes('/assets/' + f)) parPage[x.nom] += n;
  if ((duSite(f) || dUnePage(f)) && !auDemarrage(f)) continue;
  const part = auDemarrage(f) ? ext : /^demo-/.test(f) ? ext + 'Demo' : /^pwa-/.test(f) ? ext + 'Porte'
    : /^plus-/.test(f) ? ext + 'Plus' : /^(ref-|admin-|facture-|documents-)/.test(f) ? ext + 'Gestion'
      : /^(tuto|bienvenue)-/.test(f) ? ext + 'Premiers' : /^(verif|securite|compte-auth)-/.test(f) ? ext + 'Securite'
        : /^(code-entree|etablissement)-/.test(f) ? ext + 'Code' : /^examen-/.test(f) ? ext + 'Infini' : /^duel-jeu-/.test(f) ? ext + 'Defis'
          : /^retouche-/.test(f) ? ext + 'Retouche' : /^(devis|tarifs)-/.test(f) ? ext + 'Devis' : ext + 'Demande';
  total[part] += n;
}
total.moteur = parPage['moteur.html'] || 0;
const lourde = Object.entries(parPage).filter(([nom]) => nom !== 'moteur.html').sort((a, b) => b[1] - a[1])[0];
total.pages = lourde ? lourde[1] : 0;
if (lourde) NOMS.pages += ` : ${lourde[0]}`;
let ok = true;
for (const k of Object.keys(BUDGET)) {
  const ko = (n) => (n / 1024).toFixed(1) + ' Ko';
  const dedans = total[k] <= BUDGET[k];
  console.log(`${dedans ? '✓' : '✗'} ${NOMS[k]} ${ko(total[k])} gzip / budget ${ko(BUDGET[k])}`);
  ok = ok && dedans;
}
process.exit(ok ? 0 : 1);
