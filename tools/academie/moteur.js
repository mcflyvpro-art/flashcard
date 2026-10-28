// Le moteur de tournage de la Mirandola Academy (2026-10-27).
//
// Une formation est un scénario : une fonction async (t) => {...} qui ne
// parle à l'app que par `t`. Elle tourne deux fois : d'abord à vide (une
// collecte qui ne fait que noter les répliques et les chapitres, pour
// synthétiser la voix avant de filmer), puis pour de vrai, dans une page
// cadre 1920×1080 qui contient l'app : la démo sans compte, servie par
// `vite preview` (rien ne part vers la vraie base). Chaque image est
// capturée par le screencast de Chromium avec son heure ; la voix est posée
// à l'heure où chaque réplique a commencé. Le sommaire, avec les vrais
// minutages, est filmé à part puis placé en tête.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICI = dirname(fileURLToPath(import.meta.url));
export const TRAVAIL = process.env.ACADEMIE_DIR || join(ICI, '..', '..', '.academie');
export const BASE = process.env.ACADEMIE_URL || 'http://localhost:4190';
export const PY = join(TRAVAIL, 'venv', 'bin', 'python');
const CHROME = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

export const attendre = ms => new Promise(r => setTimeout(r, ms));
const cle = t => createHash('sha1').update(t).digest('hex').slice(0, 16);
export const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* Un sous-titre trop long pour deux lignes se coupe aux fins de phrase
   (un point suivi d'une espace : « R.G.P.D. » ne coupe rien) ; chaque
   morceau reste affiché au prorata de sa longueur. */
function decouper(texte, max) {
  if (texte.length <= max) return [{ t: texte, part: 1 }];
  const phrases = texte.match(/.+?(?:[.!?:;](?=\s|$)|$)\s*/g) || [texte];
  const morceaux = [];
  let cur = '';
  for (const p of phrases) {
    if (cur && (cur + p).length > max) { morceaux.push(cur.trim()); cur = ''; }
    cur += p;
  }
  if (cur.trim()) morceaux.push(cur.trim());
  const total = morceaux.reduce((a, m) => a + m.length, 0);
  return morceaux.map(m => ({ t: m, part: m.length / total }));
}

/* ---------- la collecte, à vide ---------- */
function collecte() {
  const r = { textes: [], chapitres: [] };
  return new Proxy({}, {
    get(_, k) {
      if (k === 'dire') return async texte => { r.textes.push(texte); };
      if (k === 'chapitre') return async (titre, etapes, o = {}) => { r.chapitres.push({ titre, sous: o.sous }); };
      if (k === 'resultat') return r;
      return async () => {};
    }
  });
}

/* ---------- le vrai tournage ---------- */
class Tournage {
  constructor(o) {
    this.o = o;            // { nom, mode: 'tel'|'pc', module, depart, chapitres, textes, durees, dossier }
    this.log = [];
    this.chapitres = [];
    this.nChap = 0;
    this.nDit = 0;
  }

  async ouvrir() {
    const o = this.o;
    this.b = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined,
      args: ['--font-render-hinting=none'] });
    this.ctx = await this.b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block',
      locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    this.ctx.setDefaultTimeout(10000);
    // le bandeau « Démo » n'a pas sa place dans une formation : elle montre l'app d'un vrai compte
    await this.ctx.addInitScript(() => {
      if (location.pathname.startsWith('/__academie')) return;
      const poser = () => {
        const s = document.createElement('style');
        s.textContent = '.dm-bandeau{display:none!important} html.en-demo #app{padding-bottom:0!important}';
        (document.head || document.documentElement).appendChild(s);
      };
      if (document.documentElement) poser(); else document.addEventListener('DOMContentLoaded', poser);
      // ni le tuto que la démo lance à la première entrée de chaque rôle : les
      // rôles sont « déjà vus », et le démarrage de l'app (effacerDemo) ne
      // peut pas l'oublier
      const vus = '["eleve","prof","ref"]', oter = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (k) { return k === 'folio.demo.tuto' ? this.setItem(k, vus) : oter.call(this, k); };
      try { sessionStorage.setItem('folio.demo.tuto', vus); } catch { /* stockage refusé : rien à poser */ }
    });
    const cadre = readFileSync(join(ICI, 'cadre.html'));
    await this.ctx.route(BASE + '/__academie/cadre', r => r.fulfill({ body: cadre, contentType: 'text/html; charset=utf-8' }));
    this.p = await this.ctx.newPage();
    this.p.on('pageerror', e => console.log('erreur dans la page :', e.message));
    await this.p.goto(BASE + '/__academie/cadre');
    await this.p.evaluate(([m, src, mod]) => A.monter(m, src, mod), [o.mode, BASE + o.depart, o.module]);
    // l'adresse dans la barre du navigateur suit celle de l'app, sans le /demo/
    await this.p.evaluate(() => setInterval(() => {
      try {
        const l = document.getElementById('app').contentWindow.location;
        A.url('mirandola.fr' + l.pathname.replace(/^\/demo\//, '/'));
      } catch { /* pas encore chargée : l'adresse suivra */ }
    }, 200));
    await this.pret();
  }

  get app() { return this.p.frameLocator('#app'); }
  L(sel, o) { return this.app.locator(sel, o); }
  async cadreApp() { return (await this.p.$('#app')).contentFrame(); }

  /* l'écran d'ouverture de l'app s'est effacé, et l'écran a eu le temps de se poser */
  async pret(ms = 900) {
    const f = await this.cadreApp();
    await f.waitForLoadState('domcontentloaded');
    await f.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => { /* déjà parti */ });
    await attendre(ms);
  }

  async aller(chemin, ms) {
    const f = await this.cadreApp();
    await f.goto(BASE + chemin);
    await this.pret(ms);
  }

  async demarrer() {
    const dir = join(this.o.dossier, 'images');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    this.images = [];
    this.cdp = await this.ctx.newCDPSession(this.p);
    let i = 0;
    this.cdp.on('Page.screencastFrame', async ev => {
      const n = String(++i).padStart(6, '0') + '.jpg';
      writeFileSync(join(dir, n), Buffer.from(ev.data, 'base64'));
      this.images.push({ n, t: ev.metadata.timestamp });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch { /* capture arrêtée entre-temps */ }
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    await attendre(300);
    this.t0 = await this.maintenant();
  }

  async arreter() {
    this.tFin = await this.maintenant();
    await this.cdp.send('Page.stopScreencast');
    await attendre(300);
  }

  maintenant() { return this.p.evaluate(() => Date.now()); }

  /* ---------- ce que voit le spectateur autour de l'app ---------- */
  async carte(c) { await this.p.evaluate(c => A.carte(c), c); await attendre(650); }
  async sansCarte() { await this.p.evaluate(() => A.sansCarte()); await attendre(650); }
  async chapitre(titre, etapes, o = {}) {
    this.nChap++;
    this.chapitres.push({ titre, sous: o.sous, t: await this.maintenant() });
    await this.p.evaluate(() => { A.st(''); A.halo(null); });
    await this.p.evaluate(([n, N, t, e]) => A.chapitre(n, N, t, e), [this.nChap, this.o.chapitres, titre, etapes]);
    await this.carte({ sur: `Étape ${this.nChap}`, titre, txt: o.sous || '', num: String(this.nChap) });
  }
  async etape(i) { await this.p.evaluate(i => A.etape(i), i); }
  async astuce(t) { await this.p.evaluate(t => A.astuce(t), t || ''); }

  /* Une réplique : la voix (déjà synthétisée) part maintenant, le sous-titre
     la suit, et `act` se joue pendant ce temps. On repart quand les deux
     sont finis. */
  async dire(texte, act, o = {}) {
    const k = cle(texte);
    if (this.o.durees[k] == null) throw new Error('réplique non synthétisée : ' + texte);
    const d = this.o.durees[k] * (this.o.facteur || 1);
    const debut = await this.maintenant();
    this.log.push({ cle: k, t: debut, d, texte });
    this.nDit++;
    await this.p.evaluate(([x]) => A.progres(x), [this.nDit / this.o.textes]);
    const st = (async () => {
      for (const m of decouper(texte, this.o.mode === 'tel' ? 150 : 175)) {
        await this.p.evaluate(t => A.st(t), m.t);
        await attendre(d * 1000 * m.part);
      }
    })();
    await Promise.all([st, act ? act() : null]);
    if (Date.now() - debut > d * 1000 + 900) await this.p.evaluate(() => A.st(''));
    await attendre(o.pause ?? 450);
    if (this.o.repetition) {
      const n = String(this.nDit).padStart(3, '0');
      mkdirSync(join(this.o.dossier, 'rep'), { recursive: true });
      await this.p.screenshot({ path: join(this.o.dossier, 'rep', n + '.jpg'), quality: 70, type: 'jpeg' });
      console.log(n, texte.slice(0, 90));
    }
  }
  async taire() { await this.p.evaluate(() => A.st('')); }

  /* ---------- les gestes ---------- */
  async viser(loc, { clic = true, faux = false } = {}) {
    if (clic || faux) await this.p.evaluate(() => A.halo(null));
    const l = loc.first();
    await l.waitFor({ state: 'visible' });
    await l.scrollIntoViewIfNeeded();
    await attendre(120);
    const b = await l.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    if (this.o.mode === 'pc') { await this.p.evaluate(([x, y]) => A.curseur(x, y, 700), [x, y]); await attendre(760); }
    else { await this.p.evaluate(([x, y]) => A.doigt(x, y, true), [x, y]); await attendre(560); }
    const lever = () => {
      if (this.o.mode === 'tel') setTimeout(() => this.p.evaluate(([x, y]) => A.doigt(x, y, false), [x, y]).catch(() => { /* page fermée */ }), 350);
    };
    if (faux) { await this.p.evaluate(([x, y]) => A.appui(x, y), [x, y]); lever(); return; }
    if (!clic) return;
    await this.p.evaluate(([x, y]) => A.appui(x, y), [x, y]);
    await attendre(120);
    await l.click();
    lever();
  }
  toucher(sel, o = {}) { return this.viser(typeof sel === 'string' ? this.L(sel + ' >> visible=true') : sel, o); }

  /* une liste déroulante : le curseur y va, puis l'option est choisie (par son libellé) */
  async choisir(sel, libelle) {
    const l = this.L(sel + ' >> visible=true').first();
    await this.viser(l, { clic: false });
    await l.selectOption({ label: libelle });
    await attendre(500);
  }

  async montrer(sel, o = {}) {
    const l = (typeof sel === 'string' ? this.L(sel + ' >> visible=true') : sel).first();
    await l.waitFor({ state: 'visible' });
    if (o.defiler !== false) await l.scrollIntoViewIfNeeded();
    await attendre(80);
    const b = await l.boundingBox();
    await this.p.evaluate(([b, o]) => A.halo(b, o), [b, { voile: !!o.voile, etiq: o.etiq || '' }]);
  }
  async cacher() { await this.p.evaluate(() => A.halo(null)); }

  /* La caméra (ordinateur) : grossit l'app autour d'une zone, pour qu'on lise
     ce dont on parle. Pendant un zoom, on ne touche que ce qui est à l'écran. */
  async zoom(sel, s = 1.5) {
    await this.p.evaluate(() => A.halo(null));
    const l = this.L(sel + ' >> visible=true').first();
    await l.waitFor({ state: 'visible' });
    await l.scrollIntoViewIfNeeded();
    const b = await l.boundingBox();
    await this.p.evaluate(([b, s]) => A.zoom(b, s), [b, s]);
    await attendre(1100);
  }
  async dezoom() { await this.p.evaluate(() => { A.halo(null); A.zoom(null, 1); }); await attendre(1100); }

  async taper(sel, texte, { delai = 55 } = {}) {
    const l = (typeof sel === 'string' ? this.L(sel) : sel).first();
    await this.viser(l);
    await l.pressSequentially(texte, { delay: delai });
  }

  async fermerFeuille() {
    const f = await this.cadreApp();
    await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await attendre(600);
  }

  pause(ms) { return attendre(ms); }
  async rideau(on) { await this.p.evaluate(on => A.rideau(on), on); await attendre(500); }
  async taille(w, h) { await this.p.evaluate(([w, h]) => A.taille(w, h), [w, h]); await attendre(400); }
  async lireDemo() { const f = await this.cadreApp(); return f.evaluate(() => sessionStorage.getItem('folio.demo')); }
  async ecrireDemo(s) { const f = await this.cadreApp(); await f.evaluate(s => sessionStorage.setItem('folio.demo', s), s); }

  /* ---------- le sommaire, filmé à part puis placé en tête ---------- */
  async sommaire(intro) {
    // le minutage du sommaire tient compte de sa propre durée, fixée d'avance
    const D = intro.duree;
    const chapitres = [{ t: '0:00', titre: 'Sommaire' }].concat(this.chapitres.map((c, i) =>
      ({ t: mmss(D + (c.t - this.t0) / 1000), titre: `${i + 1}. ${c.titre}`, sous: c.sous })));
    const total = D + (this.tFin - this.t0) / 1000;
    const corps = { dossier: this.o.dossier, images: this.images, t0: this.t0, tFin: this.tFin, log: this.log };
    this.o.dossier = join(corps.dossier, 'intro');
    this.log = [];
    await this.p.evaluate(() => { A.st(''); A.halo(null); });
    await this.demarrer();
    await this.p.evaluate(s => A.sommaire(s), { sur: intro.sur, titre: intro.titre, txt: intro.txt, duree: 'Durée ' + mmss(total), chapitres });
    await attendre(500);
    for (const r of intro.repliques) await this.dire(r, null, { pause: 200 });
    const reste = D * 1000 - (Date.now() - this.t0);
    if (reste > 0) await attendre(reste);
    this.tFin = this.t0 + D * 1000;
    await this.cdp.send('Page.stopScreencast');
    await attendre(300);
    const introInfo = { dossier: this.o.dossier, images: this.images, t0: this.t0, tFin: this.tFin, log: this.log };
    this.o.dossier = corps.dossier;
    return { corps, intro: introInfo, chapitres, D, total };
  }

  async fermer() { await this.b.close(); }
}

/* ---------- le montage ---------- */
function encoder(seg, voix, sortie) {
  // les images, chacune pour le temps qu'elle est restée à l'écran
  const imgs = seg.images.filter(i => i.t * 1000 >= seg.t0 - 50);
  const lignes = [];
  for (let i = 0; i < imgs.length; i++) {
    const debut = i === 0 ? seg.t0 / 1000 : imgs[i].t;
    const fin = i + 1 < imgs.length ? imgs[i + 1].t : seg.tFin / 1000;
    lignes.push(`file '${join(seg.dossier, 'images', imgs[i].n)}'`, `duration ${Math.max(0.001, fin - debut).toFixed(4)}`);
  }
  lignes.push(`file '${join(seg.dossier, 'images', imgs[imgs.length - 1].n)}'`);
  const liste = join(seg.dossier, 'images.txt');
  writeFileSync(liste, lignes.join('\n'));
  // la voix : chaque réplique à sa place, puis un niveau d'écoute régulier (-16 LUFS, celui des vidéos en ligne)
  const pistes = seg.log.map(l => ({ f: join(voix, l.cle + '.wav'), t: (l.t - seg.t0) / 1000 }));
  const pj = join(seg.dossier, 'pistes.json');
  writeFileSync(pj, JSON.stringify({ pistes, duree: (seg.tFin - seg.t0) / 1000 }));
  const wav = join(seg.dossier, 'voix.wav');
  execFileSync(PY, ['-I', join(ICI, 'mixer.py'), pj, wav], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-i', wav,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'stillimage', '-g', '60',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '1', '-shortest', sortie],
  { stdio: 'inherit' });
}

function monter(res, voix, sortie, titre) {
  const a = join(res.intro.dossier, 'intro.mp4'), b = join(res.corps.dossier, 'corps.mp4');
  encoder(res.intro, voix, a);
  encoder(res.corps, voix, b);
  const liste = join(res.corps.dossier, 'concat.txt');
  writeFileSync(liste, `file '${a}'\nfile '${b}'\n`);
  const brut = join(res.corps.dossier, 'brut.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', brut], { stdio: 'inherit' });
  // les chapitres dans le fichier (VLC, QuickTime, la plupart des lecteurs)
  const ms = s => { const [m, ss] = s.split(':').map(Number); return (m * 60 + ss) * 1000; };
  const fin = Math.round(res.total * 1000);
  let meta = `;FFMETADATA1\ntitle=${titre}\nartist=Mirandola Academy\n`;
  res.chapitres.forEach((c, i) => {
    const debut = ms(c.t), suite = i + 1 < res.chapitres.length ? ms(res.chapitres[i + 1].t) : fin;
    meta += `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${debut}\nEND=${suite}\ntitle=${c.titre}\n`;
  });
  const mf = join(res.corps.dossier, 'chapitres.txt');
  writeFileSync(mf, meta);
  mkdirSync(dirname(sortie), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', brut, '-i', mf, '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy',
    '-movflags', '+faststart', sortie], { stdio: 'inherit' });
  return res.chapitres;
}

