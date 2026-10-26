// Le journal de lecture, rejoué en mémoire pour les parcours (2026-10-25) :
// le déclencheur `contexte_revision` (une ligne arrivée sans contexte le
// reçoit depuis son paquet, l'écart se lit dans le journal, une date future
// est ramenée à maintenant) et la fonction `journal()` (comptes regroupés
// par jour dans le fuseau demandé, matière, livre, palier ; `connus`). Même
// contrat que la vraie migration 20261025170855 ; la sécurité et le SQL se
// prouvent en base (supabase/tests/journal.sql).

const JOUR = 864e5;

export function contexteRevision(store, r) {
  const t = Date.parse(r.created_at);
  if (t > Date.now() + 5 * 60e3) r.created_at = new Date().toISOString();
  const d = (store.tables.decks || []).find(x => x.id === r.deck_id && x.user_id === r.user_id);
  if (r.subject == null && d) r.subject = d.subject;
  if (r.deck_name == null && d) r.deck_name = d.name;
  if (r.subject_name == null && r.subject) {
    const s = (store.tables.subjects || []).find(x => x.user_id === r.user_id && x.id === r.subject);
    if (s) r.subject_name = s.name;
  }
  if (r.ecart == null) {
    const avant = (store.tables.reviews || []).filter(x => x.user_id === r.user_id && x.deck_id === r.deck_id
      && x.card_id === r.card_id && Date.parse(x.created_at) < Date.parse(r.created_at));
    const prec = Math.max(0, ...avant.map(x => Date.parse(x.created_at)));
    r.ecart = prec ? Math.floor((Date.parse(r.created_at) - prec) / JOUR) : -1;
  }
}

function enFuseau(iso, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { j: `${p.year}-${p.month}-${p.day}`, h: +p.hour };
}

const largeur = (x, bornes) => { let i = 0; while (i < bornes.length && x >= bornes[i]) i++; return i; };

export function journalFaux(store, b, user) {
  let tz = b.p_tz || 'UTC';
  try { enFuseau(new Date().toISOString(), tz); } catch { tz = 'UTC'; }        // fuseau inconnu : UTC, comme la base
  const miennes = (store.tables.reviews || []).filter(r => r.user_id === user.id);
  const depuis = Date.parse(b.p_depuis);
  const r = miennes.filter(x => Date.parse(x.created_at) >= depuis)
    .sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
  const g = new Map(), h = new Map(), mat = {}, liv = {};
  for (const x of r) {
    const { j, h: heure } = enFuseau(x.created_at, tz);
    const p = x.ecart == null || x.ecart < 0 ? -1 : largeur(x.ecart, b.p_bornes || []);
    const k = [j, x.subject || '', x.deck_id, p].join('|');
    const v = g.get(k) || [j, x.subject || '', x.deck_id, p, 0, 0, 0];
    v[4]++; if (x.correct) v[5]++; v[6] += x.ms || 0;
    g.set(k, v);
    const kh = j + '|' + heure;
    h.set(kh, [j, heure, ((h.get(kh) || [])[2] || 0) + 1]);
    if (x.subject_name) mat[x.subject || ''] = x.subject_name;
    if (x.deck_name) liv[x.deck_id] = x.deck_name;
  }
  const locaux = new Set(b.p_locaux || []);
  return [200, {
    jours: [...g.values()], heures: [...h.values()], matieres: mat, livres: liv,
    toujours: { n: miennes.length, ok: miennes.filter(x => x.correct).length, ms: miennes.reduce((a, x) => a + (x.ms || 0), 0),
                depuis: miennes.length ? miennes.map(x => x.created_at).sort()[0] : null },
    connus: miennes.filter(x => x.client_id && locaux.has(x.client_id)).map(x => x.client_id)
  }];
}
