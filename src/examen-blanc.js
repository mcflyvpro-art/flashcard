/* L'examen blanc (Mirandola Infini, 2026-11-06), sans dépendance : l'IA
   compose un sujet à partir des pages d'un livre, l'élève répond — au
   clavier, ou sur papier qu'il photographie —, puis l'IA corrige. Ici, tout
   ce qui se décide sans elle : quelles pages lui donner, comment lire ce
   qu'elle rend (jamais tel quel : une réponse de modèle se vérifie), la
   note sur 20, les pages à revoir, ce qu'on garde en base, l'historique.

   La correction ne commente pas ce qui est juste : une bonne réponse est
   cochée, rien de plus. Une réponse fausse ou incomplète a la correction
   attendue et un conseil — c'est là que l'élève apprend quelque chose. */

export const NOMBRES = [10, 20];          // questions proposées
export const MIN_PAGES = 5;               // en dessous, pas d'examen blanc
export const MAX_ENVOI = 300;             // pages données à l'IA pour composer
export const MAX_ENVOI_OFFERT = 120;      // un examen offert (Mirandola gratuit, Mirandola+) : celle de la fonction ai
export const MAX_PHOTOS = 8;              // pages de copie manuscrite
export const MAX_REPONSE = 1500;          // caractères d'une réponse tapée
const MAX_TEXTE = 600;

const propre = (v, n = MAX_TEXTE) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

// un livre peut-il porter un examen blanc, et de combien de questions
export function questionsPossibles(cartes) {
  const n = (cartes || []).filter(c => !c.x && c.f && c.b).length;
  if (n < MIN_PAGES) return [];
  const opts = NOMBRES.filter(k => k <= n);
  return opts.length ? opts : [n];
}

/* Les pages données à l'IA pour composer : d'abord celles qui résistent —
   ratées souvent, oubliées vite, jamais lues —, puis les autres, dans la
   limite de MAX_ENVOI. Chacune garde son rang dans la liste (`i`), par
   lequel l'IA dit d'où vient chaque question. */
export function pagesPourSujet(cartes, max = MAX_ENVOI) {
  const poids = c => (c.l || 0) * 3 + (c.S ? Math.max(0, 30 - c.S) / 10 : 4);
  return (cartes || [])
    .filter(c => !c.x && c.f && c.b)
    .map((c, k) => ({ c, k, p: poids(c) }))
    .sort((a, b) => b.p - a.p || a.k - b.k)
    .slice(0, max)
    .map(({ c }, i) => ({ i, id: c.id, f: propre(c.f), b: propre(c.b) }));
}

/* Le sujet rendu par l'IA, vérifié : au plus `n` questions non vides, des
   renvois vers des pages qui existent. */
export function lireSujet(raw, envoyees, n) {
  const qs = raw && Array.isArray(raw.questions) ? raw.questions : [];
  const max = envoyees.length;
  return qs.map(q => ({
    q: propre(q && q.q),
    attendu: propre(q && q.attendu),
    pages: [...new Set((Array.isArray(q && q.pages) ? q.pages : [])
      .map(Number).filter(x => Number.isInteger(x) && x >= 0 && x < max))].slice(0, 5)
  })).filter(q => q.q && q.attendu).slice(0, n);
}

// la note sur 20, au demi-point
export const surVingt = (points, sur) => (sur > 0 ? Math.round((points / sur) * 40) / 2 : 0);
export const noteLisible = n => String(n).replace('.', ',');

/* La correction rendue par l'IA, vérifiée question par question : points
   bornés à leur barème, une réponse « juste » n'emporte ni correction ni
   conseil (on ne commente pas ce qui est bien), une réponse fausse garde
   les siens. Une question oubliée par l'IA compte faux, sans conseil
   inventé. Rend aussi la note, le compte des justes et les pages à revoir
   (identifiants de cartes, sans doublon). */
export function lireCorrection(raw, sujet, envoyees) {
  const items = raw && Array.isArray(raw.questions) ? raw.questions : [];
  let points = 0, sur = 0, justes = 0;
  const revoir = [];
  const questions = sujet.map((q, k) => {
    const x = items[k] || {};
    const bareme = Math.max(1, Math.min(4, Math.round(Number(x.sur) || 1)));
    const pts = Math.max(0, Math.min(bareme, Math.round((Number(x.points) || 0) * 2) / 2));
    const ok = x.ok === true && pts >= bareme;
    points += pts; sur += bareme;
    if (ok) justes++;
    else for (const i of q.pages) { const p = envoyees[i]; if (p && !revoir.includes(p.id)) revoir.push(p.id); }
    return {
      q: q.q, attendu: q.attendu, lu: propre(x.lu, MAX_REPONSE), ok, points: pts, sur: bareme,
      correction: ok ? '' : propre(x.correction) || q.attendu,
      conseil: ok ? '' : propre(x.conseil, 300)
    };
  });
  return { questions, points, sur, note: surVingt(points, sur), justes, revoir, bilan: propre(raw && raw.bilan, 400) };
}

/* Ce qu'on garde en base (table `examens`) : la note, le compte, et le
   détail en texte — jamais une photo de copie, qui ne quitte pas l'appareil
   au-delà de la correction. */
export function ligneExamen(deckId, resultat, copie, at) {
  return {
    deck_id: deckId,
    created_at: new Date(at).toISOString(),
    note: resultat.note,
    questions: resultat.questions.length,
    justes: resultat.justes,
    copie: copie === 'photo' ? 'photo' : 'clavier',
    detail: { questions: resultat.questions, bilan: resultat.bilan, revoir: resultat.revoir }
  };
}

/* L'historique d'un livre, du plus récent au plus ancien : la dernière
   note, l'écart avec la précédente, la meilleure, et les dernières notes
   dans l'ordre du temps (pour une petite courbe). */
export function tendance(examens) {
  const xs = (examens || []).filter(e => typeof e.note === 'number')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!xs.length) return null;
  const [dernier, avant] = xs;
  return {
    derniere: dernier.note,
    ecart: avant ? Math.round((dernier.note - avant.note) * 2) / 2 : null,
    meilleure: Math.max(...xs.map(e => e.note)),
    nombre: xs.length,
    courbe: xs.slice(0, 8).reverse().map(e => e.note)
  };
}
