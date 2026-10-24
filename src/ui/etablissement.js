// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { iso, joursEntre } from '../classe.js';
import { ref } from '../data/etat.js';
import { PAGE_REF, ROLENOM } from '../core/classement.js';
import { esc, plur } from '../core/coeur-sync.js';
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

/* Les jours d'ici une échéance « AAAA-MM-JJ » (négatif si elle est passée),
   sans décalage de fuseau : le calcul vit dans le noyau (src/classe.js). */
export const joursDici = s => joursEntre(iso(new Date()), s);
