/* L'IA du mois et la fonction `ai`, rejouées en mémoire (2026-10-29) pour les
   parcours e2e : `mon_ia` (migration 20261029130000) et une fausse fonction
   `ai` qui ne parle à aucun modèle. Elle compte comme la vraie — une ligne
   d'`ai_usage` par appel, le quota de la licence sinon celui de l'offre,
   « plus » pour Mirandola gratuit, « mquota » au-delà — et répond de façon
   prévisible, pour qu'un parcours sache ce qu'il doit voir :
   - une ligne « mot = réponse » (ou « : », tabulation) fait une page ;
   - « inverse… » échange recto et verso de toutes les pages ;
   - « enlève X » retire les pages qui parlent de X ;
   - sinon les pages du message s'ajoutent à celles qui sont là.
   `store.iaPanne` joue une panne de la vraie (« credit », « surcharge »).
   La démo sans compte ne l'appelle jamais (l'IA y est fermée). */
import { modele } from './classes.js';
import { etab, orgDe } from './etablissement.js';
import { licenceProf } from './licences.js';
import { offreDe } from './abonnements.js';

const auj = () => new Date().toISOString().slice(0, 10);
const usage = store => (store.tables.ai_usage = store.tables.ai_usage || []);
const faitDuMois = (store, uid) => usage(store).filter(a => a.user_id === uid && a.day >= auj().slice(0, 8) + '01').length;

/* ia_quota : celui d'un établissement, d'un professeur particulier sous
   licence, ou de l'élève d'un tel professeur ; nul sinon. */
function iaQuota(store, uid) {
  const m = modele(store), role = m.roles[uid] || 'eleve';
  const o = orgDe(etab(store), uid);
  if (o && (!o.fin || o.fin >= auj())) return role === 'eleve' ? (o.ia_eleve ?? 30) : (o.ia_prof ?? 400);
  const l = licenceProf(store, uid);
  if (l) return l.ia_prof;
  const c = m.classes.find(k => !k.org && !k.archivee && licenceProf(store, k.owner)
    && [...m.membres, ...m.demandes].some(x => x.cid === k.id && x.uid === uid));
  return c ? licenceProf(store, c.owner).ia_eleve : null;
}

export function monIa(store, uid) {
  const q = iaQuota(store, uid), offre = offreDe(store, uid);
  const prof = ['prof', 'ref', 'admin'].includes(modele(store).roles[uid]);
  return { fait: faitDuMois(store, uid), quota: q ?? (offre === 'gratuit' ? 0 : prof ? 400 : 30), licence: q != null, offre };
}

export const rpcIa = (store, nom, user) => (nom === 'mon_ia' ? [200, monIa(store, user.id)] : null);

/* Les lignes « recto = verso » d'un texte. */
const lignes = t => String(t || '').split(/\n+/)
  .map(l => l.split(/\s*(?:\t|=|:)\s*/))
  .filter(p => p.length >= 2 && p[0].trim() && p[1].trim())
  .map(([f, ...r]) => ({ f: f.trim(), b: r.join(' ').trim() }));

function retoucher(cartes, msg) {
  if (/invers|change le sens|échange/i.test(msg)) {
    return { cards: cartes.map(c => ({ f: c.b, b: c.f })), note: `J’ai inversé recto et verso de ${cartes.length} pages.` };
  }
  const enlever = msg.match(/^\s*(?:enl[eè]ve|supprime|retire)\s+(.+)$/i);
  if (enlever) {
    const mot = enlever[1].trim().toLowerCase();
    const reste = cartes.filter(c => !`${c.f} ${c.b}`.toLowerCase().includes(mot));
    return { cards: reste, note: `J’ai retiré ${cartes.length - reste.length} page(s), il en reste ${reste.length}.` };
  }
  const nouvelles = lignes(msg);
  const cards = cartes.concat(nouvelles);
  return { cards, note: `${cards.length} pages${nouvelles.length && cartes.length ? `, dont ${nouvelles.length} ajoutées` : ''}.` };
}

export function aiFaux(store, b, user) {
  const ia = monIa(store, user.id);
  if (ia.offre === 'gratuit') return [402, { error: 'plus' }];
  const mois = { fait: ia.fait, quota: ia.quota };
  if (ia.fait >= ia.quota) return [429, { error: 'mquota', quota: ia.quota, mois }];
  // une panne jouée par un parcours (store.iaPanne : « credit », « surcharge »…) : rien n'est compté, comme en vrai
  if (store.iaPanne) return [503, { error: store.iaPanne, mois }];
  const op = String(b.op || '');
  let r;
  if (op === 'prompt') r = retoucher((b.cards || []).map(c => ({ f: String(c.f || ''), b: String(c.b || '') })), String(b.message || ''));
  else if (op === 'cards') r = { cards: lignes(b.text), note: '' };
  else r = { cards: [{ f: 'Page lue', b: 'Sur la photo' }], note: '' };
  usage(store).push({ user_id: user.id, day: auj(), op, cents: 0.4 });
  mois.fait += 1;
  if (!r.cards.length && op !== 'prompt') return [422, { error: 'empty', mois }];
  return [200, { cards: r.cards, note: r.note, mois }];
}
