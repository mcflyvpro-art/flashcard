-- ══════════ la console de l'éditeur ══════════
-- L'éditeur ne gère pas un établissement, il les vend et les tient. Ce
-- qu'il regarde n'est donc ni une classe ni un élève : c'est une ligne par
-- établissement, avec ce qui décide d'un renouvellement — combien de
-- comptes ouverts, combien s'en servent vraiment, et ce que l'IA coûte.
--
-- Il n'entre pas dans les établissements. Aucune de ces fonctions ne rend
-- le contenu de qui que ce soit : des comptages, des dates, des centimes.

create or replace function public.admin_orgs()
returns table (id uuid, code text, name text, kind text, ville text, uai text,
               classes integer, eleves integer, profs integer, refs integer,
               devoirs integer, actifs7 integer, actifs30 integer,
               jamais_venus integer, cents_mois numeric, cents_total numeric,
               ouvert timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.code, o.name, o.kind, o.ville, o.uai,
    (select count(*)::integer from public.classes c where c.org_id = o.id),
    (select count(*)::integer from public.org_members m join public.user_roles r
     on r.user_id = m.user_id where m.org_id = o.id and r.role = 'eleve'),
    (select count(*)::integer from public.org_members m join public.user_roles r
     on r.user_id = m.user_id where m.org_id = o.id and r.role = 'prof'),
    (select count(*)::integer from public.org_members m join public.user_roles r
     on r.user_id = m.user_id where m.org_id = o.id and r.role = 'ref'),
    (select count(*)::integer from public.assignments a join public.classes c
     on c.id = a.class_id where c.org_id = o.id),
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.org_members m on m.user_id = s.user_id
     where m.org_id = o.id and s.created_at > now() - interval '7 days'),
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.org_members m on m.user_id = s.user_id
     where m.org_id = o.id and s.created_at > now() - interval '30 days'),
    (select count(*)::integer from public.org_members m join auth.users u
     on u.id = m.user_id where m.org_id = o.id and u.last_sign_in_at is null),
    (select coalesce(sum(a.cents), 0) from public.ai_usage a
     join public.org_members m on m.user_id = a.user_id
     where m.org_id = o.id and a.day >= date_trunc('month', current_date)),
    (select coalesce(sum(a.cents), 0) from public.ai_usage a
     join public.org_members m on m.user_id = a.user_id where m.org_id = o.id),
    o.created_at
  from public.orgs o
  where public.is_admin()
  order by o.name
$$;

-- Ce qui ne dépend d'aucun établissement : les comptes personnels, la
-- dépense totale, les signalements en attente. Un seul aller-retour.
create or replace function public.admin_etat()
returns table (comptes integer, hors_etab integer, orgs integer,
               actifs7 integer, cents_mois numeric,
               signalements integer, masques integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profiles p
     where not exists (select 1 from public.org_members m where m.user_id = p.id)),
    (select count(*)::integer from public.orgs),
    (select count(distinct s.user_id)::integer from public.sessions s
     where s.created_at > now() - interval '7 days'),
    (select coalesce(sum(a.cents), 0) from public.ai_usage a
     where a.day >= date_trunc('month', current_date)),
    (select count(*)::integer from public.reports where status = 'open'),
    (select count(*)::integer from public.reports where status = 'hidden')
  where public.is_admin()
$$;

-- ── L'éditeur peut nommer un référent ───────────────────────────────────
-- `set_role` ne connaissait que trois rôles : le quatrième, le référent
-- d'établissement, existe depuis `etablissements_et_quatre_roles` et ne
-- pouvait être attribué qu'à la main dans la base. C'est pourtant le seul
-- geste que l'éditeur fait à chaque vente.
--
-- Seul l'éditeur nomme un référent ou un autre éditeur : un référent reste
-- enfermé dans 'eleve' et 'prof' (voir `ref_set_role`), sinon un compte
-- compromis remonterait la hiérarchie.
create or replace function public.set_role(cible uuid, nouveau text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'non autorisé'; end if;
  if nouveau not in ('eleve', 'prof', 'ref', 'admin') then raise exception 'rôle inconnu'; end if;
  if cible = auth.uid() and nouveau <> 'admin' then
    raise exception 'on ne retire pas son propre rôle';
  end if;
  insert into public.user_roles (user_id, role) values (cible, nouveau)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  -- l'éditeur instruit les signalements ; les autres, non
  if nouveau = 'admin' then
    insert into public.moderators (user_id) values (cible) on conflict do nothing;
  else
    delete from public.moderators where user_id = cible;
  end if;
end $$;

grant execute on function public.admin_orgs() to authenticated;
grant execute on function public.admin_etat() to authenticated;
