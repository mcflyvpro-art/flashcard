/* La fonction `ai` (supabase/functions/ai), lancée pour de vrai sous Deno,
   face à une fausse base (PostgREST : ia_droits, offre_de, user_roles, ia_quota et la
   réservation — ia_reserver, ia_solder, ia_annuler, 20261105185359) et un
   faux Anthropic servis ici. Ce que l'on prouve (2026-11-05) : un compte
   gratuit refusé sans rien dépenser ; une génération réservée puis soldée
   de son vrai coût ; une panne d'Anthropic qui rend sa réservation (rien
   n'est compté) ; un quota atteint qui n'appelle même pas Anthropic ; et
   vingt appels lancés ensemble par un compte au quota de cinq : cinq
   passent, quinze sont refusés — avant, les vingt passaient. Et (2026-11-07)
   plusieurs photos d'un cours lues en un seul appel, avec la consigne de
   l'élève à sa place ; l'envoi d'une app d'avant (une photo, `hint`) marche
   toujours. Et (2026-11-08) la rentabilité : chaque génération réservée à
   son pire coût sous le plafond du compte — un compte au plafond refusé
   (« plafond »), un PDF trop lourd pour ce qui reste refusé après son seul
   comptage (« lourd »), trois appels lancés ensemble quand il ne reste la
   place que d'un : un seul passe ; passé les trois quarts du plafond (ou les
   150 d'Infini), le modèle le plus économe, soldé à son tarif.

     node tools/ia/essai.js
   Deno : la variable DENO (chemin du binaire) ou `npx --yes deno@2`. Le port
   8000 doit être libre (celui de Deno.serve). La fonction est copiée dans
   un dossier temporaire avec son deno.json : à la racine du dépôt, Deno
   chercherait `npm:@supabase/supabase-js` dans le node_modules de l'app. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 54398, ICI = `http://127.0.0.1:${PORT}`, FONCTION = 'http://127.0.0.1:8000';
const QUOTA_JOUR = 5;

/* ---------- le faux monde ---------- */
const offres = { gratuit1: 'gratuit', inf1: 'infini', inf150: 'infini' };   // les autres : Mirandola+
const usage = [];                                // les lignes de ai_usage, réservées puis soldées
let anthropic = { appels: 0, panne: false, comptes: 0, jetons: 1500 };
let prochainId = 1;

const lire = req => new Promise(res => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => res(b)); });
const envoie = (res, statut, corps) => { res.writeHead(statut, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corps)); };

/* ia_reserver tel que la base le fait : contrôle et écriture d'un seul
   tenant (ici, le fil unique de Node joue le verrou consultatif). */
