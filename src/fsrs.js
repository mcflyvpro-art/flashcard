/* Le moteur de révision, séparé du reste de l'app pour être vérifiable
   morceau par morceau : ce fichier ne touche ni au DOM, ni au réseau, ni
   aux réglages. Tout ce dont il a besoin lui est passé (cfg : w, dr,
   maxIvl). Ses tests vivent dans test/fsrs.test.js. */
/* ══════════ FSRS ══════════
   Le moteur de révision de l'app est celui d'Anki, sans écart : FSRS-6
   (Free Spaced Repetition Scheduler) de Jarrett Ye, tel que le publie le
   crate `fsrs` 6.6.2 — la version exacte qu'Anki épingle dans son
   Cargo.toml. Rien n'est inventé ici, tout est porté fonction par
   fonction depuis le code de référence d'open-spaced-repetition :

   · mémoire — 21 paramètres, une courbe d'oubli en puissance :
     fsrs 6.6.2 src/inference.rs, et py-fsrs/fsrs/scheduler.py ;
   · machine d'états — paliers d'apprentissage, rechute, intervalle
     maximal, flou : py-fsrs/fsrs/scheduler.py ;
   · optimiseur — le crate lui-même, compilé pour le navigateur
     (fsrs.wasm, voir tools/BUILD-FSRS.md).

   Le jeu à 34 paramètres (FSRS-7, deux traces mémoire, porté depuis
   model_v7.rs) reste reconnu pour que l'app suive si l'amont le publie un
   jour : la version se choisit sur le nombre de paramètres, exactement
   comme `check_and_fill_parameters`. Le portage est vérifié contre py-fsrs
   (écart 2·10⁻⁸) et contre le code v7 compilé (2·10⁻⁵, l'écart f32/f64).

   Chaque fiche porte son état de mémoire :
   S = stabilité (jours avant d'oublier) · D = difficulté [1,10]
   F = seconde trace, égale à S en FSRS-6 · st = 1 apprentissage,
   2 révision, 3 rechute · sp = palier en cours · lr = dernière révision
   (ms) · d = échéance (ms) · i = dernier intervalle (jours)
   n = révisions · l = rechutes · x = mise de côté                        */
export const DAY = 864e5;
export const MIN = 6e4;

export const S_MIN = 0.0001, S_MAX = 36500, D_MIN = 1, D_MAX = 10;
export const DR_MIN = 0.0001, DR_MAX = 0.9999;
export const MIN_T = 1 / 86400, NEWTON_ITERS = 7, BISECT_ITERS = 50;
export const cl = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

/* Les paramètres par défaut du moteur, copiés de `DEFAULT_PARAMETERS`
   (fsrs 6.6.2, src/inference.rs) : exactement ceux d'Anki tant qu'on n'a
   pas assez d'historique pour en calculer de meilleurs. */
export const W6 = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
  0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912,
  0.0658, 0.1542];
/* Le jeu à 34 paramètres n'est pas celui d'Anki aujourd'hui ; il reste
   reconnu pour que l'app suive si l'amont le publie un jour. */
export const W7 = [0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0.0,
  1.3826, 0.7024, 0.5999, 0.8146, 0.6398, 1.0, 1.3207, 0.6707, 3.8668, 0.4416,
  0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145,
  0.0, 0.5667, 0.3734, 0.5333, 0.3048];

/* ---------- FSRS-7 : model_v7.rs ---------- */
export const f7initD = (w, g) => w[4] - Math.exp(w[5] * (g - 1)) + 1;
export function f7nextD(w, d, g, r) {
  g = cl(g, 1, 4);
  let delta = -w[6] * (g - 3);
  if (g === 1) delta *= r + 0.1;
  const nd = d + (10 - d) * delta / 9;                          // linear damping
  return cl(f7initD(w, 4) * 0.01 + nd * 0.99, D_MIN, D_MAX);    // mean reversion
}
/* Une seule fonction pour les deux traces : `start` vaut 7 pour la trace
   lente, 15 pour la rapide. */
