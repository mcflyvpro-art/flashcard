import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  accOpen, accounts, adm, asgs, auth, blocks, mates2, mods, myRole, ref,
  reportOn, reportWhy, school, setAnimate, setMenu, setReportOn, setReportWhy, team
} from '../data/etat.js';
import { render } from './bibliotheque.js';
import { initial } from './bilan-devoirs.js';
import { esc, plur } from '../core/coeur-sync.js';
import {
  joursDici, refCls, refEtab, refGens
} from './etablissement.js';
import { openMenu, mountMenu } from './menus-a.js';
import { cb, cf, timeAgo } from './reglages-corbeille.js';
import {
  classPull, matesPull, refPeople, refTrace, schoolPull, teamPull
} from '../core/classement.js';

/* ---------- classement ----------
   Les révisions de chacun restent privées : la fonction côté serveur ne
   rend qu'un décompte par compte, jamais le détail des cartes ni des
   erreurs. On compare un volume de travail, pas un contenu. */

/* Les motifs sont courts et nommés du point de vue de l'élève : « ça me
   harcèle » se trouve plus vite que « atteinte aux personnes ». */
const RAISONS = [
  ['harass', 'Harcèlement, menaces'],
  ['hate', 'Contenu haineux ou illégal'],
  ['sexual', 'Contenu sexuel'],
  ['private', 'Données personnelles de quelqu’un'],
  ['spam', 'Spam ou publicité'],
  ['copy', 'Copié sans autorisation'],
  ['other', 'Autre']
];

export function openReport(kind, id, user, label, snapshot) {
  setReportOn({ kind, id: String(id || ''), user: user || null, label: label || '', snapshot: snapshot || {} });
  setReportWhy('');
  openMenu('report');
}

export function reportSheet(w) {
  const r = reportOn;
  if (!r) { setMenu(null); return; }
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.warn)}<span class="mhx"><b>Signaler</b>
        <span class="msub">${esc(r.label || 'Ce contenu')} — le contenu est joint au signalement,
          même s’il est effacé ensuite. Rien n’est envoyé à la personne visée.</span></span></div>
      <div class="rlist">${RAISONS.map(([k, t]) =>
        `<button class="mi${reportWhy === k ? ' on' : ''}" data-why="${k}">
          ${svg(reportWhy === k ? I.check : I.arrow)}${t}</button>`).join('')}</div>
      <input class="tok" id="rnote" placeholder="Précision (facultatif)" maxlength="500">
      <button class="mi" data-mact="rsend" ${reportWhy ? '' : 'disabled'}
        style="justify-content:center;font-weight:700">${svg(I.share)}Envoyer le signalement</button>
      ${r.user ? `<div class="msep"></div>
        <button class="mi warn" data-mact="rblock">${svg(I.lock)}<span>Bloquer aussi ce compte</span></button>` : ''}
    </div>`;
  mountMenu(w);
}

/* La liste des comptes coupés, pour pouvoir revenir en arrière : un
   blocage qu'on ne peut pas défaire est une punition, pas un réglage. */
export function blockedSheet(w) {
  const l = blocks || [];
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.lock)}<span class="mhx"><b>Comptes bloqués</b>
        <span class="msub">Ils ne voient plus rien de toi, et toi non plus.</span></span></div>
      ${!l.length ? `<div class="note" style="padding:4px 18px 14px">Aucun compte bloqué.</div>`
        : `<div class="mscroll">${l.map(b => `<button class="mi" data-unblock="${esc(b.blocked_id)}">
             ${svg(I.redo)}<span>${esc(b.who || 'Un compte')}</span>
             <span class="tail">Débloquer</span></button>`).join('')}</div>`}
    </div>`;
  mountMenu(w);
}

const RNAME = Object.fromEntries(RAISONS);

const KNAME = { mail: 'Courrier', library: 'Étagère', duel: 'Défi', profile: 'Compte' };

/* La copie jointe s'affiche telle qu'elle a été prise : c'est la pièce du
   dossier, pas un aperçu à rafraîchir. */
function snapHtml(s) {
  if (!s || typeof s !== 'object') return '';
  const line = (k, v) => `<div class="sl"><i>${esc(k)}</i><span>${esc(v)}</span></div>`;
  let out = '';
  for (const [k, v] of Object.entries(s)) {
    if (k === 'cartes') continue;
    if (v) out += line(k, String(v).slice(0, 300));
  }
  const c = s.cartes;
  if (Array.isArray(c) && c.length) {
    out += `<div class="scards">${c.slice(0, 12).map(x => `<div class="pr">
      <span class="a">${esc(cf(x))}</span>${svg(I.arrow)}<span class="b">${esc(cb(x))}</span></div>`).join('')}
      ${c.length > 12 ? `<div class="note">…et ${c.length - 12} autres</div>` : ''}</div>`;
  }
  return out;
}

