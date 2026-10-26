// Le Supabase en mémoire des parcours (M07) : il vit dans src/base-locale/
// (serveur.js et ses voisins), où la démo sans compte le sert aussi, dans le
// navigateur. Ici, seulement ce qui le branche sur une page Playwright.
import { repondre } from '../src/base-locale/serveur.js';

export { nouveauStore, semerLivre, semerPaquetDu } from '../src/base-locale/serveur.js';

/* Branche le faux serveur sur une page (ou un contexte). Couper le réseau
   (`store.online = false`) fait échouer chaque requête comme une vraie
   coupure : `fetch` rejette, exactement ce que voit l'app dans un tunnel. */
export async function brancher(cible, store) {
  await cible.route(/supabase\.co\//, async route => {
    const req = route.request();
    if (!store.online) return route.abort('internetdisconnected');
    let body;
    try { body = req.postDataJSON(); } catch { body = null; } // pas de corps (GET, DELETE)
    if (body == null && req.postDataBuffer()) {                  // WebKit ne rend parfois le corps qu'en octets
      try { body = JSON.parse(req.postDataBuffer().toString('utf8')); } catch { body = null; }
    }
    const [status, json, headers] = repondre(store, { method: req.method(), url: new URL(req.url()), headers: req.headers(), body });
    return route.fulfill({ status, headers: { 'content-type': 'application/json', ...(headers || {}) },
      body: json == null ? '' : JSON.stringify(json) });
  });
}
