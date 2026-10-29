/* Cartes — passerelle IA.
   La clé Anthropic vit ici, côté serveur, et nulle part ailleurs :
   tout ce qui part avec l'app est public.

   Secrets à définir sur le projet Supabase (Edge Functions → Secrets) :
     ANTHROPIC_API_KEY   obligatoire
     AI_BUDGET_USD       plafond de dépense sur le mois en cours (défaut 20)
     AI_DAILY_CALLS      appels max par compte et par jour (défaut 30)
     AI_DAILY_FILES      photos et PDF max par compte et par jour (défaut 10)
     AI_MONTHLY_PLUS     cours mis en flashcards par élève et par mois avec
                         Mirandola+ ou Campus (défaut 30 : src/offres.js, IA_PAR_MOIS)
     AI_MONTHLY_PROF     la même chose pour un professeur, qui prépare pour
                         toute une classe (défaut 400 : IA_PROF_PAR_MOIS) —
                         un garde-fou contre un compte volé, pas une limite
     AI_DAILY_PROF       appels par jour d'un professeur (défaut 80)
     AI_DAILY_FILES_PROF photos et PDF par jour d'un professeur (défaut 30)

   L'IA est dans Mirandola+ (2026-10-27) : un compte Mirandola gratuit reçoit
   « plus » (402), ce qui ouvre l'écran Mirandola+ dans l'app. L'offre vient de
   la base (offre_de, rôle service) ; une base qui n'a pas encore la
   fonction laisse passer, aux seuls quotas du jour.

   Un compte Campus a le quota mensuel que l'éditeur a fixé pour sa licence
   (2026-10-29, ia_quota : par professeur et par élève, dans un établissement
   ou chez un professeur particulier) ; les secrets ci-dessus ne valent plus
   que pour Mirandola+. Un quota de 0 dit « mquota » avec `quota: 0`.

   Le Prompt (2026-10-29, op « prompt ») : l'atelier de l'écran de création.
   L'élève (ou son professeur) écrit un message — un cours collé, une
   consigne, ou les deux —, la fonction reçoit aussi les pages en cours et
   les messages d'avant, et rend la liste COMPLÈTE des pages après ce message,
   avec une phrase qui dit ce qu'elle a fait. « Ajoute… », « inverse le recto
   et le verso », « enlève les dates » : chaque message est une génération,
   comptée comme les autres. Toute réponse rend aussi le compte du mois
   (`mois` : fait, quota), que l'écran pose sur ses onglets.

   Toujours disponible, autant que possible (2026-10-29) : si le modèle
   principal est surchargé, la fonction réessaie sur deux autres (MODELES) ;
   un crédit Anthropic épuisé répond « credit », une surcharge partout
   « surcharge » — l'app les dit en clair, et rien n'est compté.

   verify_jwt est actif : seul un compte connecté peut appeler la fonction. */

/* Appel HTTP direct plutôt que le SDK npm : dans le runtime Edge de Deno,
   le SDK échoue au démarrage (« Could not find package 'zod' » — un de ses
   sous-modules internes ne se résout pas ici) et la fonction ne répond
   jamais. curl/HTTP brut n'a pas ce problème. */
import { createClient } from "npm:@supabase/supabase-js@2";

/* Les modèles, dans l'ordre (2026-10-29 : « l'IA doit être dispo partout ») :
   le principal, puis deux secours quand il est surchargé, limité, en panne
   ou introuvable — 429, 529, 5xx, 404, une coupure réseau. Une erreur qui
   ne tient pas au modèle (crédit épuisé, clé refusée, requête refusée)
   s'arrête au premier : un autre modèle du même compte n'y changerait rien.
   Tarifs en cents par token, pour ai_usage et le budget du mois. */
const MODELES = [
  { id: "claude-sonnet-5", entree: 200 / 1e6, sortie: 1000 / 1e6 },
  { id: "claude-sonnet-5-5", entree: 200 / 1e6, sortie: 1000 / 1e6 },
  { id: "claude-haiku-5-5", entree: 10 / 1e6, sortie: 50 / 1e6 },
];
const REESSAYER = new Set([404, 408, 409, 429, 500, 502, 503, 504, 529]);
/* Une fonction vit 150 s : passé ce temps, on ne lance plus de secours. */
const BUDGET_MS = 75_000;

const BUDGET_CENTS = Math.round(Number(Deno.env.get("AI_BUDGET_USD") ?? 20) * 100);
const DAILY_CALLS = Number(Deno.env.get("AI_DAILY_CALLS") ?? 30);
/* Une photo ou un PDF coûte bien plus cher qu'un texte collé : quota
   séparé, plus serré, en plus du quota général. */
