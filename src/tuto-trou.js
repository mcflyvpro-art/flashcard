/* ══════════ le tuto : la géométrie du voile (2026-10-29) ══════════
   Ce que dessine ui/tuto.js à chaque image, en nombres seulement : le
   chemin du voile percé d'un trou aux coins de ce qu'il montre, le trou qui
   glisse d'une forme à l'autre ou s'ouvre depuis son centre, la place de la
   bulle. Sans dépendance, pur, testé dans test/tuto.test.js.

   Une forme : { x, y, w, h, r: [haut gauche, haut droit, bas droit, bas gauche] },
   en pixels de l'écran. */

/* l'accélération d'un glissement : vite au départ, posé à l'arrivée */
export const doux = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

export const mix = (a, b, p) => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p,
  h: a.h + (b.h - a.h) * p, r: a.r.map((v, i) => v + (b.r[i] - v) * p) });

/* d'où s'ouvre un trou : le même, resserré sur son centre */
export const resserre = (f, k = .62) => ({ x: f.x + f.w * (1 - k) / 2, y: f.y + f.h * (1 - k) / 2, w: f.w * k, h: f.h * k,
  r: f.r.map(v => v * k) });

/* La boîte de ce qu'on montre, rognée à l'écran, et ses coins (un coin en
   pourcentage s'écrit négatif : -50 pour 50 %), jamais plus que la moitié
   du plus petit côté. */
export function forme(b, W, H, coins = [0, 0, 0, 0]) {
  const x = Math.max(0, b.left), y = Math.max(0, b.top);
  const w = Math.max(0, Math.min(W, b.right) - x), h = Math.max(0, Math.min(H, b.bottom) - y);
  const m = Math.min(w, h) / 2;
  return { x, y, w, h, r: coins.map(c => Math.min(m, c < 0 ? -c / 100 * Math.min(w, h) : c)) };
}

const arr = v => Math.round(v * 10) / 10;

/* Le voile : tout l'écran, percé du trou (règle evenodd). Sans trou (fermé,
   ou trop petit pour se voir), l'écran entier. */
export function chemin(W, H, f) {
  const out = `M0 0H${W}V${H}H0Z`;
  if (!f || f.w < 1 || f.h < 1) return out;
  const { x, y, w, h } = f, [a, b, c, d] = f.r.map(arr);
  return out + `M${arr(x + a)} ${arr(y)}H${arr(x + w - b)}A${b} ${b} 0 0 1 ${arr(x + w)} ${arr(y + b)}V${arr(y + h - c)}`
    + `A${c} ${c} 0 0 1 ${arr(x + w - c)} ${arr(y + h)}H${arr(x + d)}A${d} ${d} 0 0 1 ${arr(x)} ${arr(y + h - d)}V${arr(y + a)}`
    + `A${a} ${a} 0 0 1 ${arr(x + a)} ${arr(y)}Z`;
}

/* La bulle au téléphone : toute la largeur, sous le trou ou dessus. Le côté
   choisi (`cote`) reste tant qu'il tient ; un trou qui grandit (des pages
   qui s'ajoutent) la laisse de son côté, rognée au bord de l'écran, tant
   qu'elle ne couvre pas plus de 32 px de l'anneau : elle ne saute pas d'un
   bord à l'autre. Un trou qui prend tout l'écran (une feuille) : en haut ou
   en bas, loin de l'anneau. Rend { y, cote }. */
export function placeTel(box, anneau, bh, H, cote, g = 12) {
  const bas = box.y + box.h + g, haut = box.y - bh - g;
  const couvre = y => Math.max(0, Math.min(y + bh, anneau.y + anneau.h) - Math.max(y, anneau.y));
  const yBas = Math.min(bas, H - bh - g), yHaut = Math.max(haut, g);
  if (cote === 'bas' && couvre(yBas) <= 32) return { y: yBas, cote };
  if (cote === 'haut' && couvre(yHaut) <= 32) return { y: yHaut, cote };
  if (bas + bh <= H - g) return { y: bas, cote: 'bas' };
  if (haut >= g) return { y: haut, cote: 'haut' };
  return { y: anneau.y + anneau.h / 2 > H / 2 ? g + 6 : H - bh - g - 8, cote: 'dessus' };
}

/* Sur ordinateur : sous le trou, dessus, à droite, à gauche — la première
   place où elle tient entière ; sinon dans le coin. Rend [x, y]. */
export function placePc(box, bw, bh, W, H, g = 12) {
  const centre = Math.min(Math.max(g, box.x + box.w / 2 - bw / 2), W - bw - g);
  const cote = Math.min(Math.max(g, box.y), H - bh - g);
  const essais = [[centre, box.y + box.h + 14], [centre, box.y - bh - 14], [box.x + box.w + 16, cote], [box.x - bw - 16, cote]];
  return essais.find(([X, Y]) => X >= g && Y >= g && X + bw <= W - g && Y + bh <= H - g) || [W - bw - 24, H - bh - 24];
}
