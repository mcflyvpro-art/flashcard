/* Les couleurs de Mirandola (2026-10-27) — module pur, sans dépendance, testé
   dans test/couleurs.test.js. Une couleur fait UN travail, jamais deux :

   - l'encre (les neutres de app.css) habille l'interface ;
   - l'azur (`AZUR`) dit tout ce qui se compte : pages lues, régularité,
     mémoire, objectif du jour, classement, avancement d'un devoir. Une
     seule teinte, du clair au foncé : on lit l'ordre à la clarté ;
   - les états (`ETATS`) disent juste ou faux, à jour ou en retard,
     attention — toujours avec une icône ou un mot, jamais seuls ;
   - le nuancier (`NUANCIER`) est la reliure d'une matière : son livre, ses
     pages, sa pastille, sa part dans le journal.

   Avant, vert voulait dire à la fois « juste », « relue », « jours lus »,
   la matière SVT et une classe ; ambre et jaune, indigo et violet, canard
   et cyan étaient la même couleur à l'œil (écart OKLab 2,8 à 4,5), et
   leurs couvertures pâles indiscernables. Les quatorze teintes ci-dessous
   sont tenues à un écart d'au moins 10 deux à deux (OKLab × 100), à 5,5 au
   moins pour un œil daltonien (le nom de la matière est toujours écrit à
   côté), et loin de l'azur des données.

   Pour chaque teinte :
     d   la reliure — dos d'un livre, pastille, trait d'un graphique ;
     c   la couverture — fond d'un livre et papier d'une fiche ;
     b   le filet de la couverture ;
     ci  l'encre sur la couverture (au moins 7:1) ;
     f   la reliure foncée, sous un chiffre blanc (au moins 4,5:1).

   Les clés sont celles que la base garde (`subjects.color`) : on n'en
   retire aucune. Deux anciennes, qui doublaient une voisine, la rejoignent
   (`ALIAS`) et ne se proposent plus. */

export const NUANCIER = {
  red:      { d: '#9F3D34', c: '#FEEAE7', b: '#FDCCC4', ci: '#6B2620', f: '#9F3D34' },
  orange:   { d: '#B66309', c: '#FDEBDF', b: '#FBCFAF', ci: '#613201', f: '#934F06' },
  yellow:   { d: '#CCA855', c: '#F9EED7', b: '#E9D7B0', ci: '#513C00', f: '#7D5E01' },
  lime:     { d: '#859E57', c: '#EAF3DD', b: '#D1DFBC', ci: '#364710', f: '#566D26' },
  green:    { d: '#2D8A4F', c: '#DFF6E4', b: '#BBE6C5', ci: '#024D24', f: '#12773D' },
  teal:     { d: '#1E6162', c: '#E1F3F4', b: '#C1E0E1', ci: '#093E3F', f: '#1E6162' },
  cyan:     { d: '#4BA1C7', c: '#DEF3FE', b: '#B8E0F4', ci: '#03465E', f: '#006D91' },
  blue:     { d: '#0970A4', c: '#E3F2FD', b: '#B6DFFE', ci: '#024467', f: '#0970A4' },
  indigo:   { d: '#1B2770', c: '#E9EFFF', b: '#CBD8FE', ci: '#070A41', f: '#1B2770' },
  violet:   { d: '#9566C8', c: '#F3EBFE', b: '#E2CFFD', ci: '#4C306A', f: '#7748A7' },
  purple:   { d: '#6A265A', c: '#FDE8F6', b: '#F4CBE7', ci: '#400D35', f: '#6A265A' },
  pink:     { d: '#B56284', c: '#FFE8F0', b: '#F9CADB', ci: '#642842', f: '#944466' },
  sand:     { d: '#6D381B', c: '#FFEBE1', b: '#F2D1C1', ci: '#441D06', f: '#6D381B' },
  graphite: { d: '#383838', c: '#EFEFEF', b: '#D9D9D9', ci: '#1A1B1B', f: '#383838' }
};

// les teintes proposées, dans l'ordre du nuancier, et leur nom
export const TEINTES = Object.keys(NUANCIER);
export const NOMS = {
  red: 'Rouge', orange: 'Orange', yellow: 'Moutarde', lime: 'Olive', green: 'Vert', teal: 'Canard', cyan: 'Ciel',
  blue: 'Bleu', indigo: 'Marine', violet: 'Violet', purple: 'Prune', pink: 'Rose', sand: 'Cuir', graphite: 'Ardoise'
};

/* L'ordre où une matière nouvelle reçoit sa teinte quand personne ne la
   choisit (la moins employée d'abord, `couleurLibre`) : les six premières
   restent à 13 au moins l'une de l'autre, 6 pour un œil daltonien. Dans
   l'ordre du nuancier, cinq matières créées de suite prenaient rouge,
   orange, moutarde, olive et vert — cinq voisines. */
export const SUCCESSION = ['blue', 'red', 'yellow', 'green', 'pink', 'cyan', 'violet', 'orange', 'teal', 'indigo',
  'lime', 'purple', 'sand', 'graphite'];

// anciennes clés qui doublaient une voisine (écart 5,4 et 2,8)
export const ALIAS = { coral: 'orange', amber: 'yellow' };

// toute clé que la base peut rendre, alias compris
export const PALETTE = { ...NUANCIER, ...Object.fromEntries(Object.entries(ALIAS).map(([a, k]) => [a, NUANCIER[k]])) };

// un livre sans matière : du papier, sans reliure de couleur
export const SANS = { d: '#A39E95', c: '#F2F0EB', b: '#E0DCD4', ci: '#4B4842', f: '#6F6B64' };

export const cleTeinte = cle => (NUANCIER[cle] ? cle : ALIAS[cle] || 'graphite');
export const teintesMatiere = cle => NUANCIER[cleTeinte(cle)];

/* L'azur, du plus clair au plus foncé : 1 la piste d'une jauge, 2 et 3 les
   petites valeurs, 4 le trait courant, 5 ce qu'on met en avant, 6 un texte
   ou la valeur la plus haute. C'est l'azur de la page d'accueil. */
export const AZUR = ['#E8EEFE', '#C2D0F6', '#91A8EB', '#5B77D0', '#3950A5', '#243473'];

/* La mémoire d'une page, de « à lire » à « sue » : à lire n'a pas encore de
   couleur (rien n'est encore su), puis trois pas d'azur bien séparés — 3, 4
   et 6 (`MEMOIRE`, des rangs dans AZUR). app.css les reprend en jetons. */
export const MEMOIRE = { learn: 2, young: 3, mature: 5 };

/* Les états, assez sombres pour se lire en petit texte sur leur propre
   teinte (une pastille « En retard » : 13 % de la couleur sur le papier). */
export const ETATS = { ok: '#2A764A', ko: '#B24437', am: '#955C06' };