const DAILY_FILES = Number(Deno.env.get("AI_DAILY_FILES") ?? 10);
const MONTHLY_PLUS = Number(Deno.env.get("AI_MONTHLY_PLUS") ?? 30);
/* Un professeur (rôle prof, référent ou éditeur, table user_roles) met en
   flashcards les cours de toutes ses classes : ses quotas sont d'un autre
   ordre (2026-10-28). */
const MONTHLY_PROF = Number(Deno.env.get("AI_MONTHLY_PROF") ?? 400);
const DAILY_PROF = Number(Deno.env.get("AI_DAILY_PROF") ?? 80);
const DAILY_FILES_PROF = Number(Deno.env.get("AI_DAILY_FILES_PROF") ?? 30);
const MAX_CHARS = 24000;
const MAX_CARDS = 120;
/* en octets une fois décodé — l'API accepte 5 Mo par image, 32 Mo par PDF,
   mais on reste bien en dessous : au-delà, c'est la facture qui parle */
const MAX_IMG = 4 * 1024 * 1024;
const MAX_PDF = 12 * 1024 * 1024;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  // l'app envoie aussi « apikey » (comme paiement et magasins) : sans lui ici,
  // le navigateur refusait d'envoyer la requête après le contrôle préalable
  // (OPTIONS 200, aucun POST) — « IA indisponible » pour tout le monde
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
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

type Essai =
  | { ok: true; data: { usage?: { input_tokens?: number; output_tokens?: number }; content?: unknown; parsed_output?: unknown }; modele: (typeof MODELES)[number] }
  | { ok: false; erreur: string; statut: number };

/* Un appel à l'API Messages, modèle par modèle (MODELES). Ce qui revient
   d'Anthropic en erreur part au journal de la fonction (le type et le
   message de l'API, jamais la demande de l'élève). */
async function demander(corps: Record<string, unknown>, key: string): Promise<Essai> {
  const debut = Date.now();
  let dernier: Essai = { ok: false, erreur: "upstream", statut: 502 };
  for (const [i, modele] of MODELES.entries()) {
    if (i && Date.now() - debut > BUDGET_MS) break;
    if (i) await new Promise((r) => setTimeout(r, 400 * i));
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ ...corps, model: modele.id }),
      });
    } catch (e) {
      console.error("anthropic réseau", modele.id, e instanceof Error ? e.message : e);
      dernier = { ok: false, erreur: "upstream", statut: 502 };
      continue;
    }
    if (res.ok) return { ok: true, data: await res.json(), modele };
    const texte = await res.text().catch(() => "");
    let type = "";
    try { type = JSON.parse(texte)?.error?.type ?? ""; } catch { /* corps illisible : le statut suffit */ }
    console.error("anthropic", modele.id, res.status, type, texte.slice(0, 300));
    // le crédit du compte Anthropic : 402 billing_error (ou un 400 qui le dit, sur une API plus ancienne)
    if (res.status === 402 || type === "billing_error" || /credit balance/i.test(texte)) {
      return { ok: false, erreur: "credit", statut: 503 };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, erreur: "nokey", statut: 503 };
    if (!REESSAYER.has(res.status)) return { ok: false, erreur: "upstream", statut: 502 };
    dernier = { ok: false, erreur: res.status === 429 || res.status === 529 ? "surcharge" : "upstream", statut: 503 };
  }
  return dernier;
}

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