export function f7setS(w, lastS, lastD, r, g, start) {
  g = cl(g, 1, 4);
  const hard = g === 2 ? w[start + 6] : 1, easy = g === 4 ? w[start + 7] : 1;
  const sFail = w[start + 3] * (Math.pow(lastS + 1, w[start + 4]) - 1)
              * Math.exp((1 - r) * w[start + 5]);
  const pls = Math.min(lastS, sFail);
  const sinc = Math.exp(w[start] - 1.5) * (11 - lastD) * Math.pow(lastS, -w[start + 1])
             * (Math.exp((1 - r) * w[start + 2]) - 1) * hard * easy + 1;
  return cl(g > 1 ? Math.max(pls, lastS * sinc) : pls, S_MIN, S_MAX);
}
export function f7fastR(w, t, sF) {
  t = Math.max(t, 0); sF = cl(sF, S_MIN, S_MAX);
  const dec = -cl(w[23] * Math.pow(sF, w[33] - 0.3), 0.01, 0.95);
  const fac = Math.exp(Math.min(Math.log(w[25]) / dec, 60)) - 1;
  return Math.pow(1 + fac * (t / sF), dec);
}
/* La courbe d'oubli : deux puissances mélangées, l'une portée par la trace
   rapide, l'autre par la lente, avec des poids qui dépendent de la
   stabilité et de la difficulté. C'est toute la nouveauté de FSRS-7 —
   FSRS-6 n'avait qu'une seule courbe. */
export function f7curve(w, t, m) {
  t = Math.max(t, 0);
  const s = Math.max(m.S, S_MIN), sf = Math.max(m.F, S_MIN), d = cl(m.D, D_MIN, D_MAX);
  const dec1 = -cl(w[23] * Math.pow(sf, w[33] - 0.3), 0.01, 0.95);
  const fac1 = Math.exp(Math.min(Math.log(w[25]) / dec1, 60)) - 1;
  const r1 = Math.pow(1 + fac1 * (t / sf), dec1);
  const dec2 = -cl(w[24], 0.01, 0.95);
  const fac2 = Math.pow(w[26], 1 / dec2) - 1;
  const dts = Math.exp((d - 5) * (w[32] - 0.3));
  const r2 = Math.pow(1 + fac2 * dts * (t / s), dec2);
  const w1 = w[27] * Math.pow(sf, -w[29]);
  const w2 = w[28] * Math.pow(s, w[30]) * Math.exp((d - 5) * (w[31] - 0.5));
  return ((w1 * r1 + w2 * r2) / (w1 + w2)) * (1 - 2e-5) + 1e-5;
}
export function f7curveD(w, t, m) {
  t = Math.max(t, 0);
  const s = Math.max(m.S, S_MIN), sf = Math.max(m.F, S_MIN), d = cl(m.D, D_MIN, D_MAX);
  const dec1 = -cl(w[23] * Math.pow(sf, w[33] - 0.3), 0.01, 0.95);
  const fac1 = Math.exp(Math.min(Math.log(w[25]) / dec1, 60)) - 1;
  const b1 = 1 + fac1 * (t / sf), r1 = Math.pow(b1, dec1);
  const d1 = dec1 * Math.pow(b1, dec1 - 1) * fac1 / sf;
  const dec2 = -cl(w[24], 0.01, 0.95);
  const fac2 = Math.pow(w[26], 1 / dec2) - 1;
  const dts = Math.exp((d - 5) * (w[32] - 0.3));
  const b2 = 1 + fac2 * dts * (t / s), r2 = Math.pow(b2, dec2);
  const d2 = dec2 * Math.pow(b2, dec2 - 1) * fac2 * dts / s;
  const w1 = w[27] * Math.pow(sf, -w[29]);
  const w2 = w[28] * Math.pow(s, w[30]) * Math.exp((d - 5) * (w[31] - 0.5));
  const sum = Math.max(w1 + w2, 1e-9);
  return [((w1 * r1 + w2 * r2) / sum) * (1 - 2e-5) + 1e-5,
          ((w1 * d1 + w2 * d2) / sum) * (1 - 2e-5)];
}
export function f7next(w, m, dt, g) {
  dt = Math.max(dt, 0); g = cl(g, 1, 4);
  const r = f7curve(w, dt, m);
  const slow = f7setS(w, m.S, m.D, r, g, 7);
  let fast = f7setS(w, m.F, m.D, f7fastR(w, dt, m.F), g, 15);
  if (g === 1) fast = Math.min(fast, slow * 0.8);
  return { S: slow, D: f7nextD(w, m.D, g, r), F: cl(fast, S_MIN, S_MAX) };
}
export function f7init(w, g) {
  g = cl(g, 1, 4);
  const s = cl(w[g - 1], S_MIN, S_MAX);
  return { S: s, D: cl(f7initD(w, g), D_MIN, D_MAX), F: cl(s * 0.8, S_MIN, S_MAX) };
}
export function f7bisect(w, m, dr) {
  let lo = 0, hi = Math.max(Math.max(m.S, m.F), 1);
  while (f7curve(w, hi, m) > dr && hi < S_MAX) hi = Math.min(hi * 2, S_MAX);
  for (let i = 0; i < BISECT_ITERS; i++) {
    const mid = (lo + hi) * .5;
    if (f7curve(w, mid, m) > dr) lo = mid; else hi = mid;
  }
  return cl((lo + hi) * .5, 0, S_MAX);
}
/* FSRS-7 n'a plus de forme fermée pour l'intervalle : on résout
   R(t) = rétention visée par Newton sur log(t), repli sur dichotomie. */
