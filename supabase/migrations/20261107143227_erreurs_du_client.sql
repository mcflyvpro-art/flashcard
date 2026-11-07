-- Les erreurs du client et la vigie (2026-11-07, M05.T1, M05.T4, M05.T6).
--
-- Avant, une erreur sur le téléphone d'un élève n'arrivait nulle part. Le
-- rapporteur de l'app (src/core/rapport-erreurs.js, règles dans
-- src/erreurs.js) l'envoie ici, ANONYME : ni compte (il n'envoie jamais la
-- session), ni adresse IP (rien ici ne lit les en-têtes de la requête), et
-- son texte nettoyé deux fois — dans l'app, puis ici, car un client ne se
-- croit jamais sur parole (texte_propre).
--
-- Tenir dans l'offre gratuite de Supabase (500 Mo) : on ne garde pas une
-- ligne par erreur mais une ligne par erreur DIFFÉRENTE et par jour
-- (empreinte, jour), qui compte ; au-delà de 200 erreurs différentes dans
-- une journée, le reste s'additionne dans « autres » ; au-delà de 5 000
-- erreurs dans l'heure, plus rien ne se compte ; 30 jours de garde. Au pire
-- quelques mégaoctets. Les ouvertures se comptent par heure (vigie_heures),
-- avec le temps jusqu'au premier écran utile rangé en six cases (le p75 se
-- lit sur leurs totaux, src/erreurs.js `p75`).
--
-- Qui lit quoi : personne par l'API brute (RLS sans politique, aucun
-- droit) ; l'éditeur par admin_erreurs et admin_vigie ; la vigie de GitHub
-- (.github/workflows/vigie.yml, connexion directe à la base) par vigie(),
-- qui ne rend aucun texte d'erreur — le dépôt est public, ses tickets aussi.
--
-- signaler est ouverte à anon : une erreur arrive aussi avant la connexion.
-- C'est la troisième fonction ouverte à anon, après shared_deck et
-- demander_demo, bornée comme elles.

create table public.erreurs_client (
  empreinte text not null,
  jour date not null,
  type text not null,
  message text not null default '',
  pile text not null default '',
  ecrans jsonb not null default '{}'::jsonb,
  navigateurs jsonb not null default '{}'::jsonb,
  builds jsonb not null default '{}'::jsonb,
  installee integer not null default 0,
  n integer not null default 1,
  premiere timestamptz not null default now(),
  derniere timestamptz not null default now(),
  primary key (empreinte, jour),
  constraint erreurs_type check (type in ('erreur', 'promesse', 'csp', 'bloque')),
  constraint erreurs_empreinte check (empreinte ~ '^[a-z][0-9a-f]{8}$' or empreinte = 'autres'),
  constraint erreurs_message_len check (length(message) <= 300),
  constraint erreurs_pile_len check (length(pile) <= 1500)
);
create index erreurs_client_jour on public.erreurs_client (jour);
alter table public.erreurs_client enable row level security;
revoke all on public.erreurs_client from public, anon, authenticated;

create table public.vigie_heures (
  heure timestamptz primary key,
  demarrages integer not null default 0,
  installees integer not null default 0,
  erreurs integer not null default 0,
  bloques integer not null default 0,
  cases integer[] not null default '{0,0,0,0,0,0}'
);
alter table public.vigie_heures enable row level security;
revoke all on public.vigie_heures from public, anon, authenticated;

-- Le même nettoyage que nettoyer() de src/erreurs.js. `lignes` garde les
-- retours à la ligne (une pile) ; un nombre de six chiffres ou plus qui
-- suit « : » (la colonne d'un fichier minifié) n'est pas une donnée.
create function public.texte_propre(t text, n integer, lignes boolean default false)
returns text language sql immutable set search_path = '' as $$
  select left(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(coalesce(t, ''), case when lignes then '[ \t\r]+' else '\s+' end, ' ', 'g'),
      'eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(\.[A-Za-z0-9_-]+)?', '<jeton>', 'g'),
      '[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+', '<courriel>', 'g'),
      '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '<id>', 'g'),
      '(https?://[^[:space:]?#''"()]+)[?#][^[:space:]''"()]*', '\1', 'g'),
      '\y[0-9a-fA-F]{16,}\y', '<hex>', 'g'),
      '(sk|pk|rk|whsec|xkeysib)[-_][A-Za-z0-9_-]{8,}', '<cle>', 'g'),
      '(?<![:0-9])[0-9]{6,}', '<n>', 'g'),
    n);
$$;
revoke all on function public.texte_propre(text, integer, boolean) from public, anon, authenticated;

