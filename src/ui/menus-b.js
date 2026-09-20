import { I, svg } from '../icones.js';
import { DAY } from '../fsrs.js';
import {
  auth, cardEdit, conflicts, db, duels, fnr, friends, groupOf, groups, helpKey, lib,
  mailOpen, mailbox, mateOpen, mateProf, mates, me, menu, prefs, previewOf, quiz, recorder,
  sel, sendMsg, sendTo, setMenu, setSendMsg, setSplitSize, splitSize, study, vers, view
} from '../data/etat.js';
import { SORTS } from './bibliotheque.js';
import { initial } from './bilan-devoirs.js';
import {
  LANGS, memLine, mimg, nextIn, plain
} from './carte-media.js';
import { deck, esc, metaOf, noDetect, plur, scopeName, shortWho, subj } from '../core/coeur-sync.js';
import { HELP } from './connexion.js';
import { myScore, rankOf } from './defis.js';
import { DUELQ } from '../core/defis.js';
import {
  backlog, dueCount, fnrNote, fnrScan, simpleMode
} from './import-cartes.js';
import { mountMenu } from './menus-a.js';
import { helpSheet } from './onboarding.js';
import { cb, cf, timeAgo } from './reglages-corbeille.js';
import { VERSN } from '../core/reglages-corbeille.js';