/* L'atelier du Prompt : une conversation sur un paquet de pages. */
const SYSTEM_PROMPT = `Tu es l'atelier de flashcards de Mirandola, une app de révision. Avec un élève (ou son professeur), tu fabriques puis retouches un paquet de pages { f, b }, message après message.
  f = le recto, ce qu'on voit et doit retrouver
  b = le verso, la réponse attendue

À chaque message, tu reçois le contexte (le titre du livre, sa matière, la classe de l'élève, quand on les connaît), les pages actuelles (parfois aucune), les messages précédents, et le nouveau message : un cours collé, une consigne, ou les deux. Le contexte t'aide à viser le bon niveau ; c'est le message qui décide.

Tu rends TOUJOURS la liste complète des pages telle qu'elle doit être après ce message, et une note.

Fabriquer :
- Un cours, des notes, une liste collés : des pages fidèles à ce texte (définitions, dates, formules, vocabulaire, causes, conséquences). N'invente rien qui n'y est pas ; reprends ses mots.
- Une demande sur un sujet sans texte (« 10 cartes sur les capitales d'Europe ») : des pages justes, classiques, du niveau scolaire demandé, sur ce qui est établi avec certitude. Dans le doute sur un fait, ne l'écris pas.
- Une consigne de forme s'applique à toutes les pages qu'elle vise : « la définition au recto, le mot au verso », « une question au recto », « l'anglais au recto », « plus courtes », « avec un exemple au verso »…
- Une seule information par page ; recto et verso courts, sans phrase d'introduction, sans numérotation, sans puces.
- Respecte la langue, l'orthographe et les accents du texte.

Retoucher :
- Une retouche (ajoute, enlève, inverse, corrige, reformule, fusionne, sépare, traduis) ne change que ce qu'elle vise. Toutes les autres pages restent identiques, mot pour mot, dans le même ordre.
- « Inverse », « change le sens », « échange recto et verso » : le recto devient le verso et le verso le recto.
- « Ajoute… » : les pages nouvelles viennent à la fin, sans doublon de celles qui existent.
- « Enlève… », « supprime… » : retire seulement les pages visées.
- Si la demande ne peut pas s'appliquer, rends les pages inchangées et dis pourquoi dans la note.

Au plus ${MAX_CARDS} pages.

La note : une seule phrase, en français, qui tutoie, dit ce que tu as fait et combien de pages il y a (« 12 pages sur la photosynthèse, la définition au recto. »). Ni flatterie, ni question.`;

const SCHEMA_PROMPT = {
  type: "object",
  properties: {
    note: { type: "string" },
    cards: SCHEMA.properties.cards,
  },
  required: ["note", "cards"],
  additionalProperties: false,
};

const MAX_HIST = 12;      // les messages d'avant qu'on rappelle au modèle
const MAX_PAGE = 600;     // un recto ou un verso, en caractères

/* Le message du Prompt tel que le modèle le lit : les pages actuelles,
   numérotées, les messages d'avant, puis le nouveau. */
