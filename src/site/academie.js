/* La Mirandola Academy (/academie, 2026-11-05) : un tuto vidéo par geste,
   pour chaque rôle (élève, professeur, référent) et chaque écran (téléphone,
   ordinateur). Demandé : « une page Académie avec des vidéos tuto de tout
   dans l'app, pour tous les types de compte et d'interface ; pour l'instant,
   pas de vidéo ». Cette liste est la seule source : le gabarit en écrit la
   page au build (tools/site/gabarit.js, `@academie` et `@academie-ld`),
   src/site/academie-page.js ne fait que filtrer et ouvrir le lecteur.

   Ajouter une vidéo : poser le fichier sous public/site/academie/ (hors du
   cache du service worker, comme tout public/site/), puis remplir `video`,
   `affiche`, `date` et `duree` du tuto. La carte devient un bouton qui
   l'ouvre, et la page gagne ses données structurées VideoObject. Les
   scénarios des vidéos se tournent dans la démo (tools/academie/).

   Pur et sans DOM ; test/academie.test.js le vérifie. */

/* `ligne` ne s'affiche pas (demandé le 2026-11-05 : « enlève les micro descriptions ») : elle
   reste la description de la vidéo que lit Google (VideoObject). */
/** @typedef {{ id: string, role: 'eleve'|'prof'|'ref', ecrans: ('tel'|'pc')[], titre: string, ligne: string,
 *   icone: string, video?: string, affiche?: string, date?: string, duree?: number }} Tuto */

export const ROLES = [
  { cle: 'eleve', nom: 'Élève', visage: 'visage-eleve', teinte: '#B0475F' },
  { cle: 'prof', nom: 'Professeur', visage: 'visage-prof', teinte: '#2F5D8A' },
  { cle: 'ref', nom: 'Référent', visage: 'visage-ref', teinte: '#5E4E8A' }
];

export const ECRANS = { tel: 'Téléphone', pc: 'Ordinateur' };