/* La voix de toutes les répliques, avant de filmer (voix.py choisit le
   moteur : Gemini, Google Cloud, ou Kokoro en repli). */
function synthetiser(textes, dossier) {
  const ent = join(dossier, 'repliques.json'), dur = join(dossier, 'durees.json');
  mkdirSync(dossier, { recursive: true });
  writeFileSync(ent, JSON.stringify([...new Set(textes)].map(t => ({ cle: cle(t), texte: t }))));
  execFileSync(PY, ['-I', join(ICI, 'voix.py'), ent, dur], { stdio: 'inherit' });
  return JSON.parse(readFileSync(dur));
}

/* --depuis=N (répétition seulement) : on saute les chapitres d'avant, sans leurs gestes */
function sauterJusqua(t, depuis) {
  if (!depuis) return t;
  return new Proxy(t, { get(obj, k) {
    const v = obj[k];
    if (typeof v !== 'function') return v;
    if (k === 'chapitre') return async (...a) => { if (obj.nChap + 1 >= depuis) return v.apply(obj, a); obj.nChap++; };
    return (...a) => (obj.nChap < depuis ? Promise.resolve() : v.apply(obj, a));
  } });
}

/* ---------- tout, pour une formation ---------- */
export async function tourner(f, { repetition = false, secher = false, depuis = 0 } = {}) {
  const o = { ...f, dossier: join(TRAVAIL, 'tournage', f.nom), sortie: join(TRAVAIL, 'sortie', f.fichier) };
  // 1. à vide : les répliques et les chapitres, puis leur voix
  const c = collecte();
  await f.scenario(c);
  const { textes, chapitres } = c.resultat;
  const { dossier: voix, durees } = synthetiser([...textes, ...f.intro.repliques], o.dossier);
  const estime = textes.reduce((a, t) => a + durees[cle(t)], 0);
  console.log(`${f.nom} : ${chapitres.length} chapitres, ${textes.length} répliques, voix ${mmss(estime)} (${voix})`);
  if (secher) return null;
  // 2. pour de vrai (ou en répétition : voix accélérée, une capture par réplique)
  const t = new Tournage({ ...o, chapitres: chapitres.length, textes: textes.length, durees, repetition, facteur: repetition ? 0.15 : 1 });
  await t.ouvrir();
  if (repetition) {
    rmSync(join(o.dossier, 'rep'), { recursive: true, force: true });
    t.maintenant = async () => Date.now();
  } else await t.demarrer();
  try {
    await f.scenario(repetition ? sauterJusqua(t, depuis) : t);
  } catch (e) {
    await t.p.screenshot({ path: join(o.dossier, 'echec.png') });
    await t.fermer();
    throw e;
  }
  if (repetition) { await t.fermer(); console.log('répétition finie :', join(o.dossier, 'rep')); return null; }
  await t.arreter();
  const dIntro = f.intro.repliques.reduce((a, r) => a + durees[cle(r)] + 0.2, 0) + 2.5;
  const res = await t.sommaire({ ...f.intro, duree: Math.ceil(dIntro) });
  await t.fermer();
  const liste = monter(res, voix, o.sortie, f.titre);
  writeFileSync(join(o.dossier, 'chapitres.json'), JSON.stringify({ chapitres: liste, total: res.total, fichier: f.fichier }, null, 1));
  console.log('fini :', o.sortie, mmss(res.total));
  liste.forEach(ch => console.log('  ' + ch.t.padStart(5) + '  ' + ch.titre));
  return { chapitres: liste, total: res.total };
}
