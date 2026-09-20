import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { DAY } from '../fsrs.js';
import {
  auth, prefs, prof, ref, school, setAnimate
} from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { initial, profBilan } from './bilan-devoirs.js';
import { dueLabel } from './classement.js';
import { PAGE_REF, ROLENOM } from '../core/classement.js';
import { esc, plur } from '../core/coeur-sync.js';
import { profPull } from '../core/etablissement.js';
import { timeAgo } from './reglages-corbeille.js';

/* ---------- onglet « Établissement » ---------- */
export function refEtab() {
  const b = ref.board;
  if (b === null) return `<div class="empty">${svg(I.build)}<p>Chargement…</p></div>`;
  if (!b) return `<div class="empty">${svg(I.lock)}<p><b>Réservé au référent</b>
    </p></div>`;
  const kc = (n, lab, cls) => `<div class="kc ${cls || ''}"><b>${n}</b><span>${lab}</span></div>`;
  /* Les trois chiffres du bas sont les seuls qui appellent une action. On
     les met à part, et on dit quoi faire — pas seulement combien. */
  const souci = (n, lab, quoi) => !n ? '' : `<div class="rsou">
    <b>${n}</b><span>${lab}</span><i>${quoi}</i></div>`;
  return `
    <div class="rhead">
      <div><b>${esc(b.org)}</b>
        <i>${esc(b.ville || '')}${b.uai ? ' · UAI ' + esc(b.uai) : ''}${
          b.kind ? ' · ' + esc(b.kind) : ''}</i></div>
    </div>
    <div class="kpi six">
      ${kc(b.classes, 'classes')}${kc(b.eleves, 'élèves')}${kc(b.profs, 'professeurs')}
      ${kc(b.services, 'services')}${kc(b.devoirs, 'devoirs donnés')}
      ${kc(b.actifs7, 'ont révisé cette semaine', b.actifs7 ? '' : 'am')}
    </div>
    <div class="lbl"><span>Ce qui demande une décision</span></div>
    ${!b.jamais_venus && !b.sans_classe && !b.classes_vides && !b.sans_pp
      ? `<div class="card2"><div class="note">Rien à reprendre : tous les comptes sont
          rattachés, toutes les classes ont des élèves et un professeur principal.</div></div>`
      : `<div class="rsous">
          ${souci(b.jamais_venus, 'comptes jamais utilisés',
            'Ouverts, mais personne ne s’est connecté. C’est là que le déploiement se joue.')}
          ${souci(b.sans_classe, 'élèves sans classe',
            'Ils ne recevront aucun devoir tant qu’ils ne sont pas rattachés.')}
          ${souci(b.classes_vides, 'classes vides',
            'Créées mais sans aucun élève inscrit.')}
          ${souci(b.sans_pp, 'classes sans professeur principal',
            'Personne n’y est désigné référent pédagogique.')}
        </div>`}
    <div class="lbl"><span>Ouvrir un compte</span></div>
    <div class="duo ghost gros">
      <button data-act="refnew">${svg(I.plus)}Nouveau compte</button>
      <button data-act="refnewclass">${svg(I.plus)}Nouvelle classe</button>
    </div>
    <div class="lbl"><span>Dernières modifications</span></div>
    <div id="rtrace" class="note">Chargement du journal…</div>`;
}