export function paintMenuCard(w) {
  const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    if (!c) { setMenu(null); return; }
    const med = (side, kind) => {
      const k = side + (kind === 'img' ? 'i' : 'a');
      const has = c[k];
      return `<button class="mb ${has ? 'on' : ''}" data-mact="med-${k}">
        ${kind === 'img' && has ? mimg('', has) : svg(kind === 'img' ? I.image : I.mic)}
        ${has ? `<i class="rmv" data-mact="del-${k}">${svg(I.x)}</i>` : ''}</button>`;
    };
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}
          <span class="mhx"><b>${esc(plain(c.f) || 'Carte')}</b>
            <i>${esc(plain(c.b)) || 'verso vide'}</i></span></div>
        ${c.S ? `<div class="mrow"><span class="ml">${svg(I.brain)}Mémoire</span>
          <span class="tail">${memLine(c)}</span></div>
          <div class="mrow"><span class="ml">${svg(I.clock)}Prochain passage</span>
          <span class="tail">${nextIn(c) || '—'}</span></div>` : ''}
        <div class="seg mseg">
          ${[['', 'Basique'], ['tf', 'Vrai / faux']].map(([v, l]) =>
            `<button data-ct="${v}" class="${(c.t || '') === v ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <div class="mrow">
          <span class="ml">Image et son du recto</span>${med('f', 'img')}${med('f', 'aud')}
        </div>
        <div class="mrow">
          <span class="ml">Image et son du verso</span>${med('b', 'img')}${med('b', 'aud')}
        </div>
        <input class="tok" id="ctags" placeholder="Étiquettes, séparées par des virgules"
          value="${esc((c.g || []).join(', '))}" autocapitalize="none" spellcheck="false">
        ${recorder ? `<button class="mi warn" data-mact="rec-stop"
          style="justify-content:center;font-weight:700">${svg(I.mic)}<span>Arrêter l’enregistrement</span></button>` : ''}
        <button class="mi" data-mact="card-ok"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>Enregistrer</span></button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuDeckset(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    const m = metaOf(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.gear)}Réglages du livre</div>
        <div class="mrow col"><span class="ml">${svg(I.target)}Tolérance du quiz</span>
          <div class="seg mseg">
            ${[['strict', 'Stricte'], ['normal', 'Normale'], ['soft', 'Souple']].map(([v, l]) =>
              `<button data-tol="${v}" class="${m.tol === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.sound)}Langue du recto</span>
          <div class="seg mseg wrap">
            ${LANGS.map(([v, l]) => `<button data-lgf="${v}" class="${m.langf === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.sound)}Langue du verso</span>
          <div class="seg mseg wrap">
            ${LANGS.map(([v, l]) => `<button data-lgb="${v}" class="${m.langb === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.clock)}Chrono par question</span>
          <div class="seg mseg">
            ${[[0, 'Aucun'], [5, '5 s'], [10, '10 s'], [20, '20 s']].map(([v, l]) =>
              `<button data-tm="${v}" class="${m.timer === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
      </div>`;
    mountMenu(w);
    return;
}

function corpsModeSimpleOn(bloc) {
  return [
      bloc('Ce qui s’arrête', [
        `Les échéances. Plus aucune carte n’arrive à date : les pastilles de rappel sur les
         paquets et le marathon toutes matières disparaissent.`,
        `Les quatre boutons <b>Encore · Difficile · Correct · Facile</b> disparaissent. Il ne
         reste que le balayage : à droite je sais, à gauche je ne sais pas.`,
        `La mémoire ne bouge plus. Une page revue en mode simple garde exactement la
         stabilité et la difficulté qu’elle avait — réviser en mode simple n’apprend rien
         au moteur.`,
        `La barre de maturité et les pastilles d’état ne s’affichent plus.`,
        `Le tri « Urgentes » disparaît : il n’y a plus de date pour trier.`
      ]),
      bloc('Ce qui est conservé', [
        `<b>Rien n’est effacé.</b> Stabilité, difficulté, échéance et historique de
         révisions restent écrits dans chaque page et t’attendent.`,
        `La récitation, l’objectif du jour, le résumé de fin de session, les courbes, les
         matières, les pages mises de côté et les sauvegardes fonctionnent à l’identique.`,
        `Les pages ratées continuent d’être comptées : le tri « Ratées » et les pages
         coriaces restent justes.`
      ]),
      bloc('Quand tu rallumeras le moteur', [
        `Il repartira exactement où il s’est arrêté, sans rien réapprendre.`,
        `Les cartes dont la date sera passée entre-temps seront <b>étalées automatiquement</b>
         sur plusieurs jours, à hauteur de ton objectif, pour t’éviter un rattrapage massif
         le même jour.`,
        `Les cartes jamais notées avant la bascule repartiront comme des cartes neuves.`
      ]),
      bloc('Bon à savoir', [
        `Le réglage appartient à ton compte : il suit sur tous tes appareils.`,
        `Une session en cours est abandonnée par la bascule, pour qu’aucune carte ne soit
         validée dans un mode et enregistrée dans l’autre.`,
        `Tu peux revenir en arrière à tout moment, ici même.`
      ])
  ].join('');
}

function corpsModeSimpleOff(bloc, n, per, j, since) {
  return [
      bloc('Ce qui revient', [
        `Les quatre boutons de notation, les échéances, les pastilles de rappel, la barre de
         maturité et le marathon.`,
        `Le calcul de la prochaine date : le moteur estime pour chaque page ta probabilité
         de t’en souvenir, puis la programme au jour où elle tombe sur ta rétention visée.
         Plus la page est solide, plus il attend ; plus elle résiste, plus il resserre.`
      ]),
      bloc('Où en est ta progression', [
        `Le moteur reprend au point exact où il s’était arrêté${since ? ` il y a ${since} jour${since > 1 ? 's' : ''}` : ''}.
         Aucune donnée n’a été perdue pendant le mode simple.`,
        n ? `<b>${n > 1 ? `${n} pages ont dépassé leur échéance.` : `Une page a dépassé son échéance.`}</b> ${n > per
              ? `Elles seront réparties sur ${j} jour${j > 1 ? 's' : ''}, environ ${per} par jour,
                 les plus anciennes d’abord.`
              : n > 1 ? `Elles seront à revoir dès la prochaine session.`
                      : `Elle sera à revoir dès la prochaine session.`}`
          : `Aucune carte en retard : la reprise se fera au fil de l’eau.`,
        `Les cartes vues en mode simple n’ont pas progressé. Celles qui n’avaient jamais été
         notées repartent comme des cartes neuves.`
      ])
  ].join('');
}

export function paintMenuSimple(w) {
  const on = menu === 'simple';
    const n = backlog(), per = Math.max(5, prefs.goal || 30), j = Math.max(1, Math.ceil(n / per));
    const ago = prefs.simpleAt ? Date.now() - prefs.simpleAt : 0;
    const since = ago >= DAY ? Math.round(ago / DAY) : 0;
    const bloc = (t, items) => `<div class="pvh">${t}</div><ul class="pvl">${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
    const body = on ? corpsModeSimpleOn(bloc) : corpsModeSimpleOff(bloc, n, per, j, since);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mi" style="font-weight:750">${svg(on ? I.swap : I.brain)}${on ? 'Passer en mode simple' : 'Rallumer le moteur'}</div>
        <div class="pvb">${body}</div>
        <button class="mi" data-mact="do-${on ? 'simple' : 'engine'}"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>${on ? 'Passer en mode simple' : 'Rallumer le moteur'}</span></button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuMerge(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    const others = db.decks.filter(x => x.id !== d.id);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.link)}Fusionner « ${esc(d.name)} » avec</div>
        <div class="mscroll">${others.map(x => `<button class="mi" data-merge="${x.id}">
          <i class="tri" style="--c:${subj(x.subject).c}"></i>${esc(x.name)}
          <span class="tail">${x.cards.length}</span></button>`).join('')}</div>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuFnr(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    const s = fnrScan(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.search)}Chercher et remplacer</div>
        <div class="frow"><input class="tok" id="fq" placeholder="Chercher" spellcheck="false"
          autocapitalize="none" value="${esc(fnr.q)}">
          <button class="cs ${fnr.cs ? 'on' : ''}" data-mact="fnrcase" title="Respecter la casse">Aa</button></div>
        <input class="tok" id="fr" placeholder="Remplacer par" spellcheck="false"
          autocapitalize="none" value="${esc(fnr.r)}">
        <div class="mrow col"><span class="ml">${svg(I.card)}Où chercher</span>
          <div class="seg mseg">
            ${[['both', 'Les deux'], ['f', 'Recto'], ['b', 'Verso']].map(([v, l]) =>
              `<button data-fside="${v}" class="${fnr.side === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="note" id="fnote">${fnrNote(s)}</div>
        <button class="mi" data-mact="dofnr" ${s.hits ? '' : 'disabled'}
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>Remplacer</span></button>
      </div>`;
    mountMenu(w);
    /* on ne repeint jamais la feuille en cours de frappe : cela arracherait
       le curseur du champ. Seuls le compte et le bouton se mettent à jour. */
    const q = document.getElementById('fq'), r = document.getElementById('fr');
    const refresh = () => {
      fnr.q = q.value; fnr.r = r.value;
      const k = fnrScan(d);
      document.getElementById('fnote').innerHTML = fnrNote(k);
      const btn = document.querySelector('[data-mact="dofnr"]');
      k.hits ? btn.removeAttribute('disabled') : btn.setAttribute('disabled', '');
    };
    q.addEventListener('input', refresh); r.addEventListener('input', refresh);
    setTimeout(() => q.focus(), 60);
    return;
}

export function paintMenuLeave(w) {
  const n = quiz && quiz.pool ? quiz.pool.length - quiz.i : study.queue.length - study.i;
    w.innerHTML = `<div class="scrim" data-mact="leavestay"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.warn)}Quitter cet exercice ?</div>
        <div class="note">Il reste ${plur(n, 'question')}. Cet exercice-là ne se reprend pas :
          en sortant maintenant, les réponses déjà données ne comptent pas.</div>
        <button class="mi" data-mact="leavestay" style="justify-content:center;font-weight:700">
          ${svg(I.play)}Continuer</button>
        <button class="mi warn" data-mact="leavego">${svg(I.exit)}<span>Quitter quand même</span></button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuSortpick(w) {
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.sort)}Trier les livres</div>
        ${Object.entries(SORTS).map(([k, l]) => `<button class="mi ${prefs.sort === k ? 'on' : ''}"
          data-sortby="${k}">${l}${prefs.sort === k ? svg(I.check) : ''}</button>`).join('')}
        <div class="msep"></div>
        <button class="mi" data-mact="reorderon">${svg(I.grip)}Réorganiser à la main</button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuPreview(w) {
  const d = deck(previewOf); if (!d) { setMenu(null); return; }
    const due = simpleMode() ? 0 : dueCount(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}
          <span class="mhx"><b>${esc(d.name)}</b>
            <i>${esc(subj(d.subject).name)} · ${plur(d.cards.length, 'page')}${due ? ' · ' + due + ' à revoir' : ''}</i>
          </span>
        </div>
        <div class="mpick">
          <button class="mg" data-mact="pkshare">${svg(I.share)}<span>Partager</span></button>
          <button class="mg" data-mact="pkfind">${svg(I.search)}<span>Chercher</span></button>
          <button class="mg" data-mact="pindeck">${svg(I.pin)}<span>${d.pinned ? 'Détacher' : 'Épingler'}</span></button>
          <button class="mg" data-mact="pkhide">${svg(d.hidden ? I.eye : I.eyeoff)}<span>${d.hidden ? 'Réafficher' : 'Masquer'}</span></button>
          <button class="mg ${d.cards.length > 3 ? '' : 'off'}" data-mact="pksplit">${svg(I.split)}<span>Scinder</span></button>
          <button class="mg" data-mact="pkset">${svg(I.gear)}<span>Réglages</span></button>
          <button class="mg warn" data-mact="pkdel">${svg(I.trash)}<span>Supprimer</span></button>
        </div>
        <button class="mi" data-mact="openpeek" style="justify-content:center;font-weight:700">
          ${svg(I.play)}Ouvrir le livre</button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuSharepick(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    const m = metaOf(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.share)}Partager « ${esc(d.name)} »</div>
        <button class="mi" data-mact="sendfriend">${svg(I.mail)}Prêter à un lecteur<span class="tail">${mates ? mates.length : ''}</span></button>
        <button class="mi" data-mact="rolink">${svg(I.link)}${m.tok ? 'Copier le lien de consultation' : 'Créer un lien de consultation'}</button>
        ${m.tok ? `<button class="mi warn" data-mact="roff">${svg(I.eyeoff)}Révoquer le lien</button>` : ''}
        <div class="msep"></div>
        ${m.pub ? `<button class="mi" data-mact="publish">${svg(I.book)}Mettre à jour sur l’étagère
                     <span class="tail">${esc(scopeName())}</span></button>
                   <button class="mi warn" data-mact="unpublish">${svg(I.x)}Retirer de l’étagère</button>`
          : `<button class="mi" data-mact="publish">${svg(I.book)}Poser sur l’étagère
               <span class="tail">${esc(scopeName())}</span></button>`}
        <button class="mi" data-mact="duelnew2">${svg(I.flame)}Lancer un défi<span class="tail">${Math.min(DUELQ, d.cards.length)}</span></button>
        <div class="msep"></div>
        <button class="mi" data-mact="copylink">${svg(I.down)}Lien hors ligne (tout le livre)</button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuHandle(w) {
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.user)}<span class="mhx"><b>Ton pseudo</b></span></div>
        <div class="fld addf"><span class="at">@</span><input id="hq" type="text"
          placeholder="pseudo" autocapitalize="none" autocomplete="off" spellcheck="false"
          value="${esc((me && me.handle) || '')}" aria-label="Ton pseudo"></div>
        <button class="mi" data-mact="savehandle" style="justify-content:center;font-weight:700">
          ${svg(I.check)}Enregistrer</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById('hq'); if (i) i.focus(); }, 80);
    return;
}

