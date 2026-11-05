-- Le partage d'un livre par son code (2026-11-05).
--
-- Un livre se prête désormais par un CODE (le jeton de `shares`, écrit
-- « ABCD-EFGH-JK », src/livre-code.js) qu'on entre dans « J'ai un code » :
-- le lien seul se perdait sur un téléphone sans l'app. La fonction reste
-- la même porte, ouverte à `anon` comme avant (un lien s'ouvre encore avant
-- la connexion), mais elle ne rend plus que ce qu'il faut pour lire et
-- copier le livre : le recto et le verso de chaque page.
--
-- Avant, elle rendait la colonne `cards` entière : l'état d'apprentissage
-- de qui prête (stabilité, difficulté, dates de lecture, nombre d'oublis,
-- pages suspendues) partait à quiconque avait le code, compte ou non — le
-- rythme de travail d'un élève, souvent mineur, sans aucune raison
-- (minimisation, règle 4 de CLAUDE.md). L'app n'en lisait que `f` et `b`
-- (`cf`/`cb` de ui/reglages-corbeille.js).
--
-- Et si un jour `decks.cards` n'est plus tenu (la double écriture vers
-- `cards`, M03.T3, a vocation à le remplacer), le livre se lit dans
-- `cards` : un livre prêté ne doit jamais arriver vide.

drop function if exists public.shared_deck(text);
create function public.shared_deck(tok text)
returns table(name text, subject text, cards jsonb, mode text, subject_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.name, d.subject,
         coalesce(
           (select jsonb_agg(jsonb_build_object('f', coalesce(c->>'f', ''), 'b', coalesce(c->>'b', '')) order by o)
              from jsonb_array_elements(case when jsonb_typeof(d.cards) = 'array' then d.cards else '[]'::jsonb end)
                   with ordinality as e(c, o)
             where jsonb_typeof(c) = 'object'),
           (select jsonb_agg(jsonb_build_object('f', coalesce(k.front, ''), 'b', coalesce(k.back, '')) order by k.created_at, k.id)
              from public.cards k where k.deck_id = d.id),
           '[]'::jsonb),
         s.mode, sj.name
  from public.shares s
  join public.decks d on d.id = s.deck_id
  left join public.subjects sj on sj.user_id = d.user_id and sj.id = d.subject
  where s.token = tok and d.deleted_at is null
$$;

revoke all on function public.shared_deck(text) from public;
grant execute on function public.shared_deck(text) to anon, authenticated;
