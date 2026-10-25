-- Le journal de lecture ne doit plus jamais mentir, quoi qu'on fasse de ses
-- livres (2026-10-25).
--
-- Ce qui n'allait pas :
-- 1. Une révision ne savait d'elle-même que l'identifiant de son paquet. Le
--    journal retrouvait la matière en cherchant ce paquet AUJOURD'HUI : un
--    paquet supprimé, fusionné ou scindé (ses cartes partent dans un autre
--    paquet, l'original à la corbeille puis à la purge) faisait basculer
--    tout son temps dans « Autres » ; changer la matière d'un paquet
--    réécrivait le passé — trois heures de droit devenaient trois heures
--    d'anglais. En base ce jour : 474 révisions dont le paquet n'existe
--    plus, 717 dont le paquet est à la corbeille.
-- 2. L'app lisait « jusqu'à 20 000 révisions » d'une traite, mais PostgREST
--    n'en rend que 1 000 (db-max-rows) : au-delà, le journal restait figé
--    sur les 1 000 plus anciennes de l'année, sans rien signaler.
-- 3. Une révision faite hors ligne était datée de son envoi (created_at
--    par défaut), pas du moment où on l'avait faite : la séance d'hier soir
--    dans le train comptait pour aujourd'hui.
--
-- Le principe, désormais : une révision est un fait, écrit une fois avec
-- son contexte du moment — sa matière (identifiant et nom), le nom de son
-- livre, et l'écart en jours depuis la lecture précédente de la même page
-- (-1 la toute première fois). Le passé ne bouge plus ; ce qu'on sait
-- AUJOURD'HUI se lit sur les cartes elles-mêmes, côté app (src/journal.js).

alter table public.reviews
  add column if not exists subject text,
  add column if not exists subject_name text,
  add column if not exists deck_name text,
  add column if not exists ecart integer;

comment on column public.reviews.subject is
  'Identifiant de la matière du livre au moment de la révision (photographie, jamais réécrite).';
comment on column public.reviews.subject_name is
  'Nom de cette matière au moment de la révision.';
comment on column public.reviews.deck_name is
  'Nom du livre au moment de la révision.';
comment on column public.reviews.ecart is
  'Jours écoulés depuis la révision précédente de la même page ; -1 pour la toute première.';

-- Reprise du passé : le meilleur contexte qui reste, celui du paquet tel
-- qu'il est (corbeille comprise). Les révisions d'un paquet déjà purgé
-- restent sans matière : on ne l'invente pas.
update public.reviews r set subject = d.subject, deck_name = d.name
from public.decks d
where d.id = r.deck_id and d.user_id = r.user_id and r.subject is null;

update public.reviews r set subject_name = s.name
from public.subjects s
where s.user_id = r.user_id and s.id = r.subject and r.subject_name is null;

with x as (
  select id, created_at - lag(created_at) over (partition by user_id, deck_id, card_id order by created_at, id) as dt
  from public.reviews
)
update public.reviews r
set ecart = case when x.dt is null then -1 else floor(extract(epoch from x.dt) / 86400)::int end
from x where x.id = r.id and r.ecart is null;

/* Ce que l'app d'aujourd'hui envoie elle-même (elle sait la matière et le
   livre au moment où on lit, même hors ligne), une version plus ancienne
   restée en cache ne l'envoie pas : le déclencheur complète alors depuis
   le paquet tel qu'il est à l'arrivée de la ligne. Il ne remplace jamais
   ce que l'app a dit. Une date dans le futur (horloge d'appareil fausse)
   est ramenée à maintenant. */
create or replace function public.reviews_contexte()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_subject text; v_deck text; v_prec timestamptz;
begin
  if new.created_at > now() + interval '5 minutes' then new.created_at := now(); end if;
  if new.subject is null or new.deck_name is null then
    select d.subject, d.name into v_subject, v_deck
    from public.decks d where d.id = new.deck_id and d.user_id = new.user_id;
    new.subject := coalesce(new.subject, v_subject);
    new.deck_name := coalesce(new.deck_name, v_deck);
  end if;
  if new.subject_name is null and coalesce(new.subject, '') <> '' then
    select s.name into new.subject_name
    from public.subjects s where s.user_id = new.user_id and s.id = new.subject;
  end if;
  if new.ecart is null then
    select max(r.created_at) into v_prec
    from public.reviews r
    where r.user_id = new.user_id and r.deck_id = new.deck_id and r.card_id = new.card_id
      and r.created_at < new.created_at;
    new.ecart := case when v_prec is null then -1
                      else floor(extract(epoch from (new.created_at - v_prec)) / 86400)::int end;
  end if;
  return new;
end $$;

revoke all on function public.reviews_contexte() from public, anon, authenticated;

drop trigger if exists contexte_revision on public.reviews;
create trigger contexte_revision before insert on public.reviews
  for each row execute function public.reviews_contexte();

/* Le journal d'un compte, agrégé ici plutôt que lu ligne à ligne : une
   année de révisions peut dépasser cent mille lignes, PostgREST n'en rend
   que mille, et le téléphone n'a rien à faire de chacune. On regroupe par
   jour (dans le fuseau de l'appareil), matière, livre et palier d'écart ;
   les bornes des paliers viennent de l'app (src/journal.js, PALIERS) :
   la règle reste dans le noyau, la base ne fait que compter.
   `p_locaux` : les révisions que l'appareil a faites et pas encore vues
   revenir ; la réponse dit lesquelles la base a déjà, dans la même
   photographie que les comptes — ni oubli, ni double compte. */
create or replace function public.journal(p_depuis timestamptz, p_tz text, p_bornes integer[],
                                          p_locaux text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text := coalesce(nullif(p_tz, ''), 'UTC');
  moi uuid := auth.uid();
begin
  if moi is null then raise exception 'Connexion requise'; end if;
  begin
    perform now() at time zone tz;
  exception when others then
    tz := 'UTC';                                -- fuseau inconnu : on compte en UTC plutôt que d'échouer
  end;
  return (
    with r as (
      select (created_at at time zone tz)::date as j,
             extract(hour from created_at at time zone tz)::int as h,
             coalesce(subject, '') as s, subject_name, deck_id, deck_name, correct, ms, created_at,
             case when ecart is null or ecart < 0 then -1 else width_bucket(ecart, p_bornes) end as p
      from public.reviews
      where user_id = moi and created_at >= p_depuis
    )
    select jsonb_build_object(
      'jours', coalesce((select jsonb_agg(jsonb_build_array(j, s, deck_id, p, n, ok, ms) order by j)
                         from (select j, s, deck_id, p, count(*) as n, count(*) filter (where correct) as ok,
                                      coalesce(sum(ms), 0) as ms
                               from r group by j, s, deck_id, p) g), '[]'::jsonb),
      'heures', coalesce((select jsonb_agg(jsonb_build_array(j, h, n))
                          from (select j, h, count(*) as n from r group by j, h) g), '[]'::jsonb),
      'matieres', coalesce((select jsonb_object_agg(s, nom)
                            from (select distinct on (s) s, subject_name as nom from r
                                  where subject_name is not null order by s, created_at desc) g), '{}'::jsonb),
      'livres', coalesce((select jsonb_object_agg(deck_id, nom)
                          from (select distinct on (deck_id) deck_id, deck_name as nom from r
                                where deck_name is not null order by deck_id, created_at desc) g), '{}'::jsonb),
      'toujours', (select jsonb_build_object('n', count(*), 'ok', count(*) filter (where correct),
                                             'ms', coalesce(sum(ms), 0), 'depuis', min(created_at))
                   from public.reviews where user_id = moi),
      'connus', coalesce((select jsonb_agg(client_id) from public.reviews
                          where user_id = moi and client_id = any(p_locaux[1:5000])), '[]'::jsonb)
    )
  );
end $$;

revoke all on function public.journal(timestamptz, text, integer[], text[]) from public, anon;
grant execute on function public.journal(timestamptz, text, integer[], text[]) to authenticated;

/* Un livre qui voyage garde le NOM de sa matière : l'identifiant d'une
   matière n'a de sens que chez son propriétaire (« droit » chez l'un peut
   être « Allemand » renommé chez l'autre). Celui qui reçoit retrouve la
   sienne par le nom, ou la voit créée. */
drop function if exists public.shared_deck(text);
create function public.shared_deck(tok text)
returns table(name text, subject text, cards jsonb, mode text, subject_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.name, d.subject, d.cards, s.mode, sj.name
  from public.shares s
  join public.decks d on d.id = s.deck_id
  left join public.subjects sj on sj.user_id = d.user_id and sj.id = d.subject
  where s.token = tok and d.deleted_at is null
$$;

revoke all on function public.shared_deck(text) from public;
grant execute on function public.shared_deck(text) to anon, authenticated;

alter table public.mail add column if not exists subject_name text;
alter table public.mail drop constraint if exists mail_subject_name_len;
alter table public.mail add constraint mail_subject_name_len check (char_length(subject_name) <= 60);