export function modView() {
  const l = mods.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Signalements</h1></div>
    <div class="page">
      ${!l ? `<div class="empty">${svg(I.warn)}<p>${mods.err ? 'Liste indisponible' : 'Chargement…'}</p></div>`
      : !l.length ? `<div class="empty">${svg(I.check)}<p><b>Rien à traiter</b>Tous les signalements sont classés.</p></div>`
      : `<div class="note" style="padding:0 0 14px">Un contenu signalé par deux comptes différents est déjà
           masqué automatiquement. Ce qui suit attend une décision.</div>
         ${l.map(r => `<div class="rep">
           <div class="rh"><b>${esc(KNAME[r.kind] || r.kind)}</b>
             <i>${esc(RNAME[r.reason] || r.reason)}</i>
             <span>${timeAgo(r.created_at)}</span></div>
           ${r.note ? `<div class="rn">${svg(I.quote)}<p>${esc(r.note)}</p></div>` : ''}
           <div class="rs">${snapHtml(r.snapshot)}</div>
           <div class="rb">
             <button data-modact="clear" data-rid="${r.id}">${svg(I.check)}Rien à signaler</button>
             <button class="warn" data-modact="hide" data-rid="${r.id}">${svg(I.eyeoff)}Masquer</button>
           </div>
         </div>`).join('')}`}
    </div>`;
}

const ROLES = { eleve: 'Élève', prof: 'Professeur',
                ref: 'Référent d’établissement', admin: 'Éditeur' };

const euros = c => (Math.round(+c || 0) / 100).toFixed(2).replace('.', ',') + ' €';

export function adminView() {
  const l = accounts, o = adm.orgs, e = adm.etat;
  const par = r => (l || []).filter(x => x.role === r);
  const onglet = (k, n) => `<button class="otab ${adm.tab === k ? 'on' : ''}" data-atab="${k}">${n}</button>`;
  const kc = (v, lab, cls) => `<div class="kc ${cls || ''}"><b>${v}</b><span>${lab}</span></div>`;

  const ligneOrg = x => {
    const ouverts = (x.eleves || 0) + (x.profs || 0) + (x.refs || 0);
    const venus = Math.max(0, ouverts - (x.jamais_venus || 0));
    const pris = ouverts ? Math.round(venus / ouverts * 100) : 0;
    return `<div class="rrow">
      <span class="c1"><b>${esc(x.name)}</b><i>${esc(x.ville || '')}${
        x.uai ? ' · ' + esc(x.uai) : ''}</i></span>
      <span class="c2">${x.classes} classes · ${x.eleves} él. · ${x.profs} prof.</span>
      <span class="c3">${venus} / ${ouverts} <em class="rl ${
        pris < 25 ? 'jamais' : pris < 60 ? 'vide' : ''}">${pris} % venus</em></span>
      <span class="c4">${x.actifs7} actifs 7 j · ${x.actifs30} sur 30 j</span>
      <span class="c5">${euros(x.cents_mois)} ce mois${
        +x.cents_total > +x.cents_mois ? ' · ' + euros(x.cents_total) + ' au total' : ''}</span>
    </div>`;
  };
  const ligneCpt = a => `<button class="rrow" data-account="${esc(a.id)}">
    <span class="c1"><b>${esc(a.name || a.handle || a.email)}</b><i>@${esc(a.handle || '')}</i></span>
    <span class="c2">${esc(a.email)}</span>
    <span class="c3"><em class="rl ${esc(a.role)}">${esc(ROLES[a.role] || a.role)}</em></span>
    <span class="c4">${plur(+a.livres, 'livre')}</span>
    <span class="c5">${a.bloque ? 'modère les signalements' : ''}</span></button>`;

  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Administration</h1></div>
    <div class="page dense">
      ${!l ? `<div class="empty">${svg(I.build)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.lock)}<p><b>Réservé à l’éditeur</b>
          Ce compte n’a pas ce rôle.</p></div>`
      : `${e ? `<div class="kpi six">
           ${kc(e.orgs, 'établissements')}${kc(e.comptes, 'comptes')}
           ${kc(e.hors_etab, 'hors établissement')}${kc(e.actifs7, 'actifs cette semaine')}
           ${kc(euros(e.cents_mois), 'd’IA ce mois')}
           ${kc(e.signalements, 'signalements', e.signalements ? 'ko' : '')}
         </div>` : ''}
         <div class="rtabs">${onglet('orgs', 'Établissements')}${onglet('cpt', 'Comptes')}</div>
         ${adm.tab === 'orgs' ? `
           <div class="note" style="padding:0 0 12px">L’écart entre comptes ouverts et comptes
             venus dit si le déploiement a pris. En dessous de 25 %, l’établissement n’a pas
             distribué le lien — c’est un problème de terrain, pas de produit.</div>
           ${!o ? `<div class="card2"><div class="note">Chargement…</div></div>`
             : !o.length ? `<div class="empty">${svg(I.build)}<p><b>Aucun établissement</b></p></div>`
             : `<div class="rtable">
                 <div class="rrow tete"><span class="c1">Établissement</span>
                   <span class="c2">Effectifs</span><span class="c3">Comptes venus</span>
                   <span class="c4">Usage réel</span><span class="c5">Coût IA</span></div>
                 ${o.map(ligneOrg).join('')}</div>`}
           <div class="note" style="padding:6px 0 0">⚠ Le plafond d’IA est encore global à tous
             les comptes (AI_BUDGET_USD), et non par établissement : un seul lycée actif l’épuise
             et la fonctionnalité s’éteint pour tout le monde. À remplacer avant la première vente.</div>`
         : `<div class="note" style="padding:0 0 12px">L’éditeur gère des accès. Il ne voit ni les
             fiches, ni la progression, ni le courrier de personne.</div>
           ${['admin', 'ref', 'prof', 'eleve'].map(r => par(r).length ? `
             <div class="lbl"><span>${esc(ROLES[r] || r)}${par(r).length > 1 ? 's' : ''}</span>
               <span>${par(r).length}</span></div>
             <div class="rtable">${par(r).map(ligneCpt).join('')}</div>` : '').join('')}`}`}
    </div>`;
}

