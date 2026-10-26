-- ══════════ les codes d'un établissement se renouvellent seuls (2026-10-26) ══════════
-- Un code élèves ou professeurs fait entrer aussitôt, sans validation (un
-- seul code, 20261026001000) : toute sa sécurité tient dans le fait qu'il ne
-- traîne pas. Un code affiché au CDI en septembre, photographié, recopié sur
-- un groupe de discussion, ferait encore entrer n'importe qui en juin.
--
-- Chaque code a donc une date (`eleve_au`, `prof_au`) et l'établissement un
-- rythme (`rythme` : semaine par défaut — décidé le 2026-10-26 —, mois ou
-- trimestre, au choix du référent ; jamais « jamais »). Une tâche pg_cron
-- quotidienne tire un nouveau code pour chacun qui a fait son temps ; l'ancien
-- cesse aussitôt de faire entrer, ceux qui sont entrés restent. Le référent
-- lit le code du moment et sa date de fin dans sa console, un professeur
-- dans son bandeau (prof_code_etab rend toujours le code courant). Le
-- journal du référent garde la trace de chaque renouvellement.
--
-- Le code référent n'est pas concerné : il est à usage unique et vit 30 jours.

alter table public.org_codes
  add column if not exists rythme text not null default 'semaine',
  add column if not exists eleve_au timestamptz not null default now(),
  add column if not exists prof_au timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'org_codes_rythme') then
    alter table public.org_codes add constraint org_codes_rythme check (rythme in ('semaine', 'mois', 'trimestre'));
  end if;
end $$;

-- un code déjà affiché commence sa première semaine aujourd'hui, pas hier :
-- aucun établissement ne voit ses codes changer sous ses yeux au déploiement
update public.org_codes set eleve_au = now(), prof_au = now();

-- ---------- outils internes ----------
create or replace function public.duree_rythme(r text)
returns interval language sql immutable set search_path = '' as $$
  select case r when 'mois' then interval '1 month' when 'trimestre' then interval '3 months' else interval '7 days' end
$$;
revoke all on function public.duree_rythme(text) from public, anon, authenticated;

/* La tâche quotidienne : un code neuf pour chaque code échu. Rend le nombre
   de codes renouvelés. Appelée par pg_cron, jamais par un compte. */
create or replace function public.renouveler_codes()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select c.* from public.org_codes c
           where (c.eleve is not null and c.eleve_au + public.duree_rythme(c.rythme) <= now())
              or (c.prof is not null and c.prof_au + public.duree_rythme(c.rythme) <= now())
           for update loop
    if r.eleve is not null and r.eleve_au + public.duree_rythme(r.rythme) <= now() then
      update public.org_codes set eleve = public.code_unique(), eleve_au = now(), maj = now() where org_id = r.org_id;
      insert into public.ref_audit (org_id, actor, cible, acte, detail)
      values (r.org_id, null, null, 'code renouvelé', jsonb_build_object('role', 'eleve', 'rythme', r.rythme));
      n := n + 1;
    end if;
    if r.prof is not null and r.prof_au + public.duree_rythme(r.rythme) <= now() then
      update public.org_codes set prof = public.code_unique(), prof_au = now(), maj = now() where org_id = r.org_id;
      insert into public.ref_audit (org_id, actor, cible, acte, detail)
      values (r.org_id, null, null, 'code renouvelé', jsonb_build_object('role', 'prof', 'rythme', r.rythme));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.renouveler_codes() from public, anon, authenticated;

-- ---------- la console du référent ----------
create or replace function public.ref_codes()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); x public.orgs%rowtype; c public.org_codes%rowtype;
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  insert into public.org_codes (org_id) values (o) on conflict do nothing;
  update public.org_codes set eleve = coalesce(eleve, public.code_unique()),
                              prof = coalesce(prof, public.code_unique()),
                              eleve_au = case when eleve is null then now() else eleve_au end,
                              prof_au = case when prof is null then now() else prof_au end
  where org_id = o and (eleve is null or prof is null);
  select * into c from public.org_codes where org_id = o;
  select * into x from public.orgs where id = o;
  return jsonb_build_object('eleve', c.eleve, 'prof', c.prof, 'offre', x.offre,
    'places', x.places, 'licence_fin', x.licence_fin, 'eleves', public.etab_eleves(o),
    'profs', (select count(*) from public.org_members m join public.user_roles r on r.user_id = m.user_id
              where m.org_id = o and r.role = 'prof'),
    'rythme', c.rythme,
    'eleve_jusqua', c.eleve_au + public.duree_rythme(c.rythme),
    'prof_jusqua', c.prof_au + public.duree_rythme(c.rythme));
end $$;
revoke all on function public.ref_codes() from public, anon;
grant execute on function public.ref_codes() to authenticated;

-- changer un code à la main repart d'une période pleine
create or replace function public.ref_nouveau_code(quel text)
returns text language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); s text := public.code_unique();
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  if quel = 'eleve' then
    update public.org_codes set eleve = s, eleve_au = now(), maj = now() where org_id = o;
  elsif quel = 'prof' then
    update public.org_codes set prof = s, prof_au = now(), maj = now() where org_id = o;
  else
    raise exception 'Code inconnu';
  end if;
  if not found then raise exception 'Ouvre d''abord tes codes'; end if;
  perform public.ref_trace(null, 'code changé', jsonb_build_object('role', quel));
  return s;
end $$;
revoke all on function public.ref_nouveau_code(text) from public, anon;
grant execute on function public.ref_nouveau_code(text) to authenticated;

-- le rythme, au choix du référent
create or replace function public.ref_rythme(p text)
returns text language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org();
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  if p is null or p not in ('semaine', 'mois', 'trimestre') then
    raise exception 'Chaque semaine, chaque mois ou chaque trimestre';
  end if;
  update public.org_codes set rythme = p where org_id = o;
  if not found then raise exception 'Ouvre d''abord tes codes'; end if;
  perform public.ref_trace(null, 'rythme des codes', jsonb_build_object('rythme', p));
  return p;
end $$;
revoke all on function public.ref_rythme(text) from public, anon;
grant execute on function public.ref_rythme(text) to authenticated;

-- ---------- la tâche quotidienne ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'renouveler-codes-quotidien') then
      perform cron.unschedule('renouveler-codes-quotidien');
    end if;
    perform cron.schedule('renouveler-codes-quotidien', '53 2 * * *', 'select public.renouveler_codes();');
  else
    raise notice 'pg_cron absent : planifier select public.renouveler_codes(); chaque jour (supabase/REGLAGES.md)';
  end if;
end $$;
