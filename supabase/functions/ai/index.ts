/* Cartes — passerelle IA.
   La clé Anthropic vit ici, côté serveur, et nulle part ailleurs :
   l'app est publiée sur GitHub Pages, donc tout ce qui est dans app.js est public.

   Secrets à définir sur le projet Supabase (Edge Functions → Secrets) :
     ANTHROPIC_API_KEY   obligatoire
     AI_BUDGET_USD       plafond de dépense sur le mois en cours (défaut 20)
     AI_DAILY_CALLS      appels max par compte et par jour (défaut 30)

   verify_jwt est actif : seul un compte connecté peut appeler la fonction. */

import Anthropic from "npm:@anthropic-ai/sdk@0.72.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
/* tarif Sonnet 5, en cents par token */
const CENTS_IN = 200 / 1e6;
const CENTS_OUT = 1000 / 1e6;

const BUDGET_CENTS = Math.round(Number(Deno.env.get("AI_BUDGET_USD") ?? 20) * 100);
const DAILY_CALLS = Number(Deno.env.get("AI_DAILY_CALLS") ?? 30);
const MAX_CHARS = 24000;
const MAX_CARDS = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/* le gateway a déjà validé le JWT ; on ne lit que le sujet */
function uidOf(req: Request): string | null {
  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const part = raw.split(".")[1];
  if (!part) return null;
  try {
    const pad = part.replace(/-/g, "+").replace(/_/g, "/");
    const sub = JSON.parse(atob(pad + "=".repeat((4 - pad.length % 4) % 4))).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

const SYSTEM = `Tu transformes un texte de cours en cartes de révision.

Sortie : une liste de cartes { f, b }.
  f = le recto, ce que l'élève voit et doit retrouver
  b = le verso, la réponse attendue

Règles :
- Une seule information par carte. Recto et verso courts, sans phrase d'introduction.
- Si le texte est bilingue (listes de vocabulaire, conjugaisons, traductions),
  le recto prend la langue source et le verso la langue cible, en respectant
  strictement l'orthographe et les accents du texte.
- Si le texte est un cours suivi, fabrique des questions de restitution :
  définitions, dates, formules, causes, conséquences, exemples.
- N'invente jamais un contenu absent du texte. Si le texte ne dit pas, n'écris pas.
- Reprends la formulation du texte plutôt que de la reformuler.
- Pas de numérotation, pas de puces, pas de guillemets décoratifs.
- Ignore les en-têtes, numéros de page, tables des matières et notes de bas de page.
- Rends au plus ${MAX_CARDS} cartes, dans l'ordre du texte.`;

const SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: { f: { type: "string" }, b: { type: "string" } },
        required: ["f", "b"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "nokey" }, 503);

  const uid = uidOf(req);
  if (!uid) return json({ error: "auth" }, 401);

  let body: { op?: string; text?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "body" }, 400);
  }
  if (body.op !== "cards") return json({ error: "op" }, 400);

  const text = String(body.text ?? "").trim();
  if (text.length < 40) return json({ error: "short" }, 400);
  if (text.length > MAX_CHARS) return json({ error: "long", max: MAX_CHARS }, 413);

  /* garde-fous de dépense : plafond du mois, puis quota du jour */
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [{ data: month }, { count: mine }] = await Promise.all([
    admin.from("ai_usage").select("cents").gte("day", firstOfMonth),
    admin.from("ai_usage").select("id", { count: "exact", head: true })
      .eq("user_id", uid).eq("day", today),
  ]);
  const spent = (month ?? []).reduce((a, r) => a + Number(r.cents), 0);
  if (spent >= BUDGET_CENTS) return json({ error: "budget" }, 402);
  if ((mine ?? 0) >= DAILY_CALLS) return json({ error: "quota" }, 429);

  const hint = String(body.hint ?? "").slice(0, 200).trim();
  const client = new Anthropic({ apiKey: key });

  let res;
  try {
    res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: (hint ? `Consigne : ${hint}\n\n` : "") + "Texte :\n\n" + text,
      }],
    });
  } catch (e) {
    console.error("anthropic", e instanceof Error ? e.message : e);
    return json({ error: "upstream" }, 502);
  }

  const inTok = res.usage.input_tokens ?? 0;
  const outTok = res.usage.output_tokens ?? 0;
  const cents = inTok * CENTS_IN + outTok * CENTS_OUT;
  admin.from("ai_usage").insert({
    user_id: uid, day: today, op: "cards",
    in_tok: inTok, out_tok: outTok, cents: cents.toFixed(4),
  }).then(() => {}, () => {});

  let cards: { f: string; b: string }[] = [];
  const parsed = (res as { parsed_output?: { cards?: unknown } }).parsed_output;
  const raw = parsed ?? (() => {
    const t = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try { return JSON.parse(t); } catch { return null; }
  })();
  if (raw && Array.isArray((raw as { cards?: unknown }).cards)) {
    cards = ((raw as { cards: { f?: unknown; b?: unknown }[] }).cards)
      .map((c) => ({ f: String(c.f ?? "").trim(), b: String(c.b ?? "").trim() }))
      .filter((c) => c.f && c.b)
      .slice(0, MAX_CARDS);
  }
  if (!cards.length) return json({ error: "empty" }, 422);

  return json({
    cards,
    usage: { in: inTok, out: outTok, cents: +cents.toFixed(4) },
    left: Math.max(0, DAILY_CALLS - (mine ?? 0) - 1),
  });
});
