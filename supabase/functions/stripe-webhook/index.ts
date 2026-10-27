/* Folio — ce que Stripe nous apprend d'un abonnement.
   Stripe appelle cette adresse à chaque évènement (paiement abouti,
   renouvellement, échec, résiliation) ; on vérifie qu'il vient bien de lui
   (signature), puis on relit l'abonnement chez Stripe et on écrit sa ligne
   dans la table abonnements — la ligne « stripe » du compte, dont c'est le
   seul écrivain (Apple et Google ont la leur : la fonction magasins).

   Relire plutôt que croire l'évènement : Stripe ne garantit pas l'ordre
   d'arrivée ; l'abonnement relu est toujours l'état du moment. Le
   traitement est donc idempotent par construction — un évènement rejoué
   réécrit la même ligne — et stripe_evenements évite seulement de refaire
   le travail.

   Secrets (Edge Functions → Secrets) :
     STRIPE_SECRET_KEY       pour relire l'abonnement
     STRIPE_WEBHOOK_SECRET   whsec_… : le secret du point d'arrivée, dans
                             Stripe → Développeurs → Webhooks
     STRIPE_PRIX_ANNUEL, STRIPE_PRIX_MENSUEL   pour nommer la formule
     STRIPE_API              défaut https://api.stripe.com/v1/ (essais locaux)

   verify_jwt DOIT être coupé pour cette fonction (Stripe n'a pas de compte
   Folio) : `supabase functions deploy stripe-webhook --no-verify-jwt`. La
   signature remplace le jeton.

   Rien de personnel dans les journaux : identifiants techniques seulement
   (évènement, abonnement), jamais une adresse ni un nom. */

import { EVENEMENTS, aEcrire, abonnementDe, compteDe, compteDeLEvenement, ligneAbonnement, signatureValide }
  from "../_shared/abonnement.js";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE = Deno.env.get("STRIPE_API") || "https://api.stripe.com/v1/";
const HB = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
const rep = (status: number, body: unknown = { recu: true }) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function base(chemin: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, { ...init, headers: { ...HB, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`base ${r.status} ${await r.text().catch(() => "")}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

async function abonnementStripe(id: string, cle: string) {
  const r = await fetch(`${STRIPE}subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: "Bearer " + cle },
  });
  if (!r.ok) throw new Error(`stripe ${r.status}`);
  return r.json();
}

/* Le compte Folio de l'abonnement : ses métadonnées, sinon l'évènement
   (client_reference_id de la page de paiement), sinon une ligne déjà
   connue pour cet abonnement ou ce client. */
async function compte(sub: any, ev: any): Promise<string | null> {
  const direct = compteDe(sub) || compteDeLEvenement(ev);
  if (direct) return direct;
  const client = typeof sub.customer === "object" ? sub.customer?.id : sub.customer;
  const rows = await base(`abonnements?select=user_id&or=(abonnement_stripe.eq.${sub.id},client_stripe.eq.${client})&limit=1`);
  return rows?.[0]?.user_id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return rep(405, { error: "method" });
  const cle = Deno.env.get("STRIPE_SECRET_KEY"), secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!cle || !secret) return rep(503, { error: "nokey" });

  const corps = await req.text();
  if (!(await signatureValide(corps, req.headers.get("stripe-signature"), secret))) return rep(400, { error: "signature" });

  let ev: any;
  try {
    ev = JSON.parse(corps);
  } catch {
    return rep(400, { error: "body" });
  }
  if (!EVENEMENTS.includes(ev.type)) return rep(200, { ignore: ev.type });

  try {
    const deja = await base(`stripe_evenements?select=id&id=eq.${encodeURIComponent(ev.id)}`);
    if (deja?.length) return rep(200, { deja: true });

    const subId = abonnementDe(ev);
    if (subId) {
      const sub = await abonnementStripe(subId, cle);
      const uid = await compte(sub, ev);
      if (!uid) {
        console.error("webhook sans compte", ev.id, sub.id);
      } else {
        const prix = { annuel: Deno.env.get("STRIPE_PRIX_ANNUEL"), mensuel: Deno.env.get("STRIPE_PRIX_MENSUEL") };
        const nouvelle = ligneAbonnement(sub, uid, prix);
        const [actuelle] = (await base(`abonnements?select=*&user_id=eq.${uid}&source=eq.stripe`)) ?? [];
        if (aEcrire(actuelle, nouvelle)) {
          try {
            await base("abonnements?on_conflict=user_id,source", {
              method: "POST",
              headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
              body: JSON.stringify(nouvelle),
            });
          } catch (e) {
            /* 23503 : le compte n'existe plus (supprimé, son abonnement
               résilié arrivant à sa fin). Rien à écrire, et surtout pas
               d'erreur : Stripe rejouerait l'évènement pendant trois jours. */
            if (!(e instanceof Error && e.message.includes("23503"))) throw e;
            console.error("webhook : compte disparu", ev.id, sub.id);
          }
        }
      }
    }
    await base("stripe_evenements", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ id: ev.id, type: ev.type }),
    });
    return rep(200);
  } catch (e) {
    /* Une erreur rend 500 : Stripe rejouera l'évènement (pendant trois
       jours), et le traitement, idempotent, reprendra où il en était. */
    console.error("webhook", ev.id, e instanceof Error ? e.message : e);
    return rep(500, { error: "traitement" });
  }
});