-- Un compteur { clé: nombre } borné à douze clés : au-delà, tout va dans
-- « autre » (une boucle d'écrans ou de builds ne grossit pas la ligne).
create function public.compteur(m jsonb, k text)
returns jsonb language sql immutable set search_path = '' as $$
  select case
    when coalesce(k, '') = '' then m
    when m ? k then jsonb_set(m, array[k], to_jsonb((m->>k)::integer + 1))
    when (select count(*) from jsonb_object_keys(m)) < 12 then m || jsonb_build_object(k, 1)
    else jsonb_set(m, '{autre}', to_jsonb(coalesce((m->>'autre')::integer, 0) + 1))
  end;
$$;
revoke all on function public.compteur(jsonb, text) from public, anon, authenticated;

create function public.signaler(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  t text; e text; ec text; nav text; b text; inst boolean; ms integer; c integer;
  j date := (now() at time zone 'utc')::date;
  h timestamptz := date_trunc('hour', now());
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 8000 then return; end if;
  t := p->>'type';
  inst := coalesce(p->>'installee', '') = 'true';

  -- une ouverture : compter, et ranger son temps dans sa case
  if t = 'demarrage' then
    ms := case when coalesce(p->>'ms', '') ~ '^[0-9]{1,7}$' then (p->>'ms')::integer end;
    c := case when ms is null then null when ms < 1000 then 1 when ms < 2000 then 2 when ms < 3000 then 3
              when ms < 5000 then 4 when ms < 10000 then 5 else 6 end;
    insert into vigie_heures as v (heure, demarrages, installees, cases)
    values (h, 1, inst::integer,
            array(select case when i = c then 1 else 0 end from generate_series(1, 6) i order by i))
    on conflict (heure) do update set
      demarrages = least(v.demarrages + 1, 100000000),
      installees = least(v.installees + inst::integer, 100000000),
      cases = case when c is null then v.cases
                   else array(select case when u.i = c then u.x + 1 else u.x end
                              from unnest(v.cases) with ordinality u(x, i) order by u.i) end;
    return;
  end if;

  if t is null or t not in ('erreur', 'promesse', 'csp', 'bloque') then return; end if;
  -- une boucle d'erreurs, ou quelqu'un qui en invente : au-delà de 5 000
  -- dans l'heure, plus rien ne se compte
  if coalesce((select v.erreurs + v.bloques from vigie_heures v where v.heure = h), 0) >= 5000 then return; end if;
  e := coalesce(p->>'empreinte', '');
  if e !~ '^[a-z][0-9a-f]{8}$' then return; end if;
  if not exists (select 1 from erreurs_client x where x.empreinte = e and x.jour = j)
     and (select count(*) from erreurs_client x where x.jour = j) >= 200 then
    e := 'autres';
  end if;
  ec := left(regexp_replace(coalesce(p->>'ecran', ''), '[^a-zA-Z0-9-]', '', 'g'), 40);
  nav := left(regexp_replace(lower(coalesce(p->>'navigateur', '')), '[^a-z0-9 .-]', '', 'g'), 30);
  b := left(regexp_replace(lower(coalesce(p->>'build', '')), '[^a-z0-9]', '', 'g'), 40);

  insert into erreurs_client as x (empreinte, jour, type, message, pile, ecrans, navigateurs, builds, installee)
  values (e, j, t,
          case when e = 'autres' then 'autres erreurs du jour' else public.texte_propre(p->>'message', 300) end,
          case when e = 'autres' then '' else public.texte_propre(p->>'pile', 1500, true) end,
          public.compteur('{}', ec), public.compteur('{}', nav), public.compteur('{}', b), inst::integer)
  on conflict (empreinte, jour) do update set
    n = least(x.n + 1, 100000000),
    derniere = now(),
    ecrans = public.compteur(x.ecrans, ec),
    navigateurs = public.compteur(x.navigateurs, nav),
    builds = public.compteur(x.builds, b),
    installee = least(x.installee + inst::integer, 100000000);

  insert into vigie_heures as v (heure, erreurs, bloques)
  values (h, (t <> 'bloque')::integer, (t = 'bloque')::integer)
  on conflict (heure) do update set
    erreurs = v.erreurs + (t <> 'bloque')::integer,
    bloques = v.bloques + (t = 'bloque')::integer;
exception when others then
  return;   -- un rapport mal formé ne doit jamais faire une erreur de plus
end $$;
revoke all on function public.signaler(jsonb) from public;
grant execute on function public.signaler(jsonb) to anon, authenticated;

-- Ce que voit la vigie : les chiffres de l'heure et du jour, les erreurs
-- nées dans les 24 dernières heures (leur empreinte, leur type, leur
-- nombre, où et sur quoi — jamais leur texte), et s'il faut alerter.
-- SECURITY INVOKER et aucun droit pour anon ni authenticated : seule une
-- connexion directe à la base (la vigie de GitHub, l'éditeur par
-- admin_vigie) la lit.
create function public.vigie()
returns jsonb language sql stable set search_path = public as $$
  with heure as (
    select coalesce(sum(demarrages), 0) d, coalesce(sum(erreurs), 0) e, coalesce(sum(bloques), 0) b
    from vigie_heures where heure >= date_trunc('hour', now()) - interval '1 hour'
  ), jour as (
    select coalesce(sum(demarrages), 0) d, coalesce(sum(erreurs), 0) e, coalesce(sum(bloques), 0) b,
           coalesce(sum(installees), 0) i,
           array[coalesce(sum(cases[1]), 0), coalesce(sum(cases[2]), 0), coalesce(sum(cases[3]), 0),
                 coalesce(sum(cases[4]), 0), coalesce(sum(cases[5]), 0), coalesce(sum(cases[6]), 0)] cs
    from vigie_heures where heure >= now() - interval '24 hours'
  ), neuves as (
    select x.empreinte, min(x.type) type, sum(x.n) n, min(x.premiere) premiere,
           (array_agg(x.ecrans order by x.jour desc))[1] ecrans,
           (array_agg(x.navigateurs order by x.jour desc))[1] navigateurs
    from erreurs_client x
    group by x.empreinte
    having min(x.premiere) >= now() - interval '24 hours' and x.empreinte <> 'autres'
  ), raisons as (
    select array_remove(array[
      case when heure.d >= 20 and heure.e > heure.d * 0.01 then 'taux d''erreur au-dessus de 1 % sur la dernière heure' end,
      case when jour.e >= 10 and jour.e > jour.d * 0.01 then 'taux d''erreur au-dessus de 1 % sur 24 h' end,
      case when jour.b >= 2 then 'ouvertures bloquées (rien à l''écran au bout de 15 s)' end,
      case when exists (select 1 from neuves) then 'erreur nouvelle' end
    ], null) r
    from heure, jour
  )
  select jsonb_build_object(
    'a', now(),
    'heure', jsonb_build_object('demarrages', heure.d, 'erreurs', heure.e, 'bloques', heure.b),
    'jour', jsonb_build_object('demarrages', jour.d, 'erreurs', jour.e, 'bloques', jour.b,
                               'installees', jour.i, 'cases', to_jsonb(jour.cs)),
    'neuves', coalesce((select jsonb_agg(jsonb_build_object('empreinte', empreinte, 'type', type, 'n', n,
                               'premiere', premiere, 'ecrans', ecrans, 'navigateurs', navigateurs) order by n desc)
                        from neuves), '[]'::jsonb),
    'raisons', to_jsonb(raisons.r),
    'alerte', cardinality(raisons.r) > 0
  )
  from heure, jour, raisons;
$$;
revoke all on function public.vigie() from public, anon, authenticated;

-- L'éditeur : la vigie, et le détail des erreurs (texte compris).
create function public.admin_vigie()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  return public.vigie();
end $$;
revoke all on function public.admin_vigie() from public, anon;
grant execute on function public.admin_vigie() to authenticated;

create function public.admin_erreurs(jours integer default 7)
returns table (empreinte text, type text, message text, pile text, n bigint, jours_vus bigint,
               premiere timestamptz, derniere timestamptz, ecrans jsonb, navigateurs jsonb, builds jsonb)
language plpgsql security definer set search_path = public stable as $$
declare d date := (now() at time zone 'utc')::date - greatest(0, least(coalesce(jours, 7), 30));
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  return query
    select x.empreinte, min(x.type), (array_agg(x.message order by x.jour desc))[1],
           (array_agg(x.pile order by x.jour desc))[1], sum(x.n)::bigint, count(*)::bigint,
           min(x.premiere), max(x.derniere),
           (array_agg(x.ecrans order by x.jour desc))[1], (array_agg(x.navigateurs order by x.jour desc))[1],
           (array_agg(x.builds order by x.jour desc))[1]
    from erreurs_client x
    where x.jour >= d
    group by x.empreinte
    order by sum(x.n) desc
    limit 200;
end $$;
revoke all on function public.admin_erreurs(integer) from public, anon;
grant execute on function public.admin_erreurs(integer) to authenticated;

-- 30 jours d'erreurs, 90 jours d'heures : de quoi voir une tendance, rien
-- de plus (règle 4 : ce qu'on ne garde pas ne fuit pas).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-erreurs-client') then
      perform cron.unschedule('purge-erreurs-client');
    end if;
    perform cron.schedule('purge-erreurs-client', '47 3 * * *',
      'delete from public.erreurs_client where jour < current_date - 30; delete from public.vigie_heures where heure < now() - interval ''90 days'';');
  else
    raise notice 'pg_cron absent : effacer chaque jour les erreurs de plus de 30 jours (supabase/REGLAGES.md)';
  end if;
end $$;
