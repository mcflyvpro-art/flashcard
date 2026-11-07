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
   toujours.

     node tools/ia/essai.js
   Deno : la variable DENO (chemin du binaire) ou `npx --yes deno@2`. Le port
   8000 doit être libre (celui de Deno.serve). La fonction est copiée dans
   un dossier temporaire avec son deno.json : à la racine du dépôt, Deno
   chercherait `npm:@supabase/supabase-js` dans le node_modules de l'app. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 54398, ICI = `http://127.0.0.1:${PORT}`, FONCTION = 'http://127.0.0.1:8000';
const QUOTA_JOUR = 5;

/* ---------- le faux monde ---------- */
const offres = { gratuit1: 'gratuit' };          // les autres : Mirandola+
const usage = [];                                // les lignes de ai_usage, réservées puis soldées
let anthropic = { appels: 0, panne: false };
let prochainId = 1;

const lire = req => new Promise(res => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => res(b)); });
const envoie = (res, statut, corps) => { res.writeHead(statut, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corps)); };

/* ia_reserver tel que la base le fait : contrôle et écriture d'un seul
   tenant (ici, le fil unique de Node joue le verrou consultatif). */
function reserver(a) {
  const miens = usage.filter(x => x.user_id === a.u);
  const jour = miens.filter(x => x.day === a.p_jour).length;
  if (a.p_mensuel != null && miens.length >= a.p_mensuel) return { statut: 'mquota', fait: miens.length, quota: a.p_mensuel };
  if (jour >= Math.min(a.p_par_jour, QUOTA_JOUR)) return { statut: 'quota', fait: miens.length };
  const id = prochainId++;
  usage.push({ id, user_id: a.u, day: a.p_jour, op: a.p_op, in_tok: 0, out_tok: 0, cents: 0 });
  return { statut: 'ok', id, fait: miens.length, jour, fichiers: 0 };
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, ICI), corps = await lire(req);
  const a = corps ? JSON.parse(corps) : {};
  const p = url.pathname;
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
    const offre = offres[a.u] || 'plus';
    return envoie(res, 200, { offre, niveau: offre, essai: false, prof: false, licence: null });
  }
  if (p === '/rest/v1/rpc/offre_de') return envoie(res, 200, offres[a.u] || 'plus');
  if (p === '/rest/v1/rpc/ia_quota') return envoie(res, 200, null);
  if (p === '/rest/v1/user_roles') return envoie(res, 200, []);
  if (p === '/rest/v1/rpc/ia_reserver') return envoie(res, 200, reserver(a));
  if (p === '/rest/v1/rpc/ia_solder') {
    const l = usage.find(x => x.id === a.rid);
    if (l) Object.assign(l, { in_tok: a.p_in, out_tok: a.p_out, cents: a.p_cents });
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
  const dossier = mkdtempSync(join(tmpdir(), 'ia-essai-'));
  copyFileSync('supabase/functions/ai/index.ts', join(dossier, 'index.ts'));
  writeFileSync(join(dossier, 'deno.json'), '{"nodeModulesDir":"auto"}');
  const [cmd, ...args] = process.env.DENO ? [process.env.DENO] : ['npx', '--yes', 'deno@2'];
  const p = spawn(cmd, [...args, 'run', '--quiet', '--no-lock', '--allow-all', 'index.ts'], {
    cwd: dossier, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SUPABASE_URL: ICI, SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'cle',
      ANTHROPIC_URL: ICI + '/anthropic', AI_DAILY_CALLS: String(QUOTA_JOUR) }
  });
  p.dossier = dossier; p.journal = '';
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