/* ---------- onglet « Comptes » ---------- */
export function refGens() {
  const l = ref.gens;
  const pages = Math.ceil(ref.total / PAGE_REF) || 1;
  const filtre = (k, n) => `<button class="p ${ref.role === k ? 'on' : ''}" data-rrole="${k}">${n}</button>`;
  const ligne = g => `<button class="rrow" data-rwho="${esc(g.id)}">
    <span class="c1"><b>${esc(g.name)}</b><i>@${esc(g.handle || '')}</i></span>
    <span class="c2">${esc(g.email)}</span>
    <span class="c3"><em class="rl ${esc(g.role)}">${esc(ROLENOM[g.role] || g.role)}</em></span>
    <span class="c4">${g.classe ? esc(g.classe) : g.matiere ? esc(g.matiere)
      : `<em class="rl vide">sans classe</em>`}</span>
    <span class="c5">${g.jamais ? '<em class="rl jamais">jamais venu</em>'
      : timeAgo(g.derniere)}</span></button>`;
  return `
    <div class="rbar">
      <div class="fld addf"><input id="rq" type="search" placeholder="Nom, pseudo ou adresse"
        autocomplete="off" spellcheck="false" value="${esc(ref.q)}" aria-label="Chercher un compte"></div>
      <div class="pills">${filtre('', 'Tous')}${filtre('eleve', 'Élèves')}${filtre('prof', 'Professeurs')}${
        filtre('ref', 'Référents')}</div>
    </div>
    <div class="rcount">${ref.total ? `<b>${ref.total}</b> compte${ref.total > 1 ? 's' : ''}${
        ref.cls ? ' dans cette classe' : ''}${ref.q ? ' pour « ' + esc(ref.q.trim()) + ' »' : ''}`
      : l ? 'Aucun résultat' : 'Recherche…'}
      ${ref.cls ? `<button class="lnk" data-rclsoff="1">retirer le filtre de classe</button>` : ''}</div>
    ${!l ? `<div class="empty">${svg(I.users)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.search)}<p><b>Aucun résultat</b></p></div>`
      : `<div class="rtable">
          <div class="rrow tete"><span class="c1">Nom</span><span class="c2">Adresse</span>
            <span class="c3">Rôle</span><span class="c4">Classe ou matière</span>
            <span class="c5">Dernière venue</span></div>
          ${l.map(ligne).join('')}
        </div>
        ${pages > 1 ? `<div class="rpage">
          <button ${ref.page ? '' : 'disabled'} data-rpage="${ref.page - 1}">Précédent</button>
          <span>page ${ref.page + 1} sur ${pages}</span>
          <button ${ref.page + 1 < pages ? '' : 'disabled'} data-rpage="${ref.page + 1}">Suivant</button>
        </div>` : ''}`}`;
}

/* ---------- onglet « Classes » ---------- */
export function refCls() {
  const l = ref.classes;
  const ligne = c => {
    const plein = c.prevu ? Math.round(c.effectif / c.prevu * 100) : 0;
    return `<button class="rrow" data-rcls="${esc(c.id)}">
      <span class="c1"><b>${esc(c.name)}</b><i>${esc(c.niveau || '')}${
        c.filiere ? ' · ' + esc(c.filiere) : ''}</i></span>
      <span class="c2">${c.effectif}${c.prevu ? ' / ' + c.prevu : ''}${
        plein > 105 ? ' <em class="rl jamais">surchargée</em>' : ''}</span>
      <span class="c3">${c.pp ? esc(c.pp) : '<em class="rl vide">pas de PP</em>'}</span>
      <span class="c4">${plur(c.profs, 'professeur')}</span>
      <span class="c5">${c.actifs7} actif${c.actifs7 > 1 ? 's' : ''} · code ${esc(c.code || '—')}</span>
    </button>`;
  };
  const groupes = [];
  for (const c of l || []) {
    const k = c.cycle || 'autre';
    const g = groupes.find(x => x.k === k);
    (g || (groupes.push({ k, l: [] }), groupes[groupes.length - 1])).l.push(c);
  }
  return `
    <div class="duo ghost"><button data-act="refnewclass">${svg(I.plus)}Créer une classe</button></div>
    ${!l ? `<div class="empty">${svg(I.school)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.school)}<p><b>Aucune classe</b></p></div>`
      : groupes.map(g => `
          <div class="lbl"><span>${esc(CYCLES[g.k] || 'Autres')}</span><span>${g.l.length}</span></div>
          <div class="rtable">
            <div class="rrow tete"><span class="c1">Classe</span><span class="c2">Effectif</span>
              <span class="c3">Professeur principal</span><span class="c4">Équipe</span>
              <span class="c5">Activité</span></div>
            ${g.l.map(ligne).join('')}
          </div>`).join('')}`;
}

export const CYCLES = { college: 'Collège', lycee_gt: 'Lycée général', lycee_techno: 'Lycée technologique',
                 lycee_pro: 'Lycée professionnel', cpge: 'CPGE' };

/* ---------- petits calculs d'affichage ---------- */
export const pcClass = p => p >= 70 ? 'ok' : p >= 45 ? 'am' : 'ko';

