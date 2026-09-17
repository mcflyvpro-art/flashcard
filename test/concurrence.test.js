/* M03.T5 — simulateur de concurrence : deux appareils travaillent hors
   ligne sur le même paquet et se reconnectent à des moments aléatoires,
   parfois l'un pendant que l'autre est encore hors ligne. M03.T4 a déjà
   prouvé, carte par carte, que la fusion (`src/fusion.js`) ne demande
   jamais rien (200 scénarios écrits à la main). Ce que ce fichier prouve
   en plus, c'est le comportement à l'échelle : sur 10 000 opérations et
   des milliers de reconnexions désordonnées, les deux appareils et le
   serveur finissent toujours, sans exception, par converger vers
   exactement le même paquet — la cible « 0 divergence » de PROGRESS.md.

   Déterministe : un seul générateur pseudo-aléatoire à graine fixe, pour
   qu'un échec soit reproductible bit à bit plutôt qu'un flake.

   Pur comme fusion.js : aucune règle métier n'est réécrite ici. Les
   valeurs de mémoire FSRS (S, D, F...) sont tirées au hasard — leur
   calcul est déjà couvert par fsrs.test.js et revlog.test.js — seul
   compte ici leur transport correct à travers la fusion. */
import { describe, it, expect } from 'vitest';
import { mergeDeck } from '../src/fusion.js';

