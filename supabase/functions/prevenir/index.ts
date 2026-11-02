/* Mirandola — prévenir l'éditeur d'une demande de démo (2026-11-02).
   Appelée par la base (déclencheur prevenir_demande, pg_net) à chaque
   « Demander une démo » ; elle relit la demande, l'envoie à l'éditeur et
   en accuse réception au demandeur, par l'API de Brevo.

   Secrets (Edge Functions → Secrets) :
     BREVO_API_KEY   la clé d'API de Brevo (xkeysib-…) ; sans elle, rien ne part
     ALERTE_EMAIL    où arrivent les demandes (l'adresse de l'éditeur)
     EXPEDITEUR      défaut noreply@mirandola.fr (une adresse du domaine
                     authentifié chez Brevo)
     SITE_URL        défaut https://mirandola.fr

   verify_jwt coupé : c'est la base qui appelle. Rien à craindre d'un appel
   à la main : on ne reçoit qu'un identifiant, la demande est relue au rôle
   service, et seule une demande de moins de deux heures, jamais prévenue,
   part — une fois (`prevenu_le` est posé avant l'envoi).

   Rien de personnel dans les journaux : l'identifiant de l'établissement,
   le statut de Brevo, jamais une adresse. */

import { accuseDemande, alerteDemande, aPrevenir, envoiBrevo } from "../_shared/courriels.js";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HS = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
const rep = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function envoyer(cle: string, corps: unknown) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": cle, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corps),
  });
  if (!r.ok) console.error("brevo", r.status, (await r.text().catch(() => "")).slice(0, 200));
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return rep(405, { error: "method" });
  const cle = Deno.env.get("BREVO_API_KEY"), alerte = Deno.env.get("ALERTE_EMAIL");
  if (!cle || !alerte) return rep(200, { rien: "nokey" });
  const de = Deno.env.get("EXPEDITEUR") || "noreply@mirandola.fr";
  const site = (Deno.env.get("SITE_URL") || "https://mirandola.fr").replace(/\/$/, "");

  let org = "";
  try { org = String((await req.json()).org || ""); } catch { /* corps illisible : rien à prévenir */ }
  if (!/^[0-9a-f-]{36}$/.test(org)) return rep(400, { error: "org" });

  const r = await fetch(`${URL_SB}/rest/v1/org_suivi?org_id=eq.${org}&select=source,contact_nom,contact_fonction,`
    + "contact_email,contact_tel,eleves_estimes,message,cree,prevenu_le,orgs(name,ville)", { headers: HS });
  const [s] = r.ok ? await r.json() : [];
  if (!aPrevenir(s)) return rep(200, { rien: "deja" });

  // marquer d'abord : deux appels en même temps n'envoient qu'une fois
  const m = await fetch(`${URL_SB}/rest/v1/org_suivi?org_id=eq.${org}&prevenu_le=is.null`, {
    method: "PATCH", headers: { ...HS, Prefer: "return=representation" },
    body: JSON.stringify({ prevenu_le: new Date().toISOString() }),
  });
  if (!m.ok || !(await m.json()).length) return rep(200, { rien: "deja" });

  const d = { ...s, etab: s.orgs?.name || "", ville: s.orgs?.ville || "" };
  const a = await envoyer(cle, envoiBrevo({ de, a: alerte, repondreA: d.contact_email, courriel: alerteDemande(d, site) }));
  const b = d.contact_email
    ? await envoyer(cle, envoiBrevo({ de, a: d.contact_email, repondreA: alerte, courriel: accuseDemande(d) }))
    : false;
  console.log("prevenir", org, a ? "alerte" : "alerte en échec", b ? "accusé" : "sans accusé");
  return rep(200, { alerte: a, accuse: b });
});
