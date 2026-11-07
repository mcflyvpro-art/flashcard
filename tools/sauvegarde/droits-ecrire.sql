-- Ce que `supabase db dump` ne rend pas fidèlement, écrit depuis le
-- catalogue de la base sauvegardée (vider.sh), rejoué après les données
-- (restaurer.sh). Trouvé par le premier essai de bout en bout, le
-- 2026-11-07 : les données revenaient toutes (97 tables, 0 écart), mais une
-- base vierge recrée chaque fonction et chaque table avec SES privilèges par
-- défaut — ouverts à anon et authenticated — que les REVOKE du vidage ne
-- reprennent pas ; et ce qui vit hors du schéma public n'y est pas : nos
-- déclencheurs sur auth.users, nos politiques du stockage, les tâches
-- pg_cron. Restaurée telle quelle, la base aurait ouvert à anon toutes les
-- fonctions internes.
--
-- Rend une instruction par ligne, dans l'ordre où les rejouer :
--   1. chaque fonction, table, vue et séquence de public : tout retiré,
--      puis exactement les droits de la source (aclexplode) ;
--   2. les droits par colonne (profiles : insert/update de quelques colonnes) ;
--   3. nos politiques sur les tables du stockage ;
--   4. nos déclencheurs posés sur auth et storage ;
--   5. les tâches pg_cron ;
--   6. les privilèges par défaut de 20261024122609.
-- Lecture seule : rien n'est écrit dans la base sauvegardée.

set search_path = '';

with objets as (
  select 'function'::text as genre, p.oid::regprocedure::text as nom,
         coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner)) as acl, p.proowner as proprio
  from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_catalog.pg_depend d
                    where d.classid = 'pg_catalog.pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  union all
  select case c.relkind when 'S' then 'sequence' else 'table' end, c.oid::regclass::text,
         coalesce(c.relacl, pg_catalog.acldefault(case c.relkind when 'S' then 's' else 'r' end::"char", c.relowner)),
         c.relowner
  from pg_catalog.pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    and not exists (select 1 from pg_catalog.pg_depend d
                    where d.classid = 'pg_catalog.pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
),
qui as (
  select oid, case oid when 0 then 'public' else pg_catalog.quote_ident(rolname) end as nom from pg_catalog.pg_roles
  union all select 0, 'public'
),
lignes as (
  select 1 as rang, o.nom as cle, 0 as sous,
         format('revoke all on %s %s from public, anon, authenticated, service_role;', o.genre, o.nom) as instr
  from objets o
  union all
  select 1, o.nom, 1,
         format('grant %s on %s %s to %s%s;', a.privilege_type, o.genre, o.nom, q.nom,
                case when a.is_grantable then ' with grant option' else '' end)
  from objets o cross join lateral pg_catalog.aclexplode(o.acl) a join qui q on q.oid = a.grantee
  where a.grantee <> o.proprio
  union all
  select 2, c.oid::regclass::text, 0,
         format('grant %s (%I) on table %s to %s;', a.privilege_type, att.attname, c.oid::regclass, q.nom)
  from pg_catalog.pg_class c
  join pg_catalog.pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped and att.attacl is not null
  cross join lateral pg_catalog.aclexplode(att.attacl) a join qui q on q.oid = a.grantee
  where c.relnamespace = 'public'::regnamespace and a.grantee <> c.relowner
  union all
  select 3, c.oid::regclass::text || pol.polname, 0,
         format('drop policy if exists %I on %s; create policy %I on %s as %s for %s to %s%s%s;',
                pol.polname, c.oid::regclass, pol.polname, c.oid::regclass,
                case when pol.polpermissive then 'permissive' else 'restrictive' end,
                case pol.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update'
                                when 'd' then 'delete' else 'all' end,
                (select string_agg(q.nom, ', ' order by q.nom) from qui q where q.oid = any(pol.polroles)),
                case when pol.polqual is not null then ' using (' || pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) || ')' else '' end,
                case when pol.polwithcheck is not null then ' with check (' || pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' else '' end)
  from pg_catalog.pg_policy pol join pg_catalog.pg_class c on c.oid = pol.polrelid
  where c.relnamespace = 'storage'::regnamespace
  union all
  select 4, c.oid::regclass::text || t.tgname, 0,
         format('drop trigger if exists %I on %s; %s;', t.tgname, c.oid::regclass, pg_catalog.pg_get_triggerdef(t.oid))
  from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid join pg_catalog.pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal and c.relnamespace in ('auth'::regnamespace, 'storage'::regnamespace)
    and p.pronamespace = 'public'::regnamespace
  union all
  select 5, j.jobname, 0, format('select cron.schedule(%L, %L, %L);', j.jobname, j.schedule, j.command)
  from cron.job j
  union all
  select 6, '', 0, 'alter default privileges for role postgres in schema public revoke execute on functions from public;'
)
select instr from lignes order by rang, cle, sous, instr;
