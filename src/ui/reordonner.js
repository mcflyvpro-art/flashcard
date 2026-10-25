// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { sel } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { pushUndo, saveDeck } from '../core/coeur-sync.js';

/* ---------- réordonner par glisser-déposer ----------
   Seule la poignée prend le doigt (touch-action:none) : partout ailleurs
   la page défile normalement. Pendant le glissé rien n'est reconstruit —
   les lignes se décalent par transform, une écriture par image — et
   l'ordre n'est enregistré qu'au lâcher. */
export function bindReorder(d) {
  const wrap = $.querySelector('.rows'); if (!wrap || sel) return;
  let g = null;
  const draw = () => {
    g.raf = 0;
    const { row, rows, from, step } = g;
    row.style.transform = `translate3d(0,${g.dy}px,0)`;
    g.to = Math.max(0, Math.min(rows.length - 1, from + Math.round(g.dy / step)));
    rows.forEach((r, i) => {
      if (r === row) return;
      const shift = g.to > from && i > from && i <= g.to ? -step
                  : g.to < from && i >= g.to && i < from ? step : 0;
      r.style.transform = shift ? `translate3d(0,${shift}px,0)` : '';
    });
  };
  wrap.addEventListener('pointerdown', e => {
    const h = e.target.closest('.grip'); if (!h || g) return;
    const rows = [...wrap.querySelectorAll('.row')];
    const row = h.closest('.row'), from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) return;
    g = { row, rows, from, to: from, dy: 0, raf: 0, y0: e.clientY,
          step: rows[1].offsetTop - rows[0].offsetTop, pid: e.pointerId };
    /* le doigt garde la poignée même s'il sort de la liste ; si la capture
       est refusée (doigt déjà relâché), le glissé marche quand même, les
       mouvements étant écoutés sur la liste elle-même */
    try { h.setPointerCapture(e.pointerId); } catch (x) { /* voir le commentaire au-dessus */ }
    row.classList.add('drag'); wrap.classList.add('dragging');
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.pid) return;
    g.dy = e.clientY - g.y0;
    if (!g.raf) g.raf = requestAnimationFrame(draw);
  });
  const drop = e => {
    if (!g || (e && e.pointerId !== g.pid)) return;
    cancelAnimationFrame(g.raf);
    const { from, to, rows, row } = g;
    rows.forEach(r => r.style.transform = '');
    row.classList.remove('drag'); wrap.classList.remove('dragging');
    g = null;
    if (from === to) return;
    pushUndo('Ordre des cartes', [d.id]);
    d.cards.splice(to, 0, d.cards.splice(from, 1)[0]);
    saveDeck(d); render();
  };
  wrap.addEventListener('pointerup', drop);
  wrap.addEventListener('pointercancel', drop);
}