// mulberry32 : PRNG rapide et suffisant pour une simulation, pas pour de la crypto.
function mulberry32(graine) {
  let s = graine | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clone = o => JSON.parse(JSON.stringify(o));

/* Égalité insensible à l'ordre : deux appareils qui convergent vers le
   même contenu n'ont aucune raison de ranger `cards` dans le même ordre
   — chacun l'a reconstruit à partir de fusions successives différentes.
   Ce qui compte, c'est l'ensemble des cartes et leur contenu, jamais
   leur position dans le tableau ; comparer par `JSON.stringify` brut
   confondrait un vrai réordonnancement anodin avec une divergence. */
function egal(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => egal(v, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && egal(a[k], b[k]));
}
function paquetsEgaux(a, b) {
  const { cards: ca, ...ra } = a, { cards: cb, ...rb } = b;
  if (!egal(ra, rb)) return false;
  if (ca.length !== cb.length) return false;
  const parId = arr => new Map(arr.map(c => [c.id, c]));
  const ma = parId(ca), mb = parId(cb);
  if (ma.size !== mb.size) return false;
  for (const [id, c] of ma) { if (!mb.has(id) || !egal(c, mb.get(id))) return false; }
  return true;
}

function paquetInitial() {
  return {
    name: 'Paquet partagé', subject: 'histoire', hidden: false, pinned: false,
    meta: { tolerance: 'normal' },
    cards: Array.from({ length: 20 }, (_, i) => ({
      id: 'init-' + i, f: 'recto ' + i, b: 'verso ' + i, x: null,
      S: 2.5, D: 5, F: 1, st: 1, sp: null, d: 0, lr: 0, i: 1, n: 0, l: 0,
    })),
  };
}

/* Un appareil : son dernier point d'accord avec le serveur (`base`) et
   son état de travail hors ligne (`local`), qui divergent librement
   jusqu'à la prochaine synchronisation. */
function appareil(deck) {
  return { base: clone(deck), local: clone(deck) };
}

function synchronise(dispositif, serveur) {
  const { deck, notes } = mergeDeck(dispositif.base, dispositif.local, serveur.deck);
  dispositif.base = clone(deck);
  dispositif.local = clone(deck);
  serveur.deck = clone(deck);
  return notes;
}

/* Une opération hors ligne d'un appareil sur son propre exemplaire.
   Révision et édition dominent (le gros du trafic réel), création et
   suppression sont plus rares, un toggle de réglage de paquet de temps
   en temps pour exercer aussi la fusion au niveau du paquet. */
function opere(dispositif, rng, horloge, etiquette) {
  const cartes = dispositif.local.cards;
  const roll = rng();
  if (roll < 0.35 && cartes.length) {
    const c = cartes[Math.floor(rng() * cartes.length)];
    c.n += 1; c.lr = ++horloge.t;
    c.S = +(rng() * 10).toFixed(3); c.D = +(1 + rng() * 9).toFixed(3); c.F = +(rng() * 5).toFixed(3);
    if (rng() < 0.15) c.l += 1;
  } else if (roll < 0.65 && cartes.length) {
    const c = cartes[Math.floor(rng() * cartes.length)];
    c.f = `édité par ${etiquette} #${++horloge.t}`;
  } else if (roll < 0.80) {
    cartes.push({
      id: `${etiquette}-${++horloge.seq}`, f: 'nouvelle face', b: 'nouvelle réponse', x: null,
      S: 2.5, D: 5, F: 1, st: 1, sp: null, d: 0, lr: ++horloge.t, i: 1, n: 0, l: 0,
    });
  } else if (roll < 0.95 && cartes.length) {
    cartes.splice(Math.floor(rng() * cartes.length), 1);
  } else {
    dispositif.local.pinned = !dispositif.local.pinned;
    dispositif.local.name = `Paquet partagé (${etiquette} #${++horloge.t})`;
  }
}

describe('M03.T5 — simulateur de concurrence (2 appareils, hors ligne, reconnexion)', () => {
  it('10 000 opérations, reconnexions aléatoires désordonnées : convergence totale, jamais de plantage', () => {
    const rng = mulberry32(20260918);
    const horloge = { t: 0, seq: 0 };
    const initial = paquetInitial();
    const serveur = { deck: clone(initial) };
    const A = appareil(initial), B = appareil(initial);

    const N = 10000;
    let syncs = 0, checkpoints = 0, notesTotal = 0;

    for (let i = 1; i <= N; i++) {
      const surA = rng() < 0.5;
      opere(surA ? A : B, rng, horloge, surA ? 'A' : 'B');

      // Reconnexion aléatoire et indépendante pour chaque appareil :
      // parfois aucun des deux, parfois les deux au même pas, dans un
      // ordre qui n'est jamais garanti — exactement le hasard d'un
      // établissement où les postes reprennent le réseau au fil de
      // l'eau, pas tous en même temps.
      if (rng() < 0.12) { notesTotal += synchronise(A, serveur).length; syncs++; }
      if (rng() < 0.12) { notesTotal += synchronise(B, serveur).length; syncs++; }

      // Point de calme périodique : les deux appareils se reconnectent
      // l'un après l'autre sans rien faire entre-temps — le cas réel
      // du matin où tout le monde retrouve le réseau. À cet instant,
      // aucune divergence ne doit subsister entre A, B et le serveur.
      if (i % 500 === 0) {
        synchronise(A, serveur);
        synchronise(B, serveur);
        synchronise(A, serveur);   // A rattrape ce que B vient d'apporter
        checkpoints++;
        expect(paquetsEgaux(A.local, serveur.deck), `divergence au point de calme i=${i}`).toBe(true);
        expect(paquetsEgaux(B.local, serveur.deck), `divergence au point de calme i=${i}`).toBe(true);
        // Idempotence : se reconnecter à nouveau sans rien changer entre
        // les deux appels ne doit plus rien produire.
        const avant = clone(serveur.deck);
        synchronise(A, serveur); synchronise(B, serveur);
        expect(paquetsEgaux(serveur.deck, avant), `sync non idempotente au point de calme i=${i}`).toBe(true);
      }
    }

    // Fin de partie : plus aucune opération, on vidange jusqu'à ce que les
    // trois copies (A, B, serveur) soient identiques au bit près.
    synchronise(A, serveur);
    synchronise(B, serveur);
    synchronise(A, serveur);

    expect(paquetsEgaux(A.local, serveur.deck)).toBe(true);
    expect(paquetsEgaux(B.local, serveur.deck)).toBe(true);
    expect(paquetsEgaux(A.local, B.local)).toBe(true);

    // Une reconnexion de plus ne doit plus rien produire : point fixe atteint.
    const avantDernier = clone(serveur.deck);
    synchronise(A, serveur); synchronise(B, serveur);
    expect(paquetsEgaux(serveur.deck, avantDernier)).toBe(true);

    // Le hasard a bien produit de vraies reconnexions désordonnées et de
    // vrais conflits tranchés, pas un déroulé dégénéré qui ne prouverait
    // rien.
    expect(syncs).toBeGreaterThan(1000);
    expect(checkpoints).toBe(20);
    expect(notesTotal).toBeGreaterThan(0);
  });
});