export function f7ivl(w, m, dr) {
  dr = cl(dr, DR_MIN, DR_MAX);
  if (dr >= DR_MAX) return 0;
  m = { S: cl(m.S, S_MIN, S_MAX), D: cl(m.D, D_MIN, D_MAX), F: cl(m.F, S_MIN, S_MAX) };
  const loL = Math.log(MIN_T), hiL = Math.log(S_MAX);
  let logT = Math.log(Math.max(Math.max(m.S, m.F), MIN_T));
  for (let i = 0; i < NEWTON_ITERS; i++) {
    logT = cl(logT, loL, hiL);
    const t = cl(Math.exp(logT), MIN_T, S_MAX);
    const [r, der] = f7curveD(w, t, m);
    logT -= cl((r - dr) / Math.min(der * t, -1e-12), -4, 4);
    if (!isFinite(logT)) return f7bisect(w, m, dr);
  }
  const ivl = cl(Math.exp(logT), 0, S_MAX);
  const r = f7curve(w, ivl, m);
  return isFinite(r) && Math.abs(r - dr) <= 1e-3 ? ivl : f7bisect(w, m, dr);
}

/* ---------- FSRS-6 : py-fsrs/fsrs/scheduler.py ---------- */
export const f6dec = w => -w[20];
export const f6fac = w => Math.pow(0.9, 1 / f6dec(w)) - 1;
export const f6curve = (w, t, m) => Math.pow(1 + f6fac(w) * Math.max(t, 0) / m.S, f6dec(w));
export const f6initD = (w, g) => w[4] - Math.exp(w[5] * (g - 1)) + 1;
export const f6nextD = (w, d, g) => cl(w[7] * f6initD(w, 4)
  + (1 - w[7]) * (d + (10 - d) * (-(w[6] * (g - 3))) / 9), D_MIN, D_MAX);
export function f6shortS(w, s, g) {
  let inc = Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]);
  if (g >= 2) inc = Math.max(inc, 1);
  return Math.max(s * inc, S_MIN);
}
export function f6next(w, m, dt, g) {
  const r = f6curve(w, dt, m);
  let S;
  if (g === 1) S = Math.min(w[11] * Math.pow(m.D, -w[12]) * (Math.pow(m.S + 1, w[13]) - 1)
      * Math.exp((1 - r) * w[14]), m.S / Math.exp(w[17] * w[18]));
  else S = m.S * (1 + Math.exp(w[8]) * (11 - m.D) * Math.pow(m.S, -w[9])
      * (Math.exp((1 - r) * w[10]) - 1) * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1));
  S = Math.max(S, S_MIN);
  return { S, D: f6nextD(w, m.D, g), F: S };
}
export const f6init = (w, g) => {
  const s = Math.max(w[g - 1], S_MIN);
  return { S: s, D: cl(f6initD(w, g), D_MIN, D_MAX), F: s };
};


/* ---------- façade ---------- */
export const isV7 = w => w.length === 34;
export const LEARN_STEPS = [1, 10];          // paliers d'apprentissage, en minutes
export const RELEARN_STEPS = [10];           // palier de rechute
export const fsrsInit = (w, g) => isV7(w) ? f7init(w, g) : f6init(w, g);
export const fsrsStep = (w, m, dt, g) => isV7(w) ? f7next(w, m, dt, g)
  : (dt < 1 ? { S: f6shortS(w, m.S, g), D: f6nextD(w, m.D, g), F: f6shortS(w, m.S, g) }
            : f6next(w, m, dt, g));
export const fsrsR = (w, t, m) => isV7(w) ? f7curve(w, t, m) : f6curve(w, t, m);
export const fsrsIvl = (w, m, dr) => isV7(w) ? f7ivl(w, m, dr)
  : (m.S / f6fac(w)) * (Math.pow(dr, 1 / f6dec(w)) - 1);