const depense = u => usage.filter(x => x.user_id === u).reduce((t, x) => t + x.cents + (x.estime || 0), 0);
function reserver(a) {
  const miens = usage.filter(x => x.user_id === a.u);
  const jour = miens.filter(x => x.day === a.p_jour).length;
  if (a.p_mensuel != null && miens.length >= a.p_mensuel) return { statut: 'mquota', fait: miens.length, quota: a.p_mensuel };
  // le plafond du compte (20261108111044) : le dépensé, l'en vol, et le pire de cet appel
  const estime = Math.max(0, +a.p_estime_cents || 0);
  if (a.p_plafond_cents != null && depense(a.u) + estime > a.p_plafond_cents) {
    return { statut: 'plafond', fait: miens.length, reste: Math.max(0, a.p_plafond_cents - depense(a.u)) };
  }
  if (jour >= Math.min(a.p_par_jour, QUOTA_JOUR)) return { statut: 'quota', fait: miens.length };
  const id = prochainId++;
  usage.push({ id, user_id: a.u, day: a.p_jour, op: a.p_op, in_tok: 0, out_tok: 0, cents: 0, estime });
  return { statut: 'ok', id, fait: miens.length, jour, fichiers: 0 };
}
// un passé à semer : des lignes déjà soldées, dans un autre jour (le quota du jour n'en voit rien)
const semer = (u, n, cents) => { for (let k = 0; k < n; k++) usage.push({ id: prochainId++, user_id: u, day: '2000-01-01', op: 'cards', in_tok: 1, out_tok: 1, cents: cents / n, estime: 0 }); };

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, ICI), corps = await lire(req);
  const a = corps ? JSON.parse(corps) : {};
  const p = url.pathname;
  if (p === '/anthropic/count_tokens') { anthropic.comptes++; return envoie(res, 200, { input_tokens: anthropic.jetons }); }
  if (p === '/anthropic') {
    anthropic.appels++; anthropic.dernier = a;
    await new Promise(r => setTimeout(r, 60));    // l'appel prend du temps : les appels lancés ensemble se chevauchent
    if (anthropic.panne) return envoie(res, 529, { error: { type: 'overloaded_error' } });
    return envoie(res, 200, { content: [{ type: 'text', text: JSON.stringify({ cards: [{ f: 'Paris', b: 'France' }] }) }],
      usage: { input_tokens: 1000, output_tokens: 200 } });
  }
  /* ce que la fonction lit du compte, en une fois (ia_droits, depuis Mirandola
     Infini) ; offre_de reste pour une fonction d'avant. Sans réponse, la
     fonction laisse passer, comme face à une base pas encore migrée : le
     banc doit donc répondre, sinon « gratuit » passerait. */
  if (p === '/rest/v1/rpc/ia_droits') {
    const niveau = offres[a.u] || 'plus', offre = niveau === 'infini' ? 'plus' : niveau;
    return envoie(res, 200, { offre, niveau, essai: false, prof: false, licence: null,
      fait: usage.filter(x => x.user_id === a.u).length, depense: depense(a.u) });
  }
  if (p === '/rest/v1/rpc/offre_de') return envoie(res, 200, offres[a.u] || 'plus');
  if (p === '/rest/v1/rpc/ia_quota') return envoie(res, 200, null);
  if (p === '/rest/v1/user_roles') return envoie(res, 200, []);
  if (p === '/rest/v1/rpc/ia_reserver') return envoie(res, 200, reserver(a));
  if (p === '/rest/v1/rpc/ia_solder') {
    const l = usage.find(x => x.id === a.rid);
    if (l) Object.assign(l, { in_tok: a.p_in, out_tok: a.p_out, cents: a.p_cents, estime: 0 });
    return envoie(res, 204, null);
  }
  if (p === '/rest/v1/rpc/ia_annuler') {
    const i = usage.findIndex(x => x.id === a.rid && !x.cents && !x.in_tok && !x.out_tok);
    if (i >= 0) usage.splice(i, 1);
    return envoie(res, 204, null);
  }
  envoie(res, 404, { message: 'inconnu ' + req.method + ' ' + p });
});

/* ---------- la fonction ---------- */
function lancer() {
  // la fonction et ce qu'elle importe de _shared/ (la rentabilité, 2026-11-08), à la même place l'un de l'autre
  const racine = mkdtempSync(join(tmpdir(), 'ia-essai-')), dossier = join(racine, 'ai');
  mkdirSync(dossier); mkdirSync(join(racine, '_shared'));
  copyFileSync('supabase/functions/ai/index.ts', join(dossier, 'index.ts'));
  for (const f of ['rentabilite.js', 'abonnement.js']) copyFileSync('supabase/functions/_shared/' + f, join(racine, '_shared', f));
  writeFileSync(join(dossier, 'deno.json'), '{"nodeModulesDir":"auto"}');
  const [cmd, ...args] = process.env.DENO ? [process.env.DENO] : ['npx', '--yes', 'deno@2'];
  const p = spawn(cmd, [...args, 'run', '--quiet', '--no-lock', '--allow-all', 'index.ts'], {
    cwd: dossier, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SUPABASE_URL: ICI, SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'cle',
      ANTHROPIC_URL: ICI + '/anthropic', AI_DAILY_CALLS: String(QUOTA_JOUR) }
  });
  p.dossier = racine; p.journal = '';
  p.stdout.on('data', d => (p.journal += d)); p.stderr.on('data', d => (p.journal += d));
  return p;
}