/* Les dates voyagent en AAAA-MM-JJ, se lisent en JJ/MM, et se choisissent
   dans un calendrier. Aucun décalage de fuseau : on ne construit jamais de
   Date à partir d'une chaîne courte sans heure. */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
  String(d.getDate()).padStart(2, '0')}`;

export const dansJours = n => iso(new Date(Date.now() + n * DAY));

export const auJour = s => s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null;

export const joursDici = s => Math.round((auJour(s) - auJour(iso(new Date()))) / DAY);

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const jourFr = s => s ? s.split('-').reverse().slice(0, 2).join('/') : '';

/* Un élève n'a qu'un état à la fois, et c'est le plus grave qui compte. */
export function etatEleve(m) {
  if (m.jamais) return { k: 'jamais', t: 'Jamais connecté' };
  if (m.retard) return { k: 'ko', t: m.retard > 1 ? m.retard + ' devoirs en retard' : '1 devoir en retard' };
  if (!m.donnes) return { k: '', t: 'Aucun devoir donné' };
  if (m.rendus === m.donnes) return { k: 'ok', t: 'À jour' };
  return { k: 'am', t: `${m.donnes - m.rendus} en cours` };
}

/* ══════════ le calendrier ══════════
   Deux usages, une seule grille : choisir une date de rendu, et regarder le
   mois pour voir ce qui tombe quand. Les semaines commencent le lundi, et
   les jours passés d'un mois scolaire restent cliquables — on repousse une
   échéance, on la recule aussi.

   `marques` associe une date à ce qu'il y a dessus ; le jour porte alors une
   pastille et son compte. */
function moisGrille(ancre, choisi, marques, prefixe) {
  const a = ancre.getFullYear(), m = ancre.getMonth();
  const premier = new Date(a, m, 1);
  const decal = (premier.getDay() + 6) % 7;           // lundi = 0
  const jours = new Date(a, m + 1, 0).getDate();
  const auj = iso(new Date());
  let cases = '';
  for (let i = 0; i < decal; i++) cases += '<span class="cal-v"></span>';
  for (let d = 1; d <= jours; d++) {
    const k = iso(new Date(a, m, d));
    const mk = marques && marques[k];
    cases += `<button class="cal-j${k === choisi ? ' on' : ''}${k === auj ? ' auj' : ''}${
      k < auj ? ' passe' : ''}${mk ? ' plein' : ''}" data-${prefixe}="${k}">
      <b>${d}</b>${mk ? `<i>${mk.length}</i>` : ''}</button>`;
  }
  return `<div class="cal-t">${JOURS.map(j => `<span>${j}</span>`).join('')}</div>
    <div class="cal-g">${cases}</div>`;
}

export function calendrier(ancre, choisi, marques, prefixe, saut) {
  const a = ancre.getFullYear(), m = ancre.getMonth();
  return `<div class="cal">
    <div class="cal-h">
      <button class="cal-f" data-${saut}="${iso(new Date(a, m - 1, 1))}"
        aria-label="Mois précédent">${svg(I.back)}</button>
      <b>${MOIS[m]} ${a}</b>
      <button class="cal-f" data-${saut}="${iso(new Date(a, m + 1, 1))}"
        aria-label="Mois suivant">${svg(I.arrow)}</button>
    </div>
    ${moisGrille(ancre, choisi, marques, prefixe)}
  </div>`;
}

/* ══════════ 1. Mes classes — la page d'accueil du professeur ══════════ */
export function profView() {
  const l = prof.classes;
  const som = k => (l || []).reduce((a, c) => a + (c[k] || 0), 0);
  const retard = som('retard'), jamais = som('jamais'), eleves = som('effectif');
  const encours = som('encours'), actifs = som('actifs7');

  const tuile = c => {
    const chaud = c.retard > 0 || c.jamais > 0;
    return `<button class="kls${chaud ? ' chaud' : ''}" data-pclasse="${esc(c.id)}">
      <span class="kn">${esc(c.name)}
        ${c.principal ? '<i class="pp">PP</i>' : ''}
        <em class="keff">${c.effectif}</em></span>
      <span class="ks">${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
        c.matiere ? ' · ' + esc(c.matiere) : ''}</span>
      <span class="kw">
        ${c.retard ? `<em class="ko">${c.retard} en retard</em>` : ''}
        ${c.pas_ouvert ? `<em class="am">${c.pas_ouvert} sans ouvrir</em>` : ''}
        ${c.jamais ? `<em class="gris">${c.jamais} jamais connectés</em>` : ''}
        ${!c.retard && !c.pas_ouvert && !c.jamais && c.devoirs ? '<em class="ok">à jour</em>' : ''}
        ${!c.devoirs ? '<em class="gris">aucun devoir donné</em>' : ''}
      </span>
      ${c.dernier ? `<span class="kd">${svg(I.card)}<b>${esc(c.dernier)}</b>
        <i>${c.dernier_due ? dueLabel(c.dernier_due) : ''}</i></span>` : ''}
      ${c.devoirs ? `<span class="kbar"><i class="${pcClass(c.pct)}"
          style="width:${Math.max(2, c.pct)}%"></i></span>
        <span class="kp">${c.pct} % de réussite au dernier devoir · ${
          plur(c.encours, 'devoir')} en cours</span>` : ''}
    </button>`;
  };

  const groupes = [];
  for (const c of l || []) {
    const k = c.cycle || 'autre';
    const g = groupes.find(x => x.k === k);
    (g || (groupes.push({ k, l: [] }), groupes[groupes.length - 1])).l.push(c);
  }
  const an = prof.annees || [];

  $.innerHTML = `
    <div class="bar">
      <h1>Mes classes</h1>
      ${an.length > 1 ? `<select class="anne" id="pan" aria-label="Année scolaire">
        ${an.map(a => `<option value="${esc(a.annee)}"${a.annee === prof.annee ? ' selected' : ''}
          >${esc(a.annee)}</option>`).join('')}</select>`
        : `<span class="anne fixe">${esc(prof.annee || '')}</span>`}
    </div>
    <div class="page console">
      ${school && school.org ? `<div class="ecole">${svg(I.school)}<span>
        <b>${esc(prefs.name || auth.email)}</b>
        <i>${esc(school.org)}${school.ville ? ' · ' + esc(school.ville) : ''}</i></span></div>` : ''}

      ${!l ? '' : `<div class="kpi cinq">
        <div class="kc"><b>${l.length}</b><span>classes</span></div>
        <div class="kc"><b>${eleves}</b><span>élèves</span></div>
        <div class="kc"><b>${encours}</b><span>devoirs en cours</span></div>
        <div class="kc ${retard ? 'ko' : ''}"><b>${retard}</b><span>élèves en retard</span></div>
        <div class="kc ${jamais ? 'am' : ''}"><b>${jamais}</b><span>jamais connectés</span></div>
      </div>`}

      <div class="duo ghost gros">
        <button data-act="pnew">${svg(I.plus)}Créer et donner un devoir</button>
        ${actifs ? `<button data-act="pbilan">${svg(I.chart)}${actifs} élèves actifs cette semaine</button>` : ''}
      </div>

      ${!l ? `<div class="empty">${svg(I.school)}<p>${prof.err ? 'Liste indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.school)}<p><b>Aucune classe cette année</b></p></div>`
        : groupes.map(g => `
            <div class="lbl"><span>${esc(CYCLES[g.k] || 'Autres classes')}</span><span>${g.l.length}</span></div>
            <div class="grille">${g.l.map(tuile).join('')}</div>`).join('')}
    </div>`;
  const sel = document.getElementById('pan');
  if (sel) sel.addEventListener('change', () => {
    prof.annee = sel.value; prof.classes = null; prof.open = null;
    profPull(); setAnimate(false); render();
  });
}

/* ══════════ 2. Une classe ══════════ */
export function profClasseView() {
  const c = (prof.classes || []).find(x => x.id === prof.open);
  if (!c) return go('prof');
  const onglet = (k, n, b) => `<button class="otab ${prof.tab === k ? 'on' : ''}" data-ptab="${k}">${n}${
    b ? `<em>${b}</em>` : ''}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="prof" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.name)}</h1>
      <span class="anne fixe">${esc(c.annee_scolaire || '')}</span></div>
    <div class="page console">
      <div class="ecole">${svg(I.school)}<span>
        <b>${esc(c.name)}${c.principal ? ' · tu en es professeur principal' : ''}</b>
        <i>${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
          c.matiere ? ' · ' + esc(c.matiere) : ''} · ${plur(c.effectif, 'élève')}</i></span>
        <button class="cbtn" data-act="pcode">${svg(I.key)}Code</button></div>

      <div class="duo ghost gros">
        <button data-act="pnew">${svg(I.plus)}Créer et donner un devoir</button>
        <button data-act="plib">${svg(I.book)}Donner un livre de ma bibliothèque</button>
      </div>

      <div class="rtabs">
        ${onglet('eleves', 'Élèves', c.effectif)}
        ${onglet('devoirs', 'Devoirs', prof.devoirs ? prof.devoirs.filter(d => d.mien).length : '')}
        ${onglet('bilan', 'Bilan', '')}
      </div>
      ${prof.tab === 'devoirs' ? profDevoirs() : prof.tab === 'bilan' ? profBilan(c) : profEleves(c)}
    </div>`;
  const q = document.getElementById('pq');
  if (q) q.addEventListener('input', () => {
    prof.q = q.value;
    const v = prof.q.trim().toLowerCase();
    $.querySelectorAll('.elvs .elv').forEach(n => {
      n.hidden = !!v && !n.textContent.toLowerCase().includes(v);
    });
    const cnt = document.getElementById('pcount');
    if (cnt) cnt.textContent = $.querySelectorAll('.elvs .elv:not([hidden])').length;
  });
}

/* ---------- onglet Élèves ---------- */
function profEleves(c) {
  const r = prof.roster;
  const TRI = { retard: 'Qui décroche', nom: 'Ordre alphabétique',
                note: 'Meilleurs résultats', vu: 'Activité récente' };
  const vus = (r || []).slice().sort((x, y) =>
      prof.tri === 'nom' ? String(x.who).localeCompare(y.who, 'fr')
    : prof.tri === 'note' ? (y.pct - x.pct) || String(x.who).localeCompare(y.who, 'fr')
    : prof.tri === 'vu' ? (y.pages7 - x.pages7) || String(x.who).localeCompare(y.who, 'fr')
    : (y.retard - x.retard) || (y.jamais - x.jamais) || (x.pct - y.pct)
      || String(x.who).localeCompare(y.who, 'fr'));

  const ligne = m => {
    const e = etatEleve(m);
    return `<button class="elv ${e.k}" data-peleve="${esc(m.user_id)}">
      <i class="av sm">${esc(initial(m.who))}</i>
      <span class="en"><b>${esc(m.who)}</b><i>@${esc(m.handle || '')}</i></span>
      <span class="ev"><b>${m.rendus}<em>/${m.donnes}</em></b><i>rendus</i></span>
      <span class="ev"><b class="${m.pct ? pcClass(m.pct) : ''}">${m.pct || '—'}${
        m.pct ? ' %' : ''}</b><i>réussite</i></span>
      <span class="ev"><b>${m.pages7 || '—'}</b><i>pages sur 7 j</i></span>
      <span class="ev"><b>${m.jamais ? '—' : m.vu ? timeAgo(m.vu) : 'jamais'}</b><i>dernier rendu</i></span>
      <span class="etat ${e.k}">${e.t}</span>
      <span class="ebar"><i class="${pcClass(Math.round(m.rendus / (m.donnes || 1) * 100))}"
        style="width:${Math.max(2, Math.round(m.rendus / (m.donnes || 1) * 100))}%"></i></span>
    </button>`;
  };
  return `
    <div class="triq">
      <div class="fld addf"><input id="pq" type="search" placeholder="Chercher un élève"
        autocomplete="off" spellcheck="false" value="${esc(prof.q)}" aria-label="Chercher un élève"></div>
      <div class="pills">${Object.entries(TRI).map(([k, n]) =>
        `<button class="p ${prof.tri === k ? 'on' : ''}" data-ptri="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="rcount"><b id="pcount">${(r || []).length}</b> élèves ·
      ${(r || []).filter(m => m.retard).length} en retard ·
      ${(r || []).filter(m => m.jamais).length} jamais connectés</div>
    ${!r ? `<div class="card2"></div>`
      : !r.length ? `<div class="empty">${svg(I.users)}<p><b>Aucun élève inscrit</b></p></div>`
      : `<div class="elvs">${vus.map(ligne).join('')}</div>`}`;
}

/* ---------- onglet Devoirs ----------
   Deux façons de regarder la même chose : la liste, pour l'état de chacun,
   et le mois, pour voir ce qui tombe quand — et surtout quel jour on a déjà
   trois devoirs posés sur la même classe. */
function profDevoirs() {
  const l = prof.devoirs;
  if (prof.vue === 'cal') return profMois(l);
  const mien = (l || []).filter(d => d.mien);
  const autres = (l || []).filter(d => !d.mien);
  const ligne = d => {
    const tard = d.due && joursDici(d.due) < 0;
    const pas = Math.max(0, (d.effectif || 0) - (d.ouvert || 0));
    return `<button class="dvr${tard ? ' tard' : ''}" data-pwork="${esc(d.id)}">
      <span class="c1"><b>${esc(d.nom)}</b>
        <i>${plur(d.n, 'page')}${d.matiere ? ' · ' + esc(d.matiere) : ''}${
          d.mien ? '' : ' · ' + esc(d.auteur)}</i></span>
      <span class="an"><b>${d.rendu}</b><i>/ ${d.effectif} rendus</i></span>
      <span class="an ${pas ? 'ko' : ''}"><b>${pas}</b><i>sans ouvrir</i></span>
      <span class="an"><b class="${d.pct ? pcClass(d.pct) : ''}">${d.pct || '—'}</b><i>% juste</i></span>
      <span class="an"><b>${d.due ? jourFr(d.due) : '—'}</b><i>${
        d.due ? dueLabel(d.due) : ''}</i></span>
      ${svg(I.arrow)}</button>`;
  };
  return `${vueBascule()}
    ${!l ? `<div class="card2"></div>`
      : !l.length ? `<div class="empty">${svg(I.card)}<p><b>Aucun devoir</b></p></div>`
      : `${mien.length ? `<div class="lbl"><span>Mes devoirs</span><span>${mien.length}</span></div>
           <div class="dvrs">${mien.map(ligne).join('')}</div>` : ''}
         ${autres.length ? `<div class="lbl"><span>Mes collègues</span><span>${autres.length}</span></div>
           <div class="dvrs">${autres.map(ligne).join('')}</div>` : ''}`}`;
}

const vueBascule = () => `<div class="vbasc">
  <button class="${prof.vue === 'liste' ? 'on' : ''}" data-pvue="liste">${svg(I.rows)}Liste</button>
  <button class="${prof.vue === 'cal' ? 'on' : ''}" data-pvue="cal">${svg(I.cal)}Calendrier</button>
</div>`;

/* Le mois de la classe ouverte. Un jour chargé se voit à sa pastille ;
   cliquer dessus déroule ce qui y tombe. */
function profMois(l) {
  const marques = {};
  for (const d of l || []) if (d.due) (marques[d.due] = marques[d.due] || []).push(d);
  const ancre = auJour(prof.mois || iso(new Date()));
  const jour = prof.jour && marques[prof.jour] ? marques[prof.jour] : null;
  return `${vueBascule()}
    ${calendrier(ancre, prof.jour, marques, 'pjour', 'pmois')}
    ${jour ? `<div class="lbl"><span>${jourLong(prof.jour)}</span><span>${jour.length}</span></div>
      <div class="dvrs">${jour.map(d => `<button class="dvr" data-pwork="${esc(d.id)}">
        <span class="c1"><b>${esc(d.nom)}</b><i>${plur(d.n, 'page')}${
          d.mien ? '' : ' · ' + esc(d.auteur)}</i></span>
        <span class="an"><b>${d.rendu}</b><i>/ ${d.effectif} rendus</i></span>
        <span class="an"><b class="${d.pct ? pcClass(d.pct) : ''}">${d.pct || '—'}</b><i>% juste</i></span>
        ${svg(I.arrow)}</button>`).join('')}</div>` : ''}`;
}

const jourLong = s => {
  const d = auJour(s); if (!d) return '';
  const J = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `${J[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};
