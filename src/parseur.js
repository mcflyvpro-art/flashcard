/* ══════════ le parseur de cartes ══════════
   Ce qu'un élève colle dans la zone de texte (export Quizlet, notes Anki
   en texte brut, CSV/TSV d'un tableur, deux lignes par carte copiées
   d'une page web…) devient une liste de { f, b }. Aucun format n'est
   annoncé à l'avance : on le devine, sans jamais planter sur une entrée
   inattendue — au pire on rend un tableau vide ou incomplet.

   Un export emploie le MÊME séparateur sur toutes ses lignes. Choisir
   ligne par ligne casse dès qu'une définition contient elle-même une
   virgule ou un deux-points : la ligne se coupe au mauvais endroit alors
   que la suivante se coupe correctement. On élit donc un séparateur pour
   tout le bloc (`sniffSep`), celui qui découpe le plus de lignes en
   exactement deux morceaux pleins.

   Pur : ni DOM, ni réseau, ni almanach — seulement le texte reçu.
   Testé dans test/parseur.test.js (M01.T4). */

export const SEPS = [/\s*\t+\s*/, /\s*::\s*/, /\s*=>?\s*/, /\s*\|\s*/, /\s+[–—]\s+/, /\s+-\s+/, /\s*:\s*/, /\s*;\s*/, /\s*,\s*/];
export const BULLET = /^\s*(?:[-*•·–—]|\d+[.)])\s+/;

export const SEPNAMES = [
  ['tabulation', /\t+/, /\s*\t+\s*/],
  ['«  :: »', /::/, /\s*::\s*/],
  ['«  | »', /\|/, /\s*\|\s*/],
  ['flèche', /\s=>\s|\s?→\s?/, /\s*(?:=>|→)\s*/],
  ['«  = »', /=/, /\s*=\s*/],
  ['tiret', /\s[–—-]\s/, /\s+[–—-]\s+/],
  ['deux-points', /:/, /\s*:\s*/],
  ['point-virgule', /;/, /\s*;\s*/],
  ['virgule', /,/, /\s*,\s*/]
];
/* Le séparateur élu pour tout le bloc, ou null si aucun ne convainc sur
   au moins 60 % des lignes. */
export function sniffSep(rows) {
  let best = null;
  for (const [name, find, split] of SEPNAMES) {
    let once = 0, many = 0, zero = 0;
    for (const r of rows) {
      const n = (r.match(new RegExp(find.source, 'g')) || []).length;
      if (!n) { zero++; continue; }
      const p = r.split(split);
      if (p.length === 2 && p[0].trim() && p[1].trim()) once++;
      else many++;
    }
    const score = once - many * .5 - zero;
    if (once >= rows.length * .6 && (!best || score > best.score))
      best = { name, split, score, once };
  }
  return best;
}
/* En-tête d'un export Anki « notes en texte brut » : des lignes de
   directives, puis les notes, souvent avec du HTML dans les champs.
   On lit la directive de séparateur, on jette le reste de l'en-tête et
   on remet le tout au séparateur le plus sûr (tabulation). */
export const ANKISEP = { tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':' };
export function deAnki(t) {
  /* Anki écrit aussi « #notetype column:1 », avec une espace : la clé
     peut faire plusieurs mots */
  if (!/^#(?:separator|html|tags|notetype|deck|columns)\b[^\n]*:/im.test(t.slice(0, 400))) return t;
  let sep = '';
  const keep = [];
  for (const line of t.split(/\r?\n/)) {
    const m = /^#([a-z]+(?: [a-z]+)*)\s*:(.*)$/i.exec(line);
    if (m) { if (/^separator$/i.test(m[1])) sep = ANKISEP[m[2].trim().toLowerCase()] || m[2].trim(); continue; }
    keep.push(line);
  }
  let out = keep.join('\n');
  if (sep && sep !== '\t') out = out.split(sep).join('\t');   // ramené au cas le plus sûr
  return out;
}
export const deHtml = s => s
  .replace(/<br\s*\/?>|<\/(?:div|p|li)>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();

/* le HTML des exports Anki est remis à plat ici, une fois pour toutes,
   quelle que soit la façon dont le texte a été découpé */
export function parseText(raw) {
  return parseRaw(raw).map(c => ({ f: deHtml(c.f), b: deHtml(c.b) })).filter(c => c.f && c.b);
}
export function parseRaw(raw) {
  const txt = deAnki(String(raw));
  const t = txt.trim(); if (!t) return [];
  if (t[0] === '{' || t[0] === '[') {
    try {
      const j = JSON.parse(t), arr = Array.isArray(j) ? j : (j.cards || []);
      const out = arr.map(c => Array.isArray(c)
        ? { f: String(c[0] || '').trim(), b: String(c[1] || '').trim() }
        : { f: String(c.f ?? c.front ?? c.q ?? '').trim(), b: String(c.b ?? c.back ?? c.a ?? '').trim() })
        .filter(c => c.f);
      if (out.length) return out;
    } catch (e) { /* pas du JSON valide : on retombe sur les découpes suivantes */ }
  }
  /* Blocs séparés par une ligne vide, deux lignes chacun : recto dessus,
     verso dessous. C'est ce qui sort d'un copier-coller de page web. */
  if (/\n\s*\n/.test(t)) {
    const blocks = t.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
    const pairs = blocks.map(x => x.split(/\r?\n/).map(l => l.replace(BULLET, '').trim()).filter(Boolean));
    if (blocks.length >= 2 && pairs.every(p => p.length === 2))
      return pairs.map(([f, b]) => ({ f, b }));
  }
  let rows = t.split(/\r?\n/).map(l => l.replace(BULLET, '').trim()).filter(Boolean);
  /* Tout sur une seule ligne : les lignes sont alors séparées par « ; »
     ou « | », le choix que Quizlet propose pour les rangées. */
  if (rows.length === 1) {
    for (const rs of [/\s*\|\s*/, /\s*;\s*/]) {
      const p = rows[0].split(rs).map(x => x.trim()).filter(Boolean);
      if (p.length >= 2 && sniffSep(p)) { rows = p; break; }
    }
  }
  const sep = sniffSep(rows);
  if (sep) {
    const out = [];
    for (const r of rows) {
      const p = r.split(sep.split);
      if (p.length < 2) continue;
      const f = p[0].trim(), b = p.slice(1).join(' ').trim();
      if (f && b) out.push({ f, b });
    }
    if (out.length) return out;
  }
  /* Une ligne sur deux : recto, verso, recto, verso… */
  if (rows.length >= 4 && rows.length % 2 === 0 && !rows.some(r => SEPS.some(s => s.test(r)))) {
    const out = [];
    for (let i = 0; i < rows.length; i += 2) out.push({ f: rows[i], b: rows[i + 1] });
    return out;
  }
  /* dernier recours : ligne par ligne, comme avant */
  const out = [];
  for (const line of rows) {
    for (const s of SEPS) {
      const m = line.split(s);
      if (m.length >= 2 && m[0].trim() && m.slice(1).join(' ').trim()) {
        out.push({ f: m[0].trim(), b: m.slice(1).join(' ').trim() }); break;
      }
    }
  }
  return out;
}