export function accountSheet(w) {
  const a = (accounts || []).find(x => x.id === accOpen);
  if (!a) { setMenu(null); return; }
  const moi = a.id === auth.uid;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd"><i class="av">${esc(initial(a.handle || a.name || a.email))}</i>
        <span class="mhx"><b>${esc(a.name || a.handle || a.email)}</b>
          <i>${esc(a.email)}${a.handle ? ' · @' + esc(a.handle) : ''}</i></span></div>
      <div class="msep"></div>
      ${Object.entries(ROLES).map(([k, n]) => `
        <button class="mi${a.role === k ? ' on' : ''}" data-setrole="${k}" data-who="${esc(a.id)}"
          ${moi && k !== 'admin' ? 'disabled' : ''}>
          ${svg(a.role === k ? I.check : I.arrow)}${n}
          ${k === 'admin' ? '<span class="tail">instruit les signalements</span>' : ''}</button>`).join('')}
      ${moi ? `<div class="note" style="padding:6px 18px 12px">C’est ton compte : tu ne peux pas
        te retirer ton propre rôle, sinon plus personne ne pourrait rendre la main.</div>` : ''}
    </div>`;
  mountMenu(w);
}

export const atSchool = () => !!(school && school.org_id);

export const isPupil = () => atSchool() && myRole === 'eleve';

export const isProf = () => myRole === 'prof' || myRole === 'admin';

export const isAdmin = () => myRole === 'admin';

export const dueLabel = s => {
  if (!s) return '';
  const j = joursDici(s);
  return j < 0 ? (j === -1 ? 'hier' : `il y a ${-j} jours`)
       : j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : `dans ${j} jours`;
};

export function maClassePull() {
  if (school === null) schoolPull().then(() => { maClassePull(); setAnimate(false); render(); });
  if (school && school.class_id && !asgs) classPull(school.class_id);
  if (!team) teamPull();
  if (!mates2) matesPull();
}

function maClasseDevoirsHtml(retard, avenir, ligne) {
  if (!asgs) return `<div class="card2"><div class="note">Chargement…</div></div>`;
  if (!asgs.length) return `<div class="empty">${svg(I.card)}<p><b>Rien à faire</b>
            Tes professeurs n’ont pas encore donné de devoir.</p></div>`;
  return `${retard.length ? `<div class="slist">${retard.map(ligne).join('')}</div>` : ''}
           ${avenir.length ? `<div class="slist">${avenir.map(ligne).join('')}</div>` : ''}`;
}

function maClasseProfsHtml() {
  if (!team) return `<div class="card2"><div class="note">Chargement…</div></div>`;
  if (!team.length) return `<div class="card2"><div class="note">Aucun cours renseigné.</div></div>`;
  return `<div class="profs">${team.map(t => `<div class="pf">
            <i class="av sm">${esc(initial(t.teacher))}</i>
            <span class="ml2"><span class="n">${esc(t.subject)}</span>
              <span class="sub">${esc(t.teacher)}${t.principal ? ' · professeur principal' : ''}</span></span>
            </div>`).join('')}</div>`;
}

const maClasseCamaradeLigne = m => `<div class="sr flat">
            <i class="av sm">${esc(initial(m.name))}</i>
            <span class="ml2"><span class="n">${esc(m.name)}</span>
              <span class="sub">@${esc(m.handle || '')}</span></span>
            ${m.lien === 'ok' ? `<button class="camo" data-mate="${esc(m.id)}">${svg(I.arrow)}</button>`
              : m.lien ? `<span class="camw">demandé</span>`
              : `<button class="camadd" data-camadd="${esc(m.id)}" data-camn="${esc(m.handle || '')}"
                   aria-label="Ajouter ${esc(m.name)}">${svg(I.plus)}</button>`}
            </div>`;

function maClasseCamaradesHtml(cam) {
  if (!mates2) return `<div class="card2"><div class="note">Chargement…</div></div>`;
  if (!cam.length) return `<div class="card2"><div class="note">Tu es seul inscrit pour l’instant.</div></div>`;
  return `<div class="slist">${cam.map(maClasseCamaradeLigne).join('')}</div>`;
}

export function maClasseView() {
  if (!school || !school.class_id) {
    $.innerHTML = `
      <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
        <h1>Ma classe</h1></div>
      <div class="page"><div class="empty">${svg(I.school)}<p><b>Aucune classe</b>
        ${school === null ? 'Chargement…'
          : 'Ton établissement ne t’a pas encore inscrit dans une classe. Préviens ton professeur principal.'}</p></div></div>`;
    return;
  }
  const c = school;
  const l = asgs || [];
  /* Les devoirs en retard d'abord : c'est la seule chose qui presse. */
  const retard = l.filter(a => a.due && Date.parse(a.due + 'T12:00:00') < Date.now());
  const avenir = l.filter(a => !retard.includes(a));
  const ligne = a => `<button class="sr flat${a.due && Date.parse(a.due + 'T12:00:00') < Date.now() ? ' tard' : ''}"
      data-work="${esc(a.id)}">${svg(I.card)}
    <span class="ml2"><span class="n">${esc(a.name)}</span>
      <span class="sub">${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</span></span>
    ${svg(I.arrow)}</button>`;
  const cam = mates2 || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.classe)}</h1></div>
    <div class="page">
      <div class="ecole">${svg(I.school)}<span><b>${esc(c.org)}</b>
        <i>${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
          c.effectif ? ' · ' + plur(c.effectif, 'élève') : ''}</i></span></div>

      <div class="lbl"><span>Devoirs</span><span>${l.length || ''}</span></div>
      ${maClasseDevoirsHtml(retard, avenir, ligne)}

      <div class="lbl"><span>Mes professeurs</span><span>${team ? team.length : ''}</span></div>
      ${maClasseProfsHtml()}

      <div class="lbl"><span>Ma classe</span><span>${cam.length || ''}</span></div>
      ${maClasseCamaradesHtml(cam)}
    </div>`;
}

/* Un bouton de la feuille la repeint, et repeindre efface ce qui est tapé.
   On relit donc les champs avant chaque repeinture : sans cela, choisir le
   rôle en dernier effaçait l'adresse, et choisir l'adresse en dernier
   effaçait le rôle — l'un ou l'autre, jamais les deux. */
const lireChamps = map => {
  const o = {};
  for (const [k, id] of Object.entries(map)) {
    const n = document.getElementById(id);
    if (n) o[k] = n.value;            // absent = on garde ce qu'on avait
  }
  return o;
};

export const lireNew = () => lireChamps({ mel: 'nmel', nom: 'nnom', pse: 'npse', pw: 'npw' });

export const lireClass = () => lireChamps({ nom: 'knom', niv: 'kniv', fil: 'kfil', pre: 'kpre' });

export function refView() {
  const b = ref.board;
  const onglet = (k, n) => `<button class="otab ${ref.tab === k ? 'on' : ''}" data-rtab="${k}">${n}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${b ? esc(b.org) : 'Mon établissement'}</h1></div>
    <div class="page dense">
      <div class="rtabs">${onglet('etab', 'Établissement')}${onglet('gens', 'Comptes')}${onglet('cls', 'Classes')}</div>
      ${ref.tab === 'etab' ? refEtab() : ref.tab === 'gens' ? refGens() : refCls()}
    </div>`;
  if (ref.tab === 'etab') refTrace();
  const q = document.getElementById('rq');
  if (q) {
    q.addEventListener('input', () => { ref.q = q.value; clearTimeout(refView.t);
      refView.t = setTimeout(() => refPeople(true), 220); });
    if (ref.tab === 'gens' && document.activeElement !== q && ref.q) {
      q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    }
  }
}
