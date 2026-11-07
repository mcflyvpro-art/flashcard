Ce que la revue de sécurité de Mirandola doit savoir (lu par l'action
anthropics/claude-code-security-review, .github/workflows/revue-securite.yml).

- Les utilisateurs sont en grande partie des élèves MINEURS (RGPD) : toute
  donnée personnelle qui fuit (nom, adresse e-mail, livre, révisions,
  identifiant de compte) dans un journal, une URL, un rapport d'erreur, un
  message d'erreur ou la réponse d'une fonction est une faille sérieuse.
- La base est Supabase (Postgres + PostgREST), appelée en fetch brut. La
  sécurité est dans la base : RLS sur chaque table, fonctions SECURITY
  DEFINER qui vérifient leur appelant (auth.uid(), is_admin(), is_ref(),
  class_staff()…). Toute nouvelle table sans RLS, toute fonction SECURITY
  DEFINER sans garde ou sans `set search_path`, tout `grant` à `anon` est à
  signaler. Seules shared_deck, demander_demo et signaler sont ouvertes à
  anon, exprès.
- La clé « anon » de Supabase est publique par nature (dans le code et les
  workflows) : ce n'est pas une fuite. Une clé « service_role », une clé
  Stripe, Anthropic ou Brevo dans le dépôt en serait une.
- L'app redessine en innerHTML : tout texte venu d'un utilisateur (titre de
  livre, page, pseudo, message, nom de classe) doit passer par esc() avant
  d'entrer dans un gabarit HTML ou un attribut.
- La CSP est appliquée (vercel.json) : un script en ligne demande son
  empreinte ; ne jamais proposer 'unsafe-inline' pour script-src.
- Les fonctions Edge (supabase/functions) : verify_jwt coupé seulement pour
  stripe-webhook, magasins et prevenir, qui vérifient elles-mêmes leur
  appelant (signature Stripe, secret partagé, identifiant seul).
