/* ══════════ « J'ai un code » : un seul champ pour tous les codes (2026-11-16) ══════════
   Demandé : « J'ai un code doit être universel : tous les types de code
   fonctionnent, et ça s'adapte au code ». Un code de club tapé là partait
   sur « Ma classe » avec « Code incorrect ».

   Ce qu'on tape, ou ce qu'on colle — le code seul, un lien, un message
   entier (« Rejoins … : code 47HW-ZKA9, dans Mes amis › Entrer un code ») —
   se reconnaît à sa forme :
   — six chiffres : une partie en direct (src/defi.js) ;
   — dix signes : un paquet partagé (src/livre-code.js) ;
   — « @pseudo » : un ami (sa forme seulement : la base dit s'il existe) ;
   — huit signes : un établissement, un professeur particulier, une classe
     ou un club — même forme, même alphabet : la base seule sait lequel
     (ui/code-entree.js demande d'abord à l'établissement, puis au club).
   Un lien dit ce qu'il est (`?defi=`, `#s=`, `?ami=`, `?club=`, `?rejoindre=`).
   Pur : ni DOM, ni réseau. Testé dans test/codes.test.js. */
import { codeComplet, formatCode, normCode } from './classe.js';
import { pinComplet, pinDepuisTexte, pinLisible } from './defi.js';
import { codeLivre, tokComplet, tokDepuisTexte } from './livre-code.js';

const partie = s => ({ genre: 'partie', valeur: pinDepuisTexte(s), lisible: pinLisible(s), complet: pinComplet(s) });
const paquet = s => {
  const t = tokDepuisTexte(s);
  return { genre: 'paquet', valeur: t, lisible: codeLivre(t), complet: tokComplet(t) };
};
const code = (s, club = false) => ({ genre: 'code', valeur: normCode(s), lisible: formatCode(s), complet: codeComplet(s), club });
const ami = s => {
  const p = String(s || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
  return { genre: 'ami', valeur: p, lisible: '@' + p, complet: /^[a-z][a-z0-9._]{2,19}$/.test(p) };
};

/* Un message collé : le premier code qu'on y reconnaît, du plus long au
   plus court (un code de paquet contient un code de huit). */
function dansUnMessage(t) {
  let m;
  if ((m = /(?:^|[^A-Za-z0-9])([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{2})(?![A-Za-z0-9])/.exec(t))) return paquet(m[1]);
  if ((m = /(?:^|[^A-Za-z0-9])([A-Za-z0-9]{4}-?[A-Za-z0-9]{4})(?![A-Za-z0-9-])/.exec(t)) && /[A-Za-z]/.test(m[1])) return code(m[1]);
  if ((m = /(?:^|\D)(\d{3} ?\d{3})(?!\d)/.exec(t))) return partie(m[1]);
  if ((m = /@([A-Za-z][A-Za-z0-9._]{2,19})/.exec(t))) return ami(m[1]);
  return null;
}

/** @param {string} texte @returns {{ genre: string, valeur: string, lisible: string, complet: boolean, club?: boolean }} */
export function quelCode(texte) {
  const t = String(texte || '').trim();
  let m;
  // un lien (seul ou dans un message) dit ce qu'il est
  if ((m = /[?&]ami=@?([A-Za-z0-9._]+)/.exec(t))) return ami(m[1]);
  if (/[?&]defi=/.test(t)) return partie(t);
  if (/[#?&](?:s|livre)=/.test(t)) return paquet(t);
  if ((m = /[?&]club=([A-Za-z0-9-]+)/.exec(t))) return code(m[1], true);
  if ((m = /[?&]rejoindre=([A-Za-z0-9-]+)/.exec(t))) return code(m[1]);
  if (t.startsWith('@')) return ami(t.slice(1));
  // un message : des mots autour du code (un code de partie s'écrit « 123 456 »)
  if (/\s/.test(t) && !/^\d{3} \d{0,3}$/.test(t)) {
    const d = dansUnMessage(t);
    if (d) return d;
  }
  // ce qu'on tape, signe après signe
  const k = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d{1,6}$/.test(k)) return partie(k);
  if (k.length > 8) return paquet(k);
  return code(k);
}