export function paintMenuNewgroup(w) {
  const join = menu === 'joingroup';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.layers)}<span class="mhx"><b>${join ? 'Rejoindre un club' : 'Créer un club'}</b>
          </span></div>
        <div class="fld addf"><input id="gq" type="text"
          placeholder="${join ? 'Code du club' : 'Nom du club'}" autocomplete="off"
          spellcheck="false" ${join ? 'autocapitalize="characters"' : ''}
          aria-label="${join ? 'Code du club' : 'Nom du club'}"></div>
        <button class="mi" data-mact="${join ? 'dojoin' : 'domake'}" style="justify-content:center;font-weight:700">
          ${svg(join ? I.link : I.plus)}${join ? 'Rejoindre' : 'Créer'}</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById('gq'); if (i) i.focus(); }, 80);
    return;
}

export function paintMenuMate(w) {
  const f = (mates || []).find(x => x.id === mateOpen);
    if (!f) { setMenu(null); return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(f.handle || f.name))}</i>
          <span class="mhx"><b>${esc(f.name || '')}</b><i>@${esc(f.handle || '')}</i></span></div>
        <button class="mi" data-mact="mateprof">${svg(I.chart)}Son journal de lecture</button>
        <button class="mi" data-mact="matesend">${svg(I.share)}Lui prêter un livre</button>
        <button class="mi warn" data-mact="matedrop">${svg(I.x)}<span>Retirer de mes lecteurs</span></button>
        <div class="msep"></div>
        <button class="mi" data-mact="matereport">${svg(I.warn)}<span>Signaler ce compte</span></button>
        <button class="mi warn" data-mact="mateblock">${svg(I.lock)}<span>Bloquer</span></button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuGroupitem(w) {
  const g = (groups || []).find(x => x.id === groupOf);
    if (!g) { setMenu(null); return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.layers)}<span class="mhx"><b>${esc(g.name)}</b>
          <i>${g.owner === auth.uid ? 'tu l’as créé' : 'tu en fais partie'}</i></span></div>
        <button class="mi" data-mact="gcode">${svg(I.copy)}Code d’invitation
          <span class="tail">${esc(g.code)}</span></button>
        <button class="mi warn" data-mact="gleave">${svg(I.exit)}<span>${
          g.owner === auth.uid ? 'Supprimer le club' : 'Quitter le club'}</span></button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuTuto(w) {
  return helpSheet(w);
}

