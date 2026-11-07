/* Mirandola — passer à Mirandola+, gérer son abonnement.
   L'app appelle cette fonction ; elle demande à Stripe une page de paiement
   (Checkout) ou une page de gestion (le portail client), et rend son
   adresse : l'app y envoie le navigateur. La carte bancaire ne passe jamais
   par Mirandola. Ce qui suit le paiement (l'abonnement écrit en base) est le
   travail de stripe-webhook.

   Secrets à définir sur le projet Supabase (Edge Functions → Secrets) :
     STRIPE_SECRET_KEY     obligatoire (sk_test_… pour essayer, sk_live_… en vrai) :
                           c'est la seule ; « Brancher Stripe », dans la console
                           de l'éditeur (Entreprise), pose le reste chez Stripe
                           (action `preparer`, 2026-11-02) et le range dans
                           `stripe_reglages`
     STRIPE_PRIX_ANNUEL    facultatif : un prix annuel posé à la main (price_…),
                           qui passe avant celui de « Brancher Stripe »
     STRIPE_PRIX_MENSUEL   facultatif : de même pour le mensuel (Mirandola+ seulement :
                           les prix d'Infini sont ceux de « Brancher Stripe »)
     STRIPE_TAXE           « 1 » si Stripe Tax est activé (TVA du pays de l'acheteur)
     STRIPE_CGV            « 1 » pour faire cocher les conditions de vente (leur
                           adresse posée dans Stripe → Paramètres → Détails publics)
     SITE_URL              défaut https://mirandola.fr
     STRIPE_API            défaut https://api.stripe.com/v1/ (les essais locaux
                           pointent ailleurs : tools/paiement/essai.js)
   SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont
   fournis par Supabase.

   verify_jwt est actif : seul un compte connecté peut appeler la fonction.
   Pas de SDK (ni Stripe ni supabase-js) : du fetch brut, comme le reste de
   l'app — rien à télécharger au démarrage, rien qui casse au déploiement.

   Actions : payer (avec une formule — Mirandola+ ou Infini, à l'année ou au
   mois —, l'essai de 7 jours pour un premier abonnement, un code promo venu
   d'un lien), gerer (le portail), resilier (le
   portail ouvert sur la résiliation) ; pour l'éditeur seul, etat (ce qui est
   branché) et preparer (« Brancher Stripe »).
   Réponses : { url } ; sinon { error } parmi nokey, noprix, auth, body,
   formule, accord (l'accord de l'app manque), promo (code inconnu ou fini),
   deja (Mirandola+ court déjà : gérer plutôt que payer), campus
   (l'établissement l'offre déjà), aucun (rien à gérer), editeur (réservé à
   l'éditeur), stripe. */

import {
  FORMULES, PRIX, PRODUITS, demandeCodePromo, demandeCoupon, PROMO, demandePaiement, demandePortail, demandePortailConfig, demandePrix, demandeProduit,
  demandeWebhook, formulaire, modeDeLaCle, ouvre, prixConforme, reglagesDuMode, webhookConforme,
} from "../_shared/abonnement.js";

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
const SITE = (Deno.env.get("SITE_URL") || "https://mirandola.fr").replace(/\/$/, "");
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