/** @type {Tuto[]} */
export const TUTOS = [
  /* l'élève : « tu », comme dans l'app */
  { id: 'installer', role: 'eleve', ecrans: ['tel'], icone: 'i-tel', titre: 'Installer Mirandola', ligne: 'Sur ton écran d’accueil, en deux gestes, sans magasin.' },
  { id: 'compte', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-groupe', titre: 'Ton compte et ton visage', ligne: 'Ton pseudo, ton visage, ton année, tes matières.' },
  { id: 'code', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-cle', titre: 'Entrer avec un code', ligne: 'Le code de ton lycée ou de ton professeur, et tu es dans ta classe.' },
  { id: 'livre', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-livre', titre: 'Créer ton premier paquet', ligne: 'Écrire tes cartes, ou coller une liste.' },
  { id: 'ia', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-etincelle', titre: 'Ton cours en flashcards avec l’IA', ligne: 'Un texte, une photo, un PDF, ou le Prompt.' },
  { id: 'reviser', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-lecture', titre: 'Réviser chaque jour', ligne: 'Réviser, retourner, te noter. Le moteur fait le reste.' },
  { id: 'devoirs', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-devoir', titre: 'Faire tes devoirs', ligne: 'Ce que ton professeur t’a donné, et pour quand.' },
  { id: 'journal', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-flamme', titre: 'Voir tes statistiques', ligne: 'Ta série, ta régularité, ce que tu sais vraiment.' },
  { id: 'cercle', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-groupe', titre: 'Amis, clubs et classements', ligne: 'Tes amis, et ton classement de la semaine.' },
  { id: 'defi', role: 'eleve', ecrans: ['tel'], icone: 'i-eclair', titre: 'Jouer un défi en direct', ligne: 'Un code, quatre couleurs, le podium.' },
  { id: 'horsligne', role: 'eleve', ecrans: ['tel'], icone: 'i-avion', titre: 'Réviser sans réseau', ligne: 'Dans le métro, en avion : tout se synchronise au retour.' },
  { id: 'pdf', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-fichier', titre: 'Un paquet en PDF', ligne: 'Recto et verso en tableau, à imprimer ou à compléter.' },
  { id: 'plus', role: 'eleve', ecrans: ['tel', 'pc'], icone: 'i-courbe', titre: 'Mirandola+ et ton abonnement', ligne: 'Ce qu’il ouvre, et comment le gérer ou le résilier.' },

  /* le professeur : « vous », comme sur le site */
  { id: 'classes', role: 'prof', ecrans: ['pc', 'tel'], icone: 'i-ecole', titre: 'Votre code et vos classes', ligne: 'Choisir vos classes dans l’établissement.' },
  { id: 'eleves', role: 'prof', ecrans: ['pc'], icone: 'i-groupe', titre: 'Faire entrer vos élèves', ligne: 'Le code et son QR, projetés en classe.' },
  { id: 'devoir', role: 'prof', ecrans: ['pc', 'tel'], icone: 'i-devoir', titre: 'Donner un devoir', ligne: 'Un paquet, une classe, une date.' },
  { id: 'suivre', role: 'prof', ecrans: ['pc', 'tel'], icone: 'i-courbe', titre: 'Suivre une classe', ligne: 'Ce qui est à traiter, l’avancement, chaque élève.' },
  { id: 'bloque', role: 'prof', ecrans: ['pc'], icone: 'i-cible', titre: 'Voir ce qui bloque', ligne: 'Les cartes que la classe rate le plus, sans nom d’élève.' },
  { id: 'defi-prof', role: 'prof', ecrans: ['pc'], icone: 'i-eclair', titre: 'Lancer un défi au tableau', ligne: 'Le code, les questions, le podium.' },
  { id: 'ia-prof', role: 'prof', ecrans: ['pc'], icone: 'i-etincelle', titre: 'Préparer un paquet avec l’IA', ligne: 'Votre cours devient un paquet à donner.' },
  { id: 'agenda', role: 'prof', ecrans: ['pc'], icone: 'i-horloge', titre: 'L’agenda', ligne: 'Les devoirs de toutes vos classes, semaine après semaine.' },
  { id: 'mot', role: 'prof', ecrans: ['pc', 'tel'], icone: 'i-texte', titre: 'Écrire à votre classe', ligne: 'Un mot qui arrive dans les messages de chacun.' },
  { id: 'groupe', role: 'prof', ecrans: ['pc'], icone: 'i-groupe', titre: 'Former un groupe', ligne: 'Une option, un soutien : vous choisissez les élèves.' },
  { id: 'particulier', role: 'prof', ecrans: ['pc', 'tel'], icone: 'i-cle', titre: 'Cours particuliers', ligne: 'Votre salle d’attente, vos élèves, vos places.' },

  /* le référent : sa console est faite pour l'ordinateur ; au téléphone,
     les deux codes et la licence seulement (comme dans l'app) */
  { id: 'activer', role: 'ref', ecrans: ['pc'], icone: 'i-cle', titre: 'Activer votre console', ligne: 'Le code référent, et l’établissement est à vous.' },
  { id: 'codes', role: 'ref', ecrans: ['pc', 'tel'], icone: 'i-cle', titre: 'Les deux codes', ligne: 'Les copier, les projeter, les changer, choisir leur rythme.' },
  { id: 'classes-ref', role: 'ref', ecrans: ['pc'], icone: 'i-ecole', titre: 'Créer les classes', ligne: 'Leurs noms, leur équipe, le professeur principal.' },
  { id: 'personnes', role: 'ref', ecrans: ['pc'], icone: 'i-groupe', titre: 'Élèves et professeurs', ligne: 'Chercher, changer de classe, corriger un nom.' },
  { id: 'comptes', role: 'ref', ecrans: ['pc'], icone: 'i-texte', titre: 'Ouvrir les comptes d’une classe', ligne: 'Une ligne par élève, un mot de passe chacun.' },
  { id: 'retirer', role: 'ref', ecrans: ['pc'], icone: 'i-bouclier', titre: 'Retirer un compte', ligne: 'Sa place revient à l’établissement.' },
  { id: 'licence', role: 'ref', ecrans: ['pc', 'tel'], icone: 'i-fichier', titre: 'La licence et les factures', ligne: 'Les places, les factures, Chorus Pro.' },
  { id: 'historique', role: 'ref', ecrans: ['pc'], icone: 'i-horloge', titre: 'L’historique', ligne: 'Ce qui s’est fait dans l’établissement, et quand.' },
  { id: 'donnees', role: 'ref', ecrans: ['pc'], icone: 'i-europe', titre: 'Les données des élèves', ligne: 'Le contrat, la sous-traitance, votre registre.' }
];

export const duRole = (role, tutos = TUTOS) => tutos.filter(t => t.role === role);
export const prete = t => Boolean(t.video);

/* « 2 min 05 » : la durée d'une vidéo, en clair. */
export function dureeLisible(s) {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m ? `${m} min${r ? ' ' + String(r).padStart(2, '0') : ''}` : `${r} s`;
}
/* « PT2M5S » : la même, comme la lit Google. */
export const dureeIso = s => `PT${Math.floor(s / 60) ? Math.floor(s / 60) + 'M' : ''}${Math.round(s % 60)}S`;

const ic = (id, classe = '') => `<svg class="ic${classe ? ' ' + classe : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;

/* Une carte : la vignette d'une vidéo (le dessin du geste, les écrans, son
   numéro), puis son titre et sa ligne. Prête, c'est un bouton qui ouvre le
   lecteur ; sinon, elle dit « Bientôt ». */
function carte(t, n) {
  const role = ROLES.find(r => r.cle === t.role);
  const vignette = `<span class="ac-vignette" aria-hidden="true"><span class="ac-num">${n}</span>${ic(t.icone, 'ac-geste')}`
    + `<span class="ac-ecrans">${t.ecrans.map(e => ic(e === 'tel' ? 'i-tel' : 'i-pc')).join('')}</span>`
    + (prete(t) ? `<span class="ac-lire">${ic('i-play')}</span><span class="ac-duree">${dureeLisible(t.duree)}</span>` : '<span class="ac-bientot">Bientôt</span>')
    + '</span>';
  const texte = `<span class="ac-t">${t.titre}</span>`
    + `<span class="cache">${role.nom}, ${t.ecrans.map(e => ECRANS[e].toLowerCase()).join(' et ')}${prete(t) ? '' : ', bientôt'}</span>`;
  const attrs = `class="ac-carte" data-ecrans="${t.ecrans.join(' ')}" id="tuto-${t.id}"`;
  return prete(t)
    ? `<li><button type="button" ${attrs} data-video="${t.video}" data-affiche="${t.affiche}">${vignette}${texte}</button></li>`
    : `<li><div ${attrs}>${vignette}${texte}</div></li>`;
}

const visage = r => `<span class="ac-av" style="--j:${r.teinte}" aria-hidden="true"><svg class="visage"><use href="#${r.visage}"/></svg></span>`;
const compte = n => n + (n > 1 ? ' tutos' : ' tuto');

/* Tout le catalogue, écrit au build : les trois rôles en tête (des ancres,
   pas des onglets : sans script, tout se lit, et Google aussi), le choix de
   l'écran (montré par le script seul), puis chaque rôle et ses tutos, chacun
   à son rang dans le rôle. */
export function catalogue(tutos = TUTOS) {
  const roles = '<nav class="ac-roles" aria-label="Les tutos par rôle">' + ROLES.map(r =>
    `<a href="#${r.cle}">${visage(r)}<span><b>${r.nom}</b><small>${compte(duRole(r.cle, tutos).length)}</small></span></a>`).join('') + '</nav>';
  const filtre = '<div class="ac-filtre" role="radiogroup" aria-label="Sur quel écran" hidden>'
    + '<button type="button" role="radio" aria-checked="true" data-ecran="">Tous</button>'
    + Object.entries(ECRANS).map(([e, nom]) => `<button type="button" role="radio" aria-checked="false" data-ecran="${e}">${ic(e === 'tel' ? 'i-tel' : 'i-pc')}${nom}</button>`).join('')
    + '</div>';
  const sections = ROLES.map(r => `<section class="ac-role" id="${r.cle}" aria-labelledby="ac-${r.cle}-t" style="--j:${r.teinte}">`
    + `<div class="ac-role-tete">${visage(r)}<h2 id="ac-${r.cle}-t">${r.nom}</h2></div>`
    + '<ol class="ac-grille">' + duRole(r.cle, tutos).map((t, k) => carte(t, k + 1)).join('') + '</ol></section>').join('');
  return roles + filtre + sections;
}

/* Les données structurées des vidéos en ligne (rien tant qu'il n'y en a pas). */
export function videosLD(site, tutos = TUTOS) {
  return tutos.filter(prete).map(t => ({
    '@context': 'https://schema.org', '@type': 'VideoObject', name: t.titre, description: t.ligne,
    thumbnailUrl: site + t.affiche, uploadDate: t.date, duration: dureeIso(t.duree),
    contentUrl: /^https?:/.test(t.video) ? t.video : site + t.video,
    inLanguage: 'fr-FR', isPartOf: { '@id': site + '/academie#page' }
  }));
}