async function attendre() {
  for (let i = 0; i < 1200; i++) {
    try { await fetch(FONCTION, { method: 'OPTIONS' }); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('la fonction ne démarre pas');
}

const jeton = sub => 'e30.' + Buffer.from(JSON.stringify({ sub, role: 'authenticated' })).toString('base64url') + '.signature';
const appel = (sub, corps = { op: 'cards', text: 'Paris est la capitale de la France, Berlin celle de l’Allemagne.' }) => fetch(FONCTION, {
  method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton(sub) }
}).then(async r => ({ statut: r.status, j: await r.json().catch(() => ({})) }));

let ok = 0, ko = 0;
function verifie(nom, vrai, vu) {
  if (vrai) { ok++; console.log('  ✓ ' + nom); } else { ko++; console.log('  ✗ ' + nom + ' — vu : ' + JSON.stringify(vu)); }
}

async function essais() {
  let r = await appel('gratuit1');
  verifie('Mirandola gratuit : 402, rien de réservé, Anthropic jamais appelé',
    r.statut === 402 && r.j.error === 'plus' && !usage.length && !anthropic.appels, r);

  r = await appel('lea');
  const l = usage.find(x => x.user_id === 'lea');
  verifie('une génération : les pages, et sa ligne soldée de son vrai coût',
    r.statut === 200 && r.j.cards.length === 1 && l && l.in_tok === 1000 && l.out_tok === 200 && l.cents > 0
      && r.j.mois.fait === 1, { r, l });
  verifie('soldée au tarif de son modèle : 1 000 + 200 jetons de Sonnet, 0,4 cent ; le pire réservé effacé',
    l && Math.abs(l.cents - 0.4) < 1e-9 && l.estime === 0 && anthropic.dernier.model === 'claude-sonnet-5', l);

  anthropic.panne = true;
  const avant = usage.filter(x => x.user_id === 'tom').length;
  r = await appel('tom');
  verifie('Anthropic en panne partout : « surcharge », et la réservation est rendue (rien n’est compté)',
    r.statut === 503 && r.j.error === 'surcharge' && usage.filter(x => x.user_id === 'tom').length === avant, { r, usage });
  anthropic.panne = false;

  for (let k = 0; k < QUOTA_JOUR - 1; k++) await appel('lea');
  const appelsAvant = anthropic.appels;
  r = await appel('lea');
  verifie('quota du jour atteint : 429, et Anthropic n’est même pas appelé',
    r.statut === 429 && r.j.error === 'quota' && anthropic.appels === appelsAvant, r);

  // trois photos d'un cours et une consigne : un seul appel, trois images, la consigne à sa place
  const img = { mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' };
  let appels = anthropic.appels;
  r = await appel('max', { op: 'ocr', images: [img, img, img], consigne: 'seulement les dates', contexte: 'Histoire · classe : 1re' });
  let vu = anthropic.dernier && anthropic.dernier.messages[0].content;
  let texte = vu ? vu.filter(b => b.type === 'text').map(b => b.text).join('') : '';
  verifie('trois photos et une consigne : un seul appel, trois images, « lues : 3 », la consigne et le contexte à leur place',
    r.statut === 200 && r.j.lues === 3 && anthropic.appels === appels + 1 && vu.filter(b => b.type === 'image').length === 3
      && texte.includes('Consigne de l\'élève : seulement les dates') && texte.includes('Contexte : Histoire · classe : 1re'),
    { r, texte });

  // une app d'avant : une photo par appel, le titre du paquet en `hint`
  appels = anthropic.appels;
  r = await appel('ana', { op: 'ocr', mime: img.mime, data: img.data, hint: 'Histoire' });
  vu = anthropic.dernier && anthropic.dernier.messages[0].content;
  texte = vu ? vu.filter(b => b.type === 'text').map(b => b.text).join('') : '';
  verifie('l’envoi d’avant (une photo, hint) : une image, « lues : 1 », le hint lu comme avant',
    r.statut === 200 && r.j.lues === 1 && anthropic.appels === appels + 1 && vu.filter(b => b.type === 'image').length === 1
      && texte.startsWith('Consigne : Histoire'), { r, texte });

  // une photo de trop lourde, ou d'un format inconnu : refusée avant de rien dépenser
  appels = anthropic.appels;
  r = await appel('ana', { op: 'ocr', images: [img, { mime: 'application/pdf', data: 'JVBERi0x' }] });
  verifie('une pièce qui n’est pas une image : 415, Anthropic jamais appelé', r.statut === 415 && anthropic.appels === appels, r);

  /* ---------- la rentabilité (2026-11-08) ---------- */
  semer('plafond1', 3, 88.9);                       // Mirandola+ : 89 cents de plafond
  appels = anthropic.appels;
  r = await appel('plafond1');
  verifie('un compte à son plafond : « plafond », Anthropic jamais appelé, rien de réservé',
    r.statut === 429 && r.j.error === 'plafond' && anthropic.appels === appels
      && usage.filter(x => x.user_id === 'plafond1').length === 3, r);

  anthropic.jetons = 500000;                       // un PDF de 500 000 jetons : 100 cents d'entrée, au pire
  const comptes = anthropic.comptes; appels = anthropic.appels;
  r = await appel('pdf1', { op: 'pdf', mime: 'application/pdf', data: 'JVBERi0xLjQK' });
  verifie('un PDF trop lourd pour le plafond : compté par l’API, « lourd », jamais lu',
    r.statut === 429 && r.j.error === 'lourd' && anthropic.comptes === comptes + 1 && anthropic.appels === appels, r);
  anthropic.jetons = 3000;
  r = await appel('pdf1', { op: 'pdf', mime: 'application/pdf', data: 'JVBERi0xLjQK' });
  verifie('un PDF ordinaire, compté puis lu', r.statut === 200 && anthropic.comptes === comptes + 2, r);

  semer('econome1', 2, 67);                         // plus des trois quarts de 89
  r = await appel('econome1');
  let ligne = usage.filter(x => x.user_id === 'econome1').pop();
  verifie('passé les trois quarts du plafond : Claude Haiku, soldé à son tarif (0,02 cent)',
    r.statut === 200 && anthropic.dernier.model === 'claude-haiku-5-5' && Math.abs(ligne.cents - 0.02) < 1e-9, { r, ligne });

  semer('inf150', 150, 30);                         // Infini : ses 150, pour 30 cents seulement
  r = await appel('inf150');
  verifie('Infini au-delà de ses 150 : Claude Haiku, sans « mquota »', r.statut === 200 && anthropic.dernier.model === 'claude-haiku-5-5', r);
  r = await appel('inf1');
  verifie('Infini au début du mois : le meilleur modèle', r.statut === 200 && anthropic.dernier.model === 'claude-sonnet-5', r);

  semer('serre', 2, 60);                            // 29 cents de reste : la place d'un appel au pire (~17 cents)
  const trois = await Promise.all([appel('serre'), appel('serre'), appel('serre')]);
  verifie('trois appels ensemble, la place d’un seul : un passe, deux refusés, le plafond jamais dépassé',
    trois.filter(x => x.statut === 200).length === 1 && trois.filter(x => x.statut === 429).length === 2
      && depense('serre') <= 89, { statuts: trois.map(x => x.statut + ':' + (x.j.error || '')), depense: depense('serre') });

  const salve = await Promise.all(Array.from({ length: 20 }, () => appel('zoe')));
  const passes = salve.filter(x => x.statut === 200).length, refus = salve.filter(x => x.statut === 429).length;
  verifie(`vingt appels lancés ensemble, quota de ${QUOTA_JOUR} : ${QUOTA_JOUR} passent, les autres sont refusés`,
    passes === QUOTA_JOUR && refus === 20 - QUOTA_JOUR && usage.filter(x => x.user_id === 'zoe').length === QUOTA_JOUR,
    { passes, refus, statuts: salve.map(x => x.statut) });
}

serveur.listen(PORT, '127.0.0.1', async () => {
  const p = lancer();
  try { await attendre(); await essais(); }
  catch (e) { ko++; console.log('  ✗ ' + e.message); }
  finally {
    const fini = new Promise(r => p.once('exit', r));
    try { process.kill(-p.pid); } catch { p.kill(); }
    await fini;
    rmSync(p.dossier, { recursive: true, force: true });
    serveur.close();
  }
  if (ko && p.journal) console.log('  (journal de la fonction)\n' + p.journal.trim().split('\n').map(x => '  ' + x).join('\n'));
  console.log(`\n${ok} vérifications passées, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
});