/* Flou : py-fsrs tire au hasard dans une fourchette autour de
   l'intervalle, pour éviter que des fiches apprises le même jour
   reviennent toutes le même jour. Ici le tirage est dérivé de la fiche :
   l'aperçu sur les boutons annonce donc exactement ce qui arrivera. */
export const FUZZ = [[2.5, 7, .15], [7, 20, .1], [20, Infinity, .05]];
export function fuzzSeed(c, g) {
  let h = 2166136261;
  const k = String(c.id || '') + ':' + (c.n || 0) + ':' + g;
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
export function fuzzIvl(ivl, maxIvl, rnd) {
  if (ivl < 2.5) return ivl;
  let delta = 1;
  for (const [a, b, f] of FUZZ) delta += f * Math.max(Math.min(ivl, b) - a, 0);
  let lo = Math.max(2, Math.round(ivl - delta)), hi = Math.min(Math.round(ivl + delta), maxIvl);
  lo = Math.min(lo, hi);
  return Math.min(Math.round(rnd * (hi - lo + 1) + lo), maxIvl);
}

/* ---------- la machine d'états, port de py-fsrs ---------- */
/* rating de l'app : 0 encore · 1 difficile · 2 correct · 3 facile
   FSRS attend 1..4 — la conversion se fait ici, et nulle part ailleurs. */
export function fsrsPlan(c, rating, now, cfg, fuzzy) {
  const w = cfg.w, dr = cfg.dr, maxIvl = cfg.maxIvl;
  const g = cl((rating | 0) + 1, 1, 4);
  const since = c.lr ? Math.max(0, Math.floor((now - c.lr) / DAY)) : 0;
  const m = c.S ? fsrsStep(w, { S: c.S, D: c.D || 5, F: c.F || c.S }, since, g)
                : fsrsInit(w, g);
  let st = c.st || 1, sp = c.sp == null ? null : c.sp, mins = null, days = null;
  const toReview = () => {
    st = 2; sp = null;
    days = Math.min(Math.max(Math.round(fsrsIvl(w, m, dr)), 1), maxIvl);
  };
  if (st === 1 || st === 3) {
    const S = st === 3 ? RELEARN_STEPS : LEARN_STEPS;
    if (sp == null) sp = 0;
    if (!S.length || (sp >= S.length && g >= 2)) toReview();
    else if (g === 1) { sp = 0; mins = S[0]; }
    else if (g === 2) mins = sp === 0 ? (S.length === 1 ? S[0] * 1.5 : (S[0] + S[1]) / 2) : S[sp];
    else if (g === 3) { if (sp + 1 === S.length) toReview(); else mins = S[++sp]; }
    else toReview();
  } else if (g === 1) {
    if (!RELEARN_STEPS.length) days = Math.min(Math.max(Math.round(fsrsIvl(w, m, dr)), 1), maxIvl);
    else { st = 3; sp = 0; mins = RELEARN_STEPS[0]; }
  } else days = Math.min(Math.max(Math.round(fsrsIvl(w, m, dr)), 1), maxIvl);
  if (days != null && fuzzy !== false && st === 2) days = fuzzIvl(days, maxIvl, fuzzSeed(c, g));
  return { S: m.S, D: m.D, F: m.F, st, sp, ivl: days || 0,
           d: now + (days != null ? days * DAY : mins * MIN) };
}

/* ---------- l'ordre des quatre boutons ----------
   Anki calcule les quatre réponses ensemble, puis impose qu'elles se
   suivent : « Difficile » ne peut pas envoyer la fiche plus loin que
   « Correct », ni « Correct » plus loin que « Facile ». Sans cette passe,
   le flou — qui tire indépendamment pour chaque note — produisait des
   propositions absurdes du genre difficile 3 j, facile 1 j.

   Un palier d'apprentissage se compte en minutes et une révision en
   jours : on ne compare donc que deux notes qui sont toutes deux en
   révision (st === 2). */
export function fsrsStates(c, now, cfg) {
  const s = [0, 1, 2, 3].map(g => fsrsPlan(c, g, now, cfg, true));
  for (let g = 1; g < 4; g++) {
    const av = s[g - 1], ici = s[g];
    if (av.st === 2 && ici.st === 2 && ici.ivl <= av.ivl) {
      ici.ivl = Math.min(av.ivl + 1, cfg.maxIvl);
      ici.d = now + ici.ivl * DAY;
    }
  }
  return s;
}
