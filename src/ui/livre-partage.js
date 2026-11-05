// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { mates, menu, setMenu, view } from '../data/etat.js';
import { deck, esc, metaOf } from '../core/coeur-sync.js';
import { revokeShare, shareLink } from '../core/reglages-corbeille.js';
import { codeLivre, lienLivre } from '../livre-code.js';
import { qrSvg } from '../qr.js';
import { toast } from './import-cartes.js';
import { mountMenu, paintMenu } from './menus-a.js';

/* ══════════ « Partager » un livre (2026-11-05) ══════════
   Un livre se prête par son CODE (src/livre-code.js) plutôt que par un
   lien : un lien ouvert sur un téléphone sans l'app tombait sur la porte
   d'installation et s'y perdait ; un code se recopie partout et s'entre
   dans « J'ai un code » (ui/code-entree.js). Le lien reste — dans le
   message envoyé et le QR — et mène au même code. Chargée à la demande par
   ui/partage-porte.js. */

/* Fermer la feuille de partage sans choisir rejette la promesse (AbortError) :
   c'est un « non merci », pas une erreur à remonter. */
const partager = o => navigator.share(o).catch(() => {});

export function peindre(w) {
  const d = deck(view.id); if (!d) { setMenu(null); return; }
  const m = metaOf(d);
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mi" style="font-weight:750">${svg(I.share)}Partager « ${esc(d.name)} »</div>
      <button class="mi" data-mact="sendfriend">${svg(I.mail)}Prêter à un lecteur<span class="tail">${mates ? mates.length : ''}</span></button>
      ${m.tok ? `<div class="cf-invit lc"><div class="cf-qr" id="lcqr">${qrSvg(lienLivre(SITE, m.tok), d.name)}</div>
          <div class="cf-code"><b id="lccode">${codeLivre(m.tok)}</b><i>Dans l’app : J’ai un code</i></div></div>
        <button class="mi" data-mact="lccopy">${svg(I.copy)}Copier le code</button>
        <button class="mi" data-mact="lcshare">${svg(I.share)}Envoyer le code</button>
        <button class="mi warn" data-mact="roff">${svg(I.eyeoff)}Révoquer le code</button>`
      : `<button class="mi" data-mact="rolink">${svg(I.key)}Créer un code de partage</button>`}
      <div class="msep"></div>
      <button class="mi" data-mact="duelnew2">${svg(I.bolt)}Lancer un défi sur ce livre<span class="tail">en direct ou à son rythme</span></button>
    </div>`;
  mountMenu(w);
}

const repeindre = () => { if (menu === 'sharepick') paintMenu(); };

function message(d) {
  const tok = metaOf(d).tok, code = codeLivre(tok);
  return { code, url: lienLivre(SITE, tok), texte: `« ${d.name} » sur Mirandola\nCode : ${code}\nDans l’app : J’ai un code` };
}

/* Le code se crée à la demande (il faut le réseau : la base le range),
   puis se montre dans la même feuille. Révoquer le coupe pour de bon : un
   code recopié ailleurs ne mène plus à rien, le suivant sera un autre. */
const ACTIONS = {
  async rolink(d) {
    try { await shareLink(d); } catch (e) { return toast(I.x, 'Code impossible hors ligne'); }
    repeindre();
  },
  async roff(d) {
    await revokeShare(d);
    repeindre();
    toast(I.check, 'Code révoqué');
  },
  lccopy(d) {
    const { code } = message(d);
    navigator.clipboard.writeText(code).then(() => toast(I.check, 'Code copié'), () => toast(I.copy, code));
  },
  lcshare(d) {
    const { code, url, texte } = message(d);
    if (navigator.share) return partager({ title: d.name, text: texte, url });
    navigator.clipboard.writeText(texte + '\n' + url).then(() => toast(I.check, 'Code et lien copiés'), () => toast(I.copy, code));
  }
};

export function agir(a, d) {
  if (!d || !ACTIONS[a] || (a !== 'rolink' && !metaOf(d).tok)) return;
  return ACTIONS[a](d);
}
