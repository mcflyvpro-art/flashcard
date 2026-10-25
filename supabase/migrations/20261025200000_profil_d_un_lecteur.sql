-- Le profil d'un lecteur (2026-10-25) : ce qu'on voit en touchant quelqu'un
-- dans le cercle, un club, la liste des amis ou une classe.
--
-- Qui voit quoi :
--   · soi-même, un ami (demande acceptée), un membre d'un même club : le
--     profil complet — pages lues sur 7 jours, 30 jours et depuis toujours,
--     réponses justes sur 30 jours, série en cours et record, pages lues
--     chaque jour des 5 dernières semaines, matières les plus lues (leurs
--     noms, 90 jours), heure préférée, nombre de livres lus (30 jours). Ce
--     sont, plus détaillés, les décomptes que le classement montrait déjà
--     entre amis et dans un club (leaderboard, club_membres).
--   · toute autre personne qu'on voit déjà (voit_personne : camarade ou
--     professeur d'une classe, joueur d'une partie, demande d'ami en
--     attente) : son nom, son pseudo, depuis quand elle lit, si elle est
--     amie et les clubs en commun — jamais ses chiffres (statut « prive ») :
--     des élèves mineurs ne se voient pas comparés à leurs camarades sans
--     l'avoir choisi en devenant amis.
--   · personne d'autre, ni un compte bloqué dans un sens ou dans l'autre :
--     « inconnu », sans dire si le compte existe.
-- Une matière écrite de deux façons (« Anglais », « anglais ») ne compte
-- qu'une fois, sous son écriture la plus récente.
-- Jamais un livre, une carte ni une réponse : des décomptes et des noms de
-- matières.

create or replace function public.profil_lecteur(u uuid, p_tz text default 'Europe/Paris')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  moi uuid := auth.uid();
  tz text := 'Europe/Paris';
  p record;
  ami boolean;
  complet boolean;
  auj date;
  res jsonb;
begin
  if moi is null then
    raise exception 'profil_lecteur : authentification requise' using errcode = '42501';
  end if;
  if p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then
    tz := p_tz;
  end if;
  if u is null or public.blocked(u) or not public.voit_personne(u) then
    return jsonb_build_object('statut', 'inconnu');
  end if;
  select coalesce(nullif(pr.name, ''), pr.handle, 'Compte') as nom, coalesce(pr.handle, '') as pseudo, pr.created_at
    into p from public.profiles pr where pr.id = u;
  if not found then
    return jsonb_build_object('statut', 'inconnu');
  end if;

  ami := exists (select 1 from public.friends f
                 where f.status = 'ok'
                   and ((f.user_id = moi and f.friend_id = u) or (f.user_id = u and f.friend_id = moi)));
  complet := u = moi or ami
    or exists (select 1 from public.group_members a join public.group_members b on b.group_id = a.group_id
               where a.user_id = moi and b.user_id = u);

  res := jsonb_build_object(
    'statut', case when complet then 'ok' else 'prive' end,
    'moi', u = moi,
    'nom', p.nom,
    'pseudo', p.pseudo,
    'depuis', to_char((p.created_at at time zone tz)::date, 'YYYY-MM-DD'),
    'ami', ami,
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nom', g.name, 'embleme', g.embleme, 'teinte', g.teinte)
                       order by g.name)
      from public.groups g
      where u <> moi
        and exists (select 1 from public.group_members a where a.group_id = g.id and a.user_id = moi)
        and exists (select 1 from public.group_members b where b.group_id = g.id and b.user_id = u)), '[]'::jsonb));
  if not complet then
    return res;
  end if;

  auj := (now() at time zone tz)::date;
  return res || (
    with r as (
      select (rv.created_at at time zone tz) as t, rv.correct, rv.subject_name, rv.deck_id
      from public.reviews rv
      where rv.user_id = u and rv.created_at >= now() - interval '400 days'
    ),
    j as (select distinct t::date as d from r),
    iles as (select d, d - (row_number() over (order by d))::int as g from j),
    series as (select max(d) as fin, count(*)::int as n from iles group by g),
    parjour as (select t::date as d, count(*)::int as n from r group by 1)
    select jsonb_build_object(
      'semaine', (select count(*) from r where t::date > auj - 7),
      'mois', (select count(*) from r where t::date > auj - 30),
      'toujours', (select count(*) from public.reviews rv where rv.user_id = u),
      'justes', (select case when count(*) filter (where correct is not null) > 0
                        then round(100.0 * count(*) filter (where correct) / count(*) filter (where correct is not null))::int
                        end
                 from r where t::date > auj - 30),
      'serie', coalesce((select n from series where fin >= auj - 1 order by fin desc limit 1), 0),
      'record', coalesce((select max(n) from series), 0),
      'jours', (select jsonb_agg(coalesce(c.n, 0) order by s.d)
                from generate_series(auj - 34, auj, interval '1 day') s(d)
                left join parjour c on c.d = s.d::date),
      'matieres', coalesce((
        select jsonb_agg(jsonb_build_object('nom', m.nom, 'n', m.n) order by m.n desc)
        from (select (array_agg(btrim(subject_name) order by t desc))[1] as nom, count(*)::int as n
              from r
              where t::date > auj - 90 and nullif(btrim(subject_name), '') is not null
              group by lower(btrim(subject_name))
              order by count(*) desc
              limit 3) m), '[]'::jsonb),
      'heure', (select extract(hour from t)::int from r where t::date > auj - 90
                group by 1 order by count(*) desc limit 1),
      'livres', (select count(distinct deck_id) from r where t::date > auj - 30)
    )
  );
end $$;

revoke all on function public.profil_lecteur(uuid, text) from public, anon;
grant execute on function public.profil_lecteur(uuid, text) to authenticated;
