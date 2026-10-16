/* Un texte « tel qu'on le lit » : casse, espaces, apostrophes typographiques
   et ponctuation finale mis de côté. Sert à comparer une réponse tapée
   (quiz) et à reconnaître deux cartes identiques (doublons, M04.T4).
   Sans aucune dépendance, exprès (voir CLAUDE.md, src/racine.js) : il est
   lu par un écran ET par le noyau pur. */
export const norm = s => String(s).trim().toLowerCase()
  .replace(/[’‘‛´`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.…]+$/, '').trim();
