/* Folio — passer à Folio+, gérer son abonnement.
   L'app appelle cette fonction ; elle demande à Stripe une page de paiement
   (Checkout) ou une page de gestion (le portail client), et rend son
   adresse : l'app y envoie le navigateur. La carte bancaire ne passe jamais
   par Folio. Ce qui suit le paiement (l'abonnement écrit en base) est le
   travail de stripe-webhook.

   Secrets à définir sur le projet Supabase (Edge Functions → Secrets) :
     STRIPE_SECRET_KEY     obligatoire (sk_test_… pour essayer, sk_live_… en vrai)
     STRIPE_PRIX_ANNUEL    l'identifiant du prix annuel (price_…)
     STRIPE_PRIX_MENSUEL   l'identifiant du prix mensuel (price_…)
     STRIPE_TAXE           « 1 » si Stripe Tax est activé (TVA du pays de l'acheteur)
     STRIPE_CGV            « 1 » pour faire cocher les conditions de vente (leur
                           adresse posée dans Stripe → Paramètres → Détails publics)
     SITE_URL              défaut https://www.folioflashcard.online
     STRIPE_API            défaut https://api.stripe.com/v1/ (les essais locaux
                           pointent ailleurs : tools/paiement/essai.js)
   SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont
   fournis par Supabase.

   verify_jwt est actif : seul un compte connecté peut appeler la fonction.
   Pas de SDK (ni Stripe ni supabase-js) : du fetch brut, comme le reste de
   l'app — rien à télécharger au démarrage, rien qui casse au déploiement.

   Réponses : { url } ; sinon { error } parmi nokey, noprix, auth, body,
   formule, deja (Folio+ court déjà : gérer plutôt que payer), campus
   (l'établissement l'offre déjà), aucun (rien à gérer), stripe. */

import { FORMULES, demandePaiement, demandePortail, formulaire, ouvre } from "../_shared/abonnement.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE = (Deno.env.get("SITE_URL") || "https://www.folioflashcard.online").replace(/\/$/, "");
const STRIPE = Deno.env.get("STRIPE_API") || "https://api.stripe.com/v1/";

/* le gateway a déjà validé le JWT ; on n'en lit que le sujet et l'adresse */
function claims(req: Request): { sub: string | null; email: string | null } {
  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const part = raw.split(".")[1];
  if (!part) return { sub: null, email: null };
  try {
    const pad = part.replace(/-/g, "+").replace(/_/g, "/");
    const c = JSON.parse(atob(pad + "=".repeat((4 - pad.length % 4) % 4)));
    return { sub: typeof c.sub === "string" ? c.sub : null, email: typeof c.email === "string" ? c.email : null };
  } catch {
    return { sub: null, email: null };
  }
}

async function stripe(chemin: string, donnees: Record<string, string>, cle: string, idem?: string) {
  const h: Record<string, string> = {
    Authorization: "Bearer " + cle,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idem) h["Idempotency-Key"] = idem;
  const r = await fetch(STRIPE + chemin, { method: "POST", headers: h, body: formulaire(donnees) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // le message de Stripe dit la cause (prix inconnu, clé de test sur un prix réel…) ; jamais la carte
    console.error("stripe", chemin, r.status, j?.error?.code ?? "", j?.error?.message ?? "");
    throw new Error("stripe");
  }
  return j;
}

/* La ligne d'abonnement du compte (le client Stripe y est rangé), lue avec
   le rôle service : mon_offre() ne le rend pas, l'app n'a pas à le connaître. */
async function ligneDe(uid: string) {
  const r = await fetch(`${URL_SB}/rest/v1/abonnements?user_id=eq.${uid}&source=eq.stripe&select=*`, {
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE },
  });
  if (!r.ok) throw new Error("base " + r.status);
  const rows = await r.json();
  return rows[0] ?? null;
}

/* Ce que la base dit du compte, avec ses propres droits : un établissement
   sous licence donne déjà tout. */
async function offreDe(req: Request) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/mon_offre`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: req.headers.get("authorization") ?? "", "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) throw new Error("base " + r.status);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const cle = Deno.env.get("STRIPE_SECRET_KEY");
  if (!cle) return json({ error: "nokey" }, 503);

  const { sub: uid, email } = claims(req);
  if (!uid) return json({ error: "auth" }, 401);

  let body: { action?: string; formule?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "body" }, 400);
  }

  try {
    const ligne = await ligneDe(uid);

    if (body.action === "gerer") {
      if (!ligne?.client_stripe) return json({ error: "aucun" }, 404);
      const s = await stripe("billing_portal/sessions", demandePortail({ client: ligne.client_stripe, site: SITE }), cle);
      return json({ url: s.url });
    }

    if (body.action !== "payer") return json({ error: "body" }, 400);
    const formule = String(body.formule ?? "");
    if (!FORMULES.includes(formule)) return json({ error: "formule" }, 400);
    const prix = Deno.env.get(formule === "annuel" ? "STRIPE_PRIX_ANNUEL" : "STRIPE_PRIX_MENSUEL");
    if (!prix) return json({ error: "noprix" }, 503);

    /* Payer deux fois la même chose : jamais. Folio+ court déjà — payé
       ici, dans un magasin, ou offert → rien à acheter ; l'établissement
       l'offre → rien non plus. */
    if (ligne && ouvre(ligne.statut, ligne.fin_periode)) return json({ error: "deja" }, 409);
    const offre = await offreDe(req);
    if (offre?.offre === "campus") return json({ error: "campus" }, 409);
    if (offre?.offre === "plus") return json({ error: "deja" }, 409);

    /* Deux appuis dans la même minute rendent la même page (clé
       d'idempotence) : jamais deux abonnements pour un double clic. */
    const minute = Math.floor(Date.now() / 60000);
    const s = await stripe("checkout/sessions", demandePaiement({
      formule, prix, userId: uid, email, client: ligne?.client_stripe ?? null, site: SITE,
      taxe: Deno.env.get("STRIPE_TAXE") === "1", cgv: Deno.env.get("STRIPE_CGV") === "1",
    }), cle, `folio-${uid}-${formule}-${minute}`);
    return json({ url: s.url });
  } catch (e) {
    console.error("paiement", e instanceof Error ? e.message : e);
    return json({ error: "stripe" }, 502);
  }
});
