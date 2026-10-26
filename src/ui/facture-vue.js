// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { esc } from '../core/coeur-sync.js';
import { dateFr, enteteClient, enteteVendeur, euros, mentionsLegales } from '../facture.js';
import './facture.css';

/* ══════════ une facture ou un avoir, prêt à imprimer (2026-10-26) ══════════
   La même feuille dans la console du référent et dans celle de l'éditeur :
   ce que la base a figé à l'émission (vendeur, client, lignes, totaux) et
   les mentions que la loi demande (src/facture.js). « Imprimer ou PDF »
   n'imprime qu'elle (facture.css, préfixe fa-). */

const quantite = q => (+q).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const lignes = (l, gras) => l.map((x, i) => (i === 0 && gras ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`)).join('');

function periode(f) {
  if (f.periode_debut && f.periode_fin) return `Période : du ${dateFr(f.periode_debut)} au ${dateFr(f.periode_fin)}`;
  if (f.periode_fin) return `Période : jusqu’au ${dateFr(f.periode_fin)}`;
  return '';
}

function tete(f, avoir) {
  return `<header class="fa-tete">
      <div class="fa-de">${lignes(enteteVendeur(f.vendeur || {}), true)}</div>
      <div class="fa-num"><h1>${avoir ? 'Avoir' : 'Facture'}</h1><b>N° ${esc(f.numero)}</b>
        <span>Émis${avoir ? '' : 'e'} le ${dateFr(f.emise_le)}</span>
        ${avoir ? `<span>Sur la facture ${esc(f.origine_numero || '')}</span>` : `<span>À régler avant le ${dateFr(f.echeance)}</span>`}
      </div>
    </header>`;
}

function totauxHtml(f, avoir) {
  const taux = +f.taux_tva || 0;
  return `<div class="fa-totaux">
      <span>Total HT</span><b>${euros(f.total_ht)}</b>
      ${taux ? `<span>TVA ${quantite(taux)} %</span><b>${euros(f.tva)}</b>` : ''}
      <span class="fa-net">${avoir ? 'Total de l’avoir TTC' : 'Net à payer TTC'}</span><b class="fa-net">${euros(f.total_ttc)}</b>
    </div>`;
}

export function factureHtml(f) {
  const avoir = f.genre === 'avoir', p = periode(f), objet = [esc(f.objet || ''), p].filter(Boolean).join('<br>');
  return `<article class="fa-feuille" aria-label="${avoir ? 'Avoir' : 'Facture'} ${esc(f.numero)}">
      ${tete(f, avoir)}
      <section class="fa-pour"><i>Facturé à</i>${lignes(enteteClient(f.client || {}), true)}</section>
      ${objet ? `<p class="fa-objet">${objet}</p>` : ''}
      <table class="fa-lignes">
        <thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead>
        <tbody>${(f.lignes || []).map(l => `<tr><td>${esc(l.libelle)}</td><td>${quantite(l.quantite)}</td>
          <td>${euros(l.prix_ht)}</td><td>${euros(l.total_ht)}</td></tr>`).join('')}</tbody>
      </table>
      ${totauxHtml(f, avoir)}
      <ul class="fa-mentions">${mentionsLegales(f).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
    </article>`;
}
