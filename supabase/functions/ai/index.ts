/* Cartes — passerelle IA.
   La clé Anthropic vit ici, côté serveur, et nulle part ailleurs :
   l'app est publiée sur GitHub Pages, donc tout ce qui est dans app.js est public.

   Secrets à définir sur le projet Supabase (Edge Functions → Secrets) :
     ANTHROPIC_API_KEY   obligatoire
     AI_BUDGET_USD       plafond de dépense sur le mois en cours (défaut 20)
     AI_DAILY_CALLS      appels max par compte et par jour (défaut 30)
     AI_DAILY_FILES      photos et PDF max par compte et par jour (défaut 10)

   verify_jwt est actif : seul un compte connecté peut appeler la fonction. */

/* Appel HTTP direct plutôt que le SDK npm : dans le runtime Edge de Deno,
   le SDK échoue au démarrage (« Could not find package 'zod' » — un de ses
   sous-modules internes ne se résout pas ici) et la fonction ne répond
   jamais. curl/HTTP brut n'a pas ce problème. */
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
/* tarif Sonnet 5, en cents par token */
const CENTS_IN = 200 / 1e6;
const CENTS_OUT = 1000 / 1e6;

const BUDGET_CENTS = Math.round(Number(Deno.env.get("AI_BUDGET_USD") ?? 20) * 100);
const DAILY_CALLS = Number(Deno.env.get("AI_DAILY_CALLS") ?? 30);
/* Une photo ou un PDF coûte bien plus cher qu'un texte collé : quota
   séparé, plus serré, en plus du quota général. */
const DAILY_FILES = Number(Deno.env.get("AI_DAILY_FILES") ?? 10);
const MAX_CHARS = 24000;
const MAX_CARDS = 120;
/* en octets une fois décodé — l'API accepte 5 Mo par image, 32 Mo par PDF,
   mais on reste bien en dessous : au-delà, c'est la facture qui parle */
const MAX_IMG = 4 * 1024 * 1024;
const MAX_PDF = 12 * 1024 * 1024;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

/* Photo d'une page de cours, ou PDF : mêmes règles, plus ce qu'il faut
   savoir quand le texte est lu depuis une image plutôt que tapé. */
const SYSTEM_FILE = SYSTEM + `

Le texte t'arrive en image. Lis-le d'abord entièrement, puis fabrique les cartes.
- Respecte l'orthographe et les accents tels qu'ils sont écrits, sans corriger.
- Si un mot est illisible, saute la carte plutôt que de deviner.
- Ignore ce qui n'est pas le cours : marges, numéros de page, en-têtes,
  annotations manuscrites en marge, surlignages.
- Un tableau à deux colonnes est une liste de cartes : colonne de gauche au
  recto, colonne de droite au verso, ligne par ligne.`;

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

  let body: { op?: string; text?: string; hint?: string; data?: string; mime?: string; pages?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "body" }, 400);
  }
  const op = String(body.op ?? "");
  if (op !== "cards" && op !== "ocr" && op !== "pdf") return json({ error: "op" }, 400);
  const isFile = op !== "cards";

  let text = "";
  let b64 = "", mime = "";
  if (isFile) {
    b64 = String(body.data ?? "");
    mime = String(body.mime ?? "");
    if (!b64) return json({ error: "body" }, 400);
    /* le base64 pèse 4/3 de l'original : on remonte à la taille réelle */
    const bytes = Math.floor(b64.length * 3 / 4);
    if (op === "ocr") {
      if (!IMG_TYPES.includes(mime)) return json({ error: "mime" }, 415);
      if (bytes > MAX_IMG) return json({ error: "big", max: MAX_IMG }, 413);
    } else {
      if (mime !== "application/pdf") return json({ error: "mime" }, 415);
      if (bytes > MAX_PDF) return json({ error: "big", max: MAX_PDF }, 413);
    }
  } else {
    text = String(body.text ?? "").trim();
    if (text.length < 40) return json({ error: "short" }, 400);
    if (text.length > MAX_CHARS) return json({ error: "long", max: MAX_CHARS }, 413);
  }

  /* garde-fous de dépense : plafond du mois, puis quota du jour */
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [{ data: month }, { count: mine }, { count: myFiles }] = await Promise.all([
    admin.from("ai_usage").select("cents").gte("day", firstOfMonth),
    admin.from("ai_usage").select("id", { count: "exact", head: true })
      .eq("user_id", uid).eq("day", today),
    isFile
      ? admin.from("ai_usage").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("day", today).in("op", ["ocr", "pdf"])
      : Promise.resolve({ count: 0 }),
  ]);
  const spent = (month ?? []).reduce((a, r) => a + Number(r.cents), 0);
  if (spent >= BUDGET_CENTS) return json({ error: "budget" }, 402);
  if ((mine ?? 0) >= DAILY_CALLS) return json({ error: "quota" }, 429);
  if (isFile && (myFiles ?? 0) >= DAILY_FILES) return json({ error: "fquota" }, 429);

  const hint = String(body.hint ?? "").slice(0, 200).trim();
  const pages = String(body.pages ?? "").slice(0, 60).trim();

  /* Ce que voit le modèle : du texte, une image, ou un PDF entier auquel
     on adjoint la consigne de pages. Choisir les pages côté navigateur
     demanderait une bibliothèque de lecture PDF ; les nommer au modèle
     donne le même résultat sans rien ajouter à l'app. */
  const content: unknown[] = isFile
    ? [
      op === "ocr"
        ? { type: "image", source: { type: "base64", media_type: mime, data: b64 } }
        : { type: "document", source: { type: "base64", media_type: mime, data: b64 } },
      {
        type: "text",
        text: (hint ? `Consigne : ${hint}\n` : "")
          + (pages ? `N'utilise que ces pages : ${pages}. Ignore toutes les autres.\n` : "")
          + "Fabrique les cartes à partir de ce document.",
      },
    ]
    : [{ type: "text", text: (hint ? `Consigne : ${hint}\n\n` : "") + "Texte :\n\n" + text }];

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: isFile ? SYSTEM_FILE : SYSTEM,
        thinking: { type: "adaptive" },
        output_config: {
          effort: isFile ? "medium" : "low",   // lire une page demande plus d'attention
          format: { type: "json_schema", schema: SCHEMA },
        },
        messages: [{ role: "user", content }],
      }),
    });
  } catch (e) {
    console.error("fetch anthropic", e instanceof Error ? e.message : e);
    return json({ error: "upstream" }, 502);
  }
  if (!res.ok) {
    console.error("anthropic status", res.status, await res.text().catch(() => ""));
    return json({ error: "upstream" }, 502);
  }
  const data = await res.json();

  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  const cents = inTok * CENTS_IN + outTok * CENTS_OUT;
  admin.from("ai_usage").insert({
    user_id: uid, day: today, op,
    in_tok: inTok, out_tok: outTok, cents: cents.toFixed(4),
  }).then(() => {}, () => {});

  let cards: { f: string; b: string }[] = [];
  const parsed = (data as { parsed_output?: { cards?: unknown } }).parsed_output;
  const raw = parsed ?? (() => {
    const content = (data.content ?? []) as { type: string; text?: string }[];
    const t = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
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
    filesLeft: isFile ? Math.max(0, DAILY_FILES - (myFiles ?? 0) - 1) : undefined,
  });
});