export function paintMenuHelp(w) {
  const h = HELP[helpKey];
    if (!h) { setMenu(null); return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.bulb)}<span class="mhx"><b>${esc(h[0])}</b></span></div>
        <div class="note htxt">${esc(h[1]).replace(/\n/g, '<br>')}</div>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuVers(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    const l = vers.list;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.clock)}
          <span class="mhx"><b>Historique de « ${esc(d.name)} »</b>
            <i>les ${VERSN} dernières versions, avant chaque remplacement</i></span></div>
        ${!l ? `<div class="note">${vers.err ? 'Historique indisponible.' : 'Chargement…'}</div>`
          : !l.length ? `<div class="note">Rien encore. Une version est gardée avant chaque
              remplacement, fusion, découpe ou réimport.</div>`
          : `<div class="mscroll">${l.map(v => `<button class="mi" data-vers="${v.id}">
              ${svg(I.redo)}<span class="ml2"><span class="n">${esc(v.why || 'version')}</span>
                <span class="sub">${plur((v.cards || []).length, 'page')} · ${timeAgo(v.created_at)}</span></span>
              </button>`).join('')}</div>`}
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuConflict(w) {
  const c = conflicts[0];
    if (!c) { setMenu(null); return; }
    const side = (v, lab, when) => `<div class="cside">
      <b>${lab}</b><i>${plur(v.cards.length, 'page')}${when ? ' · ' + when : ''}</i>
      <span>${esc(v.name)}</span></div>`;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.warn)}
          <span class="mhx"><b>Modifié sur un autre appareil</b>
            <i>« ${esc(c.mine.name)} » a changé des deux côtés</i></span></div>
        <div class="note">Rien n’est perdu : tu peux garder les deux.</div>
        <div class="csides">
          ${side(c.mine, 'Ici', null)}
          ${side(c.theirs, 'Ailleurs', c.theirs.at ? timeAgo(c.theirs.at) : null)}
        </div>
        <button class="mi" data-mact="cfboth" style="justify-content:center;font-weight:700">
          ${svg(I.copy)}Garder les deux</button>
        <button class="mi" data-mact="cfmine">${svg(I.down)}Garder celle d’ici</button>
        <button class="mi" data-mact="cftheirs">${svg(I.cloud)}Prendre celle de l’autre appareil</button>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuLibitem(w) {
  const it = (lib.list || []).find(x => x.deck_id === lib.open);
    if (!it) { setMenu(null); return; }
    const mine = it.user_id === auth.uid;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.book)}
          <span class="mhx"><b>${esc(it.name)}</b>
            <i>${esc(noDetect(shortWho(it.who) || 'Un compte'))}${it.subject ? ' · ' + esc(it.subject) : ''}
              · ${plur(it.n, 'page')} · ${timeAgo(it.updated_at)}</i></span>
        </div>
        <div class="mscroll">${(it.cards || []).slice(0, 60).map(c => `<div class="pr">
          <span class="a">${esc(cf(c))}</span>${svg(I.arrow)}<span class="b">${esc(cb(c))}</span></div>`).join('')}</div>
        <button class="mi" data-mact="libadd" style="justify-content:center;font-weight:700">
          ${svg(I.plus)}Ajouter à ma bibliothèque</button>
        ${mine ? `<button class="mi warn" data-mact="libdrop">${svg(I.trash)}<span>Retirer de l’étagère</span></button>`
          : `<div class="msep"></div>
             <button class="mi" data-mact="libreport">${svg(I.warn)}<span>Signaler ce livre</span></button>
             <button class="mi warn" data-mact="libblock">${svg(I.lock)}<span>Bloquer ce compte</span></button>`}
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuDuelitem(w) {
  const du = (duels.list || []).find(x => x.id === duels.open);
    if (!du) { setMenu(null); return; }
    const r = rankOf(du.id), me = myScore(du.id), mine = du.owner === auth.uid;
    const MED = ['🥇', '🥈', '🥉'];
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.flame)}
          <span class="mhx"><b>${esc(du.name)}</b>
            <i>lancé par ${esc(noDetect(shortWho(du.who) || 'un compte'))} · ${plur(du.total, 'question')}
              · ${timeAgo(du.created_at)}</i></span>
        </div>
        <div class="mscroll">${r.length ? r.map((sc, i) => `<div class="bdr ${sc.user_id === auth.uid ? 'me' : ''}">
            <span class="bdp">${MED[i] || (i + 1)}</span>
            <span class="bdn"><b>${esc(shortWho(sc.who) || 'Compte')}</b>
              <i>${sc.score}/${du.total} · ${Math.round(sc.ms / 1000)} s</i></span></div>`).join('')
          : '<div class="note">Personne n’a encore joué.</div>'}</div>
        ${me ? ``
          : `<button class="mi" data-mact="duelgo" style="justify-content:center;font-weight:700">
              ${svg(I.play)}Jouer les ${du.total} questions</button>`}
        ${mine ? `<button class="mi warn" data-mact="dueldrop">${svg(I.trash)}<span>Supprimer le défi</span></button>` : ''}
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuDuelnew(w) {
  const list = db.decks.filter(x => x.cards.length >= 4);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.flame)}Défier le groupe</div>
        <div class="mscroll">${list.length ? list.map(x => `
          <button class="mi" data-dnew="${esc(x.id)}"><i class="tri" style="--c:${subj(x.subject).d}"></i>
            ${esc(x.name)}<span class="tail">${x.cards.length}</span></button>`).join('')
          : '<div class="note">Il faut un livre d’au moins 4 pages.</div>'}</div>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuSendfriend(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    /* seuls les lecteurs qui ont accepté : envoyer un livre à quelqu'un
       qui n'a pas encore répondu ne mène nulle part */
    const list = mates || [];
    const chosen = list.find(p => p.id === sendTo);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.mail)}Envoyer « ${esc(d.name)} » à</div>
        <div class="mscroll">${friends === null
          ? `<div class="mi" style="color:var(--soft)">Chargement…</div>`
          : !list.length ? `<div class="mi" style="color:var(--soft)">Aucun lecteur dans ton cercle pour l’instant.</div>`
          : list.map(p => `<button class="mi ${sendTo === p.id ? 'on' : ''}" data-friend="${p.id}">
              <i class="tri" style="--c:var(--soft)"></i>${esc(p.name || p.email)}
              ${sendTo === p.id ? svg(I.check) : ''}</button>`).join('')}</div>
        ${chosen ? `
          <textarea class="tok msgin" id="mmsg" rows="3" placeholder="Écris un mot à ${
            esc(shortWho(chosen.name || chosen.email))} (facultatif)">${esc(sendMsg)}</textarea>
          <button class="mi" data-mact="sendmail" style="justify-content:center;font-weight:700">
            ${svg(I.share)}Envoyer à ${esc(chosen.name || chosen.email)}</button>` : ''}
      </div>`;
    mountMenu(w);
    const ta = document.getElementById('mmsg');
    if (ta) { ta.addEventListener('input', () => setSendMsg(ta.value)); setTimeout(() => ta.focus(), 60); }
    return;
}

export function paintMenuLend(w) {
  const f = (mates || []).find(x => x.id === mateOpen);
    if (!f) { setMenu(null); return; }
    const mine = db.decks.filter(x => x.cards.length);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(f.handle || f.name))}</i>
          <span class="mhx"><b>Prêter à ${esc(shortWho(f.name || f.handle))}</b>
            <i>choisis un livre</i></span></div>
        <div class="mscroll">${mine.length
          ? mine.map(x => `<button class="mi" data-lend="${esc(x.id)}">
              <i class="tri" style="--c:${subj(x.subject).d}"></i>${esc(x.name)}
              <span class="tail">${plur(x.cards.length, 'page')}</span></button>`).join('')
          : `<div class="mi" style="color:var(--soft)">Ta bibliothèque est vide.</div>`}</div>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuMateprof(w) {
  const f = (mates || []).find(x => x.id === mateOpen);
    if (!f) { setMenu(null); return; }
    const r = mateProf.row, l = mateProf.lib;
    const pctok = r && +r.n ? Math.round(r.ok / r.n * 100) : 0;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(f.handle || f.name))}</i>
          <span class="mhx"><b>${esc(f.name || '')}</b><i>@${esc(f.handle || '')}</i></span></div>
        <div class="seg" style="margin:0 12px 10px">
          ${[[7, '7 jours'], [30, '30 jours'], [0, 'Tout']].map(([v, lab]) =>
            `<button data-mrange="${v}" class="${mateProf.range === v ? 'on' : ''}">${lab}</button>`).join('')}
        </div>
        ${mateProf.load && !r ? `` : `
          <div class="tiles st4" style="margin:0 12px 12px">
            <div class="st"><b>${r ? +r.n : 0}</b><span>pages lues</span></div>
            <div class="st"><b>${pctok}%</b><span>de réussite</span></div>
            <div class="st"><b>${r ? +r.jours : 0}</b><span>jours de lecture</span></div>
            <div class="st"><b>${l ? l.length : 0}</b><span>livres partagés</span></div>
          </div>`}
        <div class="msep"></div>
        <div class="mi" style="font-weight:750">${svg(I.book)}Ses livres dans la bibliothèque</div>
        <div class="mscroll">${l === null ? ``
          : l.length ? l.map(x => `<div class="mi">
              <i class="tri" style="--c:var(--soft)"></i>${esc(x.name)}
              <span class="tail">${plur(+x.n, 'page')}</span></div>`).join('')
          : `<div class="note">Il n’a rien partagé pour l’instant.</div>`}</div>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuMailitem(w) {
  const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen);
    if (!it) { setMenu(null); return; }
    const n = (it.cards || []).length;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.mail)}
          <span class="mhx"><b>${esc(it.deck_name)}</b>
            <i>${esc(noDetect(it.from_name || 'Un ami'))} · ${plur(n, 'page')} · ${timeAgo(it.created_at)}</i>
          </span>
        </div>
        ${it.message ? `<div class="mmsg">${svg(I.quote)}<p>${esc(it.message)}</p></div>` : ''}
        <div class="mscroll">${(it.cards || []).slice(0, 60).map(c => `<div class="pr">
          <span class="a">${esc(c[0])}</span>${svg(I.arrow)}<span class="b">${esc(c[1])}</span></div>`).join('')}</div>
        <button class="mi" data-mact="addmail" style="justify-content:center;font-weight:700">
          ${svg(it.added_at ? I.check : I.plus)}${it.added_at ? 'Déjà dans ma bibliothèque · Ajouter à nouveau' : 'Ajouter à ma bibliothèque'}</button>
        <button class="mi warn" data-mact="delmail">${svg(I.trash)}<span>Supprimer</span></button>
        ${it.from_user && it.from_user !== auth.uid ? `<div class="msep"></div>
          <button class="mi" data-mact="mailreport">${svg(I.warn)}<span>Signaler cet envoi</span></button>
          <button class="mi warn" data-mact="mailblock">${svg(I.lock)}<span>Bloquer l’expéditeur</span></button>` : ''}
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuMove(w) {
  const d = deck(view.id); if (!d || !sel) { setMenu(null); return; }
    const n = [...sel].filter(i => d.cards.some(c => c.id === i)).length;
    const others = db.decks.filter(x => x.id !== d.id);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.out)}Déplacer ${n} carte${n > 1 ? 's' : ''} vers</div>
        <div class="mscroll">${others.map(x => `<button class="mi" data-move="${x.id}">
          <i class="tri" style="--c:${subj(x.subject).c}"></i>${esc(x.name)}
          <span class="tail">${x.cards.length}</span></button>`).join('')}</div>
      </div>`;
    mountMenu(w);
    return;
}

