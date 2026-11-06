/* ══════════ repeindre sans effacer ce qu'on tape (2026-11-05) ══════════
   Sans dépendance. L'app redessine ses écrans en `innerHTML` ; un écran
   seul — « Choisis ton mot de passe » (ui/mdp.js), les codes reçus par
   e-mail (ui/verif.js) — est aussi repeint par tout `render()` de fond (une
   offre relue, le cercle, la synchro), et le repeint vidait les champs
   sous les doigts : on tapait son nouveau mot de passe, il disparaissait,
   et « Enregistrer » répondait « 10 caractères au moins ». Vu dans les
   parcours (1 fois sur 12 environ), bien plus probable au téléphone sur un
   réseau lent. On garde la valeur des champs nommés, le champ actif et le
   curseur, d'un repeint à l'autre. Rend vrai si le focus a été rendu. */
/** @param {HTMLElement} racine @param {string} html @param {string[]} ids */
export function repeindreEnGardant(racine, html, ids) {
  const vals = ids.map(id => { const n = /** @type {HTMLInputElement} */ (document.getElementById(id)); return [id, n ? n.value : '']; });
  const a = /** @type {HTMLInputElement} */ (document.activeElement);
  const actif = a && ids.includes(a.id) ? a.id : '';
  let sel;
  try { sel = actif ? [a.selectionStart, a.selectionEnd] : null; } catch (e) { sel = null; }   // un champ e-mail n'a pas de curseur lisible
  racine.innerHTML = html;
  for (const [id, v] of vals) {
    const n = /** @type {HTMLInputElement} */ (document.getElementById(id));
    if (n && v && !n.value) n.value = v;
  }
  if (!actif) return false;
  const n = /** @type {HTMLInputElement} */ (document.getElementById(actif));
  if (!n) return false;
  n.focus();
  try { if (sel && sel[0] != null) n.setSelectionRange(sel[0], sel[1]); } catch (e) { /* type sans sélection : le focus suffit */ }
  return true;
}
