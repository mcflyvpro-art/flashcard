-- ══════════ « Brancher Stripe » : ce que la fonction paiement range (2026-11-02) ══════════
-- Une seule clé à poser (STRIPE_SECRET_KEY, secret des Edge Functions) ;
-- « Brancher Stripe », dans la console de l'éditeur (Entreprise), crée chez
-- Stripe le produit Mirandola+, ses deux prix, le point d'arrivée des
-- évènements et le portail client, et range ici ce qu'il faut en garder :
-- les identifiants des prix et du portail, et le secret de signature du
-- point d'arrivée (Stripe ne le donne qu'à sa création). Une clé par mode :
-- « test:prix_annuel », « live:webhook_secret »…
--
-- Lue et écrite par les fonctions paiement et stripe-webhook, au rôle
-- service : RLS activée, AUCUNE politique, aucun droit pour anon ni
-- authenticated. Personne d'autre ne la lit, pas même l'éditeur (la console
-- n'en voit que l'état, par la fonction paiement, jamais un secret).
create table if not exists public.stripe_reglages (
  cle    text primary key check (cle ~ '^(test|live):[a-z_]{2,40}$'),
  valeur text not null check (length(valeur) <= 500),
  maj    timestamptz not null default now()
);
alter table public.stripe_reglages enable row level security;
revoke all on table public.stripe_reglages from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_reglages to service_role;
comment on table public.stripe_reglages is
  'Ce que « Brancher Stripe » (fonction paiement) range : prix, portail, secret du webhook, par mode. Rôle service seul.';