export function paintMenuSplit(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
    const n = d.cards.length;
    const size = Math.min(Math.max(2, splitSize), n - 1);
    const parts = Math.ceil(n / size), last = n - size * (parts - 1);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.split)}Scinder « ${esc(d.name)} »</div>
        <div class="mrow col"><span class="ml">${svg(I.card)}Pages par livre
          <b class="tail">${size}</b></span>
          <input class="rng" id="spSize" type="range" min="2" max="${n - 1}" step="1" value="${size}">
        </div>
        <div class="note">${n} pages → <b>${parts} livres</b> de ${size}${
          last !== size ? `, le dernier de ${last}` : ''}. Elles gardent leur ordre
          et leur progression. L’original part à la corbeille, récupérable.</div>
        <button class="mi" data-mact="dosplit" style="justify-content:center;font-weight:700">
          ${svg(I.check)}Scinder en ${parts}</button>
      </div>`;
    mountMenu(w);
    /* on retouche les libellés au lieu de reconstruire le menu : redessiner
       pendant le glissé arracherait le curseur des doigts */
    const r = document.getElementById('spSize');
    const lab = r.closest('.mrow').querySelector('b');
    const note = r.closest('.menu').querySelector('.note');
    const btn = r.closest('.menu').querySelector('[data-mact="dosplit"] ');
    r.addEventListener('input', () => {
      setSplitSize(+r.value);
      const p = Math.ceil(n / splitSize), lastN = n - splitSize * (p - 1);
      lab.textContent = splitSize;
      note.innerHTML = `${n} pages → <b>${p} livres</b> de ${splitSize}${
        lastN !== splitSize ? `, le dernier de ${lastN}` : ''}. Elles gardent leur ordre
        et leur progression. L’original part à la corbeille, récupérable.`;
      btn.lastChild.textContent = 'Scinder en ' + p;
    });
    return;
}