function messagePrompt(message: string, cards: { f: string; b: string }[], hist: string[], hint: string): string {
  const pages = cards.length
    ? cards.map((c, i) => `${i + 1}. ${c.f} ⟶ ${c.b}`).join("\n")
    : "(aucune)";
  return (hint ? `Contexte : ${hint}\n\n` : "")
    + `Pages actuelles (${cards.length}) :\n${pages}\n\n`
    + (hist.length ? `Messages précédents :\n${hist.map((h) => "- " + h).join("\n")}\n\n` : "")
    + `Nouveau message :\n${message}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "nokey" }, 503);

  const uid = uidOf(req);
  if (!uid) return json({ error: "auth" }, 401);

  let body: { op?: string; text?: string; hint?: string; data?: string; mime?: string; pages?: string;
    message?: string; cards?: unknown; historique?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "body" }, 400);
  }
  const op = String(body.op ?? "");
  if (op !== "cards" && op !== "ocr" && op !== "pdf" && op !== "prompt") return json({ error: "op" }, 400);
  const isFile = op === "ocr" || op === "pdf";

  /* Le Prompt : un message (de quoi faire au moins une consigne), les pages
     en cours (bornées comme celles qu'il rendra) et les messages d'avant. */
  let message = "", actuelles: { f: string; b: string }[] = [], hist: string[] = [];
  if (op === "prompt") {
    message = String(body.message ?? "").trim();
    if (message.length < 2) return json({ error: "short" }, 400);
    if (message.length > MAX_CHARS) return json({ error: "long", max: MAX_CHARS }, 413);
    const brutes = Array.isArray(body.cards) ? body.cards : [];
    if (brutes.length > MAX_CARDS) return json({ error: "long", max: MAX_CARDS }, 413);
    actuelles = brutes.map((c) => {
      const x = (c ?? {}) as { f?: unknown; b?: unknown };
      return { f: String(x.f ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PAGE),
               b: String(x.b ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PAGE) };
    }).filter((c) => c.f || c.b);
    hist = (Array.isArray(body.historique) ? body.historique : [])
      .map((h) => String(h ?? "").replace(/\s+/g, " ").trim().slice(0, 600)).filter(Boolean).slice(-MAX_HIST);
  }

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
  } else if (op === "cards") {
    text = String(body.text ?? "").trim();
    if (text.length < 40) return json({ error: "short" }, 400);
    if (text.length > MAX_CHARS) return json({ error: "long", max: MAX_CHARS }, 413);
  }

  /* garde-fous de dépense : plafond du mois, puis quota du jour */
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [{ data: month }, { count: mine }, { count: myFiles }, { count: myMonth }, { data: offre, error: sansOffre },
    { data: roles }, { data: quota }] =
    await Promise.all([
      admin.from("ai_usage").select("cents").gte("day", firstOfMonth),
      admin.from("ai_usage").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("day", today),
      isFile
        ? admin.from("ai_usage").select("id", { count: "exact", head: true })
          .eq("user_id", uid).eq("day", today).in("op", ["ocr", "pdf"])
        : Promise.resolve({ count: 0 }),
      admin.from("ai_usage").select("id", { count: "exact", head: true })
        .eq("user_id", uid).gte("day", firstOfMonth),
      admin.rpc("offre_de", { u: uid }),
      admin.from("user_roles").select("role").eq("user_id", uid),
      admin.rpc("ia_quota", { u: uid }),
    ]);
  const prof = (roles ?? []).some((r: { role: string }) => ["prof", "ref", "admin"].includes(r.role));
  if (!sansOffre && offre === "gratuit") return json({ error: "plus" }, 402);
  // le quota de la licence Campus d'abord ; nul (Mirandola+, ou une base sans la fonction) : celui des secrets
  const mensuel = typeof quota === "number" ? quota : prof ? MONTHLY_PROF : MONTHLY_PLUS;
  if (!sansOffre && (myMonth ?? 0) >= mensuel) {
    return json({ error: "mquota", quota: mensuel, mois: { fait: myMonth ?? 0, quota: mensuel } }, 429);
  }
  const spent = (month ?? []).reduce((a, r) => a + Number(r.cents), 0);
  if (spent >= BUDGET_CENTS) return json({ error: "budget" }, 402);
  if ((mine ?? 0) >= (prof ? DAILY_PROF : DAILY_CALLS)) return json({ error: "quota" }, 429);
  if (isFile && (myFiles ?? 0) >= (prof ? DAILY_FILES_PROF : DAILY_FILES)) return json({ error: "fquota" }, 429);

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
    : op === "prompt"
    ? [{ type: "text", text: messagePrompt(message, actuelles, hist, hint) }]
    : [{ type: "text", text: (hint ? `Consigne : ${hint}\n\n` : "") + "Texte :\n\n" + text }];

  const essai = await demander({
    max_tokens: 16000,
    system: op === "prompt" ? SYSTEM_PROMPT : isFile ? SYSTEM_FILE : SYSTEM,
    thinking: { type: "adaptive" },
    output_config: {
      // lire une page, ou suivre une consigne sur tout un paquet, demande plus d'attention
      effort: isFile || op === "prompt" ? "medium" : "low",
      format: { type: "json_schema", schema: op === "prompt" ? SCHEMA_PROMPT : SCHEMA },
    },
    messages: [{ role: "user", content }],
  }, key);
  // rien n'est compté : le mois reste tel quel
  if (!essai.ok) {
    return json({ error: essai.erreur, mois: { fait: myMonth ?? 0, quota: sansOffre ? null : mensuel } }, essai.statut);
  }
  const data = essai.data;

  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  const cents = inTok * essai.modele.entree + outTok * essai.modele.sortie;
  admin.from("ai_usage").insert({
    user_id: uid, day: today, op,
    in_tok: inTok, out_tok: outTok, cents: cents.toFixed(4),
  }).then(() => {}, () => {});

  let cards: { f: string; b: string }[] = [];
  const parsed = (data as { parsed_output?: { cards?: unknown; note?: unknown } }).parsed_output;
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
  // le compte du mois, cet appel compris : l'écran le pose sur ses onglets
  const mois = { fait: (myMonth ?? 0) + 1, quota: sansOffre ? null : mensuel };
  const note = op === "prompt" ? String((raw as { note?: unknown } | null)?.note ?? "").trim().slice(0, 300) : "";
  /* Un Prompt peut légitimement tout retirer (« enlève tout ce qui parle
     de… ») : une liste vide n'est une erreur que pour une génération. */
  if (!cards.length && op !== "prompt") return json({ error: "empty", mois }, 422);

  return json({
    cards,
    note,
    mois,
    usage: { in: inTok, out: outTok, cents: +cents.toFixed(4) },
    left: Math.max(0, DAILY_CALLS - (mine ?? 0) - 1),
    filesLeft: isFile ? Math.max(0, DAILY_FILES - (myFiles ?? 0) - 1) : undefined,
  });
});