async function stripe(chemin: string, donnees: Record<string, string> | null, cle: string, idem?: string,
  methode = "POST", tolere?: string) {
  const h: Record<string, string> = {
    Authorization: "Bearer " + cle,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idem) h["Idempotency-Key"] = idem;
  const r = await fetch(STRIPE + chemin, { method: methode, headers: h, body: donnees ? formulaire(donnees) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (tolere && j?.error?.code === tolere) return null;     // « existe déjà » : ce qu'on voulait
    // le message de Stripe dit la cause (prix inconnu, clé de test sur un prix réel…) ; jamais la carte
    console.error("stripe", chemin, r.status, j?.error?.code ?? "", j?.error?.message ?? "");
    throw new Error("stripe");
  }
  return j;
}
const lireStripe = (chemin: string, cle: string) => stripe(chemin, null, cle, undefined, "GET");

/* Les réglages rangés par « Brancher Stripe » (table stripe_reglages, rôle
   service seul), pour le mode de la clé. */
const HS = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
async function reglages(mode: string): Promise<Record<string, string>> {
  const r = await fetch(`${URL_SB}/rest/v1/stripe_reglages?select=cle,valeur`, { headers: HS });
  if (!r.ok) return {};                       // table absente (migration pas encore appliquée) : rien de rangé
  return reglagesDuMode(await r.json(), mode);
}
async function ranger(mode: string, valeurs: Record<string, string>) {
  const lignes = Object.entries(valeurs).map(([k, v]) => ({ cle: `${mode}:${k}`, valeur: v, maj: new Date().toISOString() }));
  const r = await fetch(`${URL_SB}/rest/v1/stripe_reglages?on_conflict=cle`, {
    method: "POST", headers: { ...HS, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(lignes),
  });
  if (!r.ok) throw new Error("base " + r.status);
}

async function estEditeur(req: Request) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: req.headers.get("authorization") ?? "", "Content-Type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

/* « Brancher Stripe » : le produit, ses deux prix (retrouvés par leur clé
   de recherche, refaits s'ils ne sont plus les bons), le point d'arrivée
   des évènements (son secret n'est donné qu'à sa création : sans secret
   rangé, on le refait), le portail client. Rien ne se crée deux fois. */
async function preparer(cle: string, mode: string) {
  const r = await reglages(mode);
  for (const n of Object.keys(PRODUITS)) {
    await stripe("products", demandeProduit(n), cle, undefined, "POST", "resource_already_exists");
  }
  const prix: Record<string, string> = {};
  for (const f of FORMULES) {
    const l = await lireStripe(`prices?active=true&lookup_keys[]=${encodeURIComponent(PRIX[f].cle)}`, cle);
    const p = l?.data?.[0];
    prix[f] = prixConforme(p, f) ? p.id : (await stripe("prices", demandePrix(f), cle)).id;
  }
  // le code de lancement : le coupon, puis son code (chacun une fois)
  await stripe("coupons", demandeCoupon(), cle, undefined, "POST", "resource_already_exists");
  const codes = (await lireStripe(`promotion_codes?code=${PROMO.code}&limit=1`, cle))?.data ?? [];
  // la forme d'aujourd'hui, puis celle d'avant pour un compte resté sur une ancienne version de Stripe
  if (!codes.length && !await stripe("promotion_codes", demandeCodePromo(), cle, undefined, "POST", "parameter_unknown")) {
    await stripe("promotion_codes", demandeCodePromo(true), cle);
  }
  const url = `${URL_SB}/functions/v1/stripe-webhook`;
  const points = (await lireStripe("webhook_endpoints?limit=100", cle))?.data ?? [];
  const nos = points.filter((w: any) => w.url === url);
  let webhook = nos.find((w: any) => w.id === r.webhook_id && r.webhook_secret && webhookConforme(w, url));
  const neuf: Record<string, string> = {};
  if (!webhook) {
    for (const w of nos) await stripe(`webhook_endpoints/${w.id}`, null, cle, undefined, "DELETE");
    webhook = await stripe("webhook_endpoints", demandeWebhook(url), cle);
    neuf.webhook_id = webhook.id;
    neuf.webhook_secret = webhook.secret;
  }
  const config = demandePortailConfig({ site: SITE, ...prix });
  const portail = r.portail
    ? (await stripe(`billing_portal/configurations/${r.portail}`, config, cle).catch(() => null))
      ?? await stripe("billing_portal/configurations", config, cle)
    : await stripe("billing_portal/configurations", config, cle);
  await ranger(mode, { ...neuf, ...Object.fromEntries(FORMULES.map(f => ["prix_" + f, prix[f]])), portail: portail.id,
    branche_le: new Date().toISOString() });
  return etat(cle, mode);
}

// ce que la console de l'éditeur montre : la clé, son mode, ce qui est branché (jamais un secret)
async function etat(cle: string | undefined, mode: string) {
  if (!cle) return { cle: false };
  const r = await reglages(mode);
  return { cle: true, mode, prix: FORMULES.every(f => !!r["prix_" + f]), webhook: !!r.webhook_secret,
    portail: !!r.portail, branche_le: r.branche_le || null,
    a_la_main: !!(Deno.env.get("STRIPE_PRIX_ANNUEL") && Deno.env.get("STRIPE_PRIX_MENSUEL")) };
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
  const { sub: uid, email } = claims(req);
  if (!uid) return json({ error: "auth" }, 401);

  let body: { action?: string; formule?: string; cgv?: string; promo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "body" }, 400);
  }

  const mode = modeDeLaCle(cle ?? "");
  if (body.action === "etat" || body.action === "preparer") {
    if (!(await estEditeur(req))) return json({ error: "editeur" }, 403);
    if (body.action === "etat") return json(await etat(cle, mode));
    if (!cle) return json({ error: "nokey" }, 503);
    try {
      return json(await preparer(cle, mode));
    } catch (e) {
      console.error("preparer", e instanceof Error ? e.message : e);
      return json({ error: "stripe" }, 502);
    }
  }
  if (!cle) return json({ error: "nokey" }, 503);

  try {
    const ligne = await ligneDe(uid);
    const rangs = await reglages(mode);

    if (body.action === "gerer" || body.action === "resilier") {
      if (!ligne?.client_stripe) return json({ error: "aucun" }, 404);
      /* « Résilier » ouvre le portail sur la résiliation de l'abonnement qui
         court ; déjà résilié (ou fini), le portail tout court : on peut y
         reprendre l'abonnement. */
      const resilier = body.action === "resilier" && ligne.abonnement_stripe && !ligne.fin_prevue
        && ouvre(ligne.statut, ligne.fin_periode) ? ligne.abonnement_stripe : undefined;
      const s = await stripe("billing_portal/sessions",
        demandePortail({ client: ligne.client_stripe, site: SITE, resilier, configuration: rangs.portail }), cle);
      return json({ url: s.url });
    }

    if (body.action !== "payer") return json({ error: "body" }, 400);
    const formule = String(body.formule ?? "");
    if (!FORMULES.includes(formule)) return json({ error: "formule" }, 400);
    /* Pas de paiement sans l'accord donné dans l'app : les conditions de
       vente et le démarrage immédiat (article L221-25), une version datée. */
    const accord = /^\d{4}-\d{2}-\d{2}$/.test(String(body.cgv ?? "")) ? String(body.cgv) : "";
    if (!accord) return json({ error: "accord" }, 400);
    const infini = formule.startsWith("infini");
    const manuel = { annuel: "STRIPE_PRIX_ANNUEL", mensuel: "STRIPE_PRIX_MENSUEL" }[formule];
    const prix = (manuel && Deno.env.get(manuel)) || rangs["prix_" + formule];

    /* Payer deux fois la même chose : jamais. Un abonnement Stripe qui court
       → passer à Infini se fait dans le portail, au prorata ; le reste,
       « deja ». Mirandola+ d'un magasin, ou l'établissement → rien à
       acheter. Mirandola+ offert : Infini s'achète par-dessus. */
    if (ligne && ouvre(ligne.statut, ligne.fin_periode)) {
      if (infini && !String(ligne.formule ?? "").startsWith("infini") && ligne.abonnement_stripe) {
        const s = await stripe("billing_portal/sessions", demandePortail({ client: ligne.client_stripe, site: SITE,
          changer: ligne.abonnement_stripe, configuration: rangs.portail }), cle);
        return json({ url: s.url });
      }
      return json({ error: "deja" }, 409);
    }
    if (!prix) return json({ error: "noprix" }, 503);
    const offre = await offreDe(req);
    if (offre?.offre === "campus") return json({ error: "campus" }, 409);
    if (offre?.offre === "plus" && !(infini && offre?.abonnement?.source === "offert")) return json({ error: "deja" }, 409);

    /* L'essai : seulement pour qui n'a jamais eu d'abonnement Stripe (la
       ligne garde le client d'un abonnement fini). Le code promo d'un lien :
       retrouvé chez Stripe ; inconnu ou fini, on le dit plutôt que de
       facturer plein tarif sans prévenir. */
    const essai = !ligne;
    let promo: string | undefined;
    if (body.promo) {
      const code = String(body.promo).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
      const l = await lireStripe(`promotion_codes?code=${code}&active=true&limit=1`, cle);
      promo = l?.data?.[0]?.id;
      if (!promo) return json({ error: "promo" }, 404);
    }

    /* Deux appuis dans la même minute rendent la même page (clé
       d'idempotence) : jamais deux abonnements pour un double clic. */
    const minute = Math.floor(Date.now() / 60000);
    const s = await stripe("checkout/sessions", demandePaiement({
      formule, prix, userId: uid, email, client: ligne?.client_stripe ?? null, site: SITE,
      taxe: Deno.env.get("STRIPE_TAXE") === "1", cgv: Deno.env.get("STRIPE_CGV") === "1", accord, essai, promo,
    }), cle, `folio-${uid}-${formule}-${promo ?? ""}-${minute}`);
    return json({ url: s.url });
  } catch (e) {
    console.error("paiement", e instanceof Error ? e.message : e);
    return json({ error: "stripe" }, 502);
  }
});
