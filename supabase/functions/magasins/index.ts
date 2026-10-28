/* Mirandola — Mirandola+ acheté dans l'app des magasins (Apple, Google), par RevenueCat.
   Deux appelants, une seule chose faite : relire chez RevenueCat l'abonné
   d'un compte (GET /v1/subscribers/<compte>) et écrire sa ligne « apple »
   ou « google » dans la table abonnements — dont c'est le seul écrivain.

   - RevenueCat (webhook) : achat, renouvellement, résiliation, échec de
     paiement, expiration, remboursement, transfert. Il envoie l'en-tête
     Authorization convenu dans son tableau de bord (RC_WEBHOOK_AUTH) ; on
     relit chaque compte que nomme l'évènement.
   - l'app, juste après un achat ou « Restaurer mes achats » : son jeton de
     session. On relit ce compte-là sans attendre l'évènement, pour que
     Mirandola+ s'ouvre à l'instant.

   verify_jwt est COUPÉ (`supabase functions deploy magasins --no-verify-jwt`) :
   RevenueCat n'a pas de jeton Supabase. Le jeton de l'app est vérifié ici,
   auprès de Supabase Auth.

   Secrets (Edge Functions → Secrets ; le pas à pas : docs/VENTE.md) :
     RC_SECRET        la clé secrète de l'API RevenueCat (sk_…), obligatoire
     RC_WEBHOOK_AUTH  la valeur de l'en-tête Authorization du webhook RevenueCat
     RC_DROIT         le droit (« entitlement ») de Mirandola+, défaut « plus »
     RC_API           défaut https://api.revenuecat.com/v1/ (les essais locaux
                      pointent ailleurs : tools/paiement/essai.js)

   Réponses : { ok, ecrit } ; sinon { error } parmi nokey, auth, body, magasin. */

import { DROIT, autorise, comptesDeLEvenementRC, ligneMagasin } from "../_shared/abonnement.js";

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
const RC = Deno.env.get("RC_API") || "https://api.revenuecat.com/v1/";

/* Le compte d'un jeton de l'app, d'après Supabase Auth lui-même : la
   passerelle ne l'a pas vérifié (verify_jwt coupé). */
async function compteDuJeton(entete: string): Promise<string | null> {
  if (!/^Bearer\s+\S+\.\S+\.\S+$/.test(entete)) return null;
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: entete } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return typeof u?.id === "string" ? u.id : null;
}

async function abonne(uid: string, cle: string) {
  const r = await fetch(RC + "subscribers/" + encodeURIComponent(uid), {
    headers: { Authorization: "Bearer " + cle, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    console.error("revenuecat", r.status);
    throw new Error("magasin");
  }
  return (await r.json())?.subscriber ?? null;
}

/* Relire un compte et écrire sa ligne. 23503 : le compte n'existe plus
   (supprimé, l'achat continue dans le magasin) — rien à écrire. */
async function synchroniser(uid: string, cle: string): Promise<boolean> {
  const ligne = ligneMagasin(await abonne(uid, cle), uid, Date.now(), Deno.env.get("RC_DROIT") || DROIT);
  if (!ligne) return false;
  const r = await fetch(`${URL_SB}/rest/v1/abonnements?on_conflict=user_id,source`, {
    method: "POST",
    headers: {
      apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(ligne),
  });
  if (r.ok) return true;
  const t = await r.text();
  if (t.includes("23503")) return false;
  throw new Error("base " + r.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const cle = Deno.env.get("RC_SECRET");
  if (!cle) return json({ error: "nokey" }, 503);

  const entete = req.headers.get("authorization") ?? "";
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return json({ error: "body" }, 400);
  }

  try {
    if (autorise(entete, Deno.env.get("RC_WEBHOOK_AUTH") ?? "")) {
      const comptes = comptesDeLEvenementRC(corps);
      let ecrit = 0;
      for (const uid of comptes) if (await synchroniser(uid, cle)) ecrit++;
      // RevenueCat réessaie tant qu'on ne répond pas 200 : un évènement sans compte Mirandola est ignoré, pas refusé
      return json({ ok: true, ecrit });
    }
    const uid = await compteDuJeton(entete);
    if (!uid) return json({ error: "auth" }, 401);
    return json({ ok: true, ecrit: await synchroniser(uid, cle) });
  } catch (e) {
    // jamais l'identifiant d'un élève au journal (règle 4)
    console.error("magasins", e instanceof Error ? e.message : "erreur");
    return json({ error: "magasin" }, 502);
  }
});
