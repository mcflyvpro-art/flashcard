-- ══════════ la console du référent, refaite (2026-10-26) ══════════
-- Depuis « un seul code » (20261026001000), un élève a une classe et peut
-- être dans des groupes, ou chez un professeur particulier : ref_people
-- rendait une ligne par appartenance — le même élève trois fois — et sa
-- « classe » au hasard de la jointure. ref_personnes rend une ligne par
-- personne, sa classe de rattachement (genre 'classe', dans l'établissement),
-- filtre sur l'appartenance à une classe OU à un groupe, et sait trouver les
-- élèves sans classe. ref_people reste pour les anciennes apps installées.

create or replace function public.ref_personnes(q text default '', qrole text default '', qclass uuid default null,
                                                sans_classe boolean default false, lim integer default 60,
                                                off integer default 0)
returns table (id uuid, email text, handle text, name text, role text, classe text, class_id uuid, matiere text,
               derniere timestamptz, jamais boolean, carte boolean, total bigint)
language sql stable security definer set search_path to '' as $$
  with base as (
    select p.id, p.email, p.handle,
           coalesce(nullif(p.name, ''), p.handle, p.email) as name,
           coalesce(r.role, 'eleve') as role,
           h.name as classe, h.id as class_id,
           nullif(m.subject, '') as matiere,
           u.last_sign_in_at as derniere,
           u.last_sign_in_at is null as jamais,
           exists (select 1 from public.comptes_geres g where g.user_id = m.user_id) as carte
    from public.org_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    left join public.user_roles r on r.user_id = m.user_id
    left join lateral (select c.id, c.name from public.class_members cm
                       join public.classes c on c.id = cm.class_id
                       where cm.user_id = m.user_id and c.org_id = m.org_id and c.genre = 'classe'
                       order by c.created_at limit 1) h on true
    where public.is_ref() and m.org_id = public.my_org()
      and (coalesce(qrole, '') = '' or coalesce(r.role, 'eleve') = qrole)
      and (qclass is null or exists (select 1 from public.class_members cm
                                     where cm.user_id = m.user_id and cm.class_id = qclass))
      and (not sans_classe or (coalesce(r.role, 'eleve') = 'eleve' and h.id is null))
      and (coalesce(q, '') = '' or p.email ilike '%' || q || '%'
           or coalesce(p.handle, '') ilike '%' || q || '%'
           or public.cle_nom(coalesce(p.name, '')) like '%' || public.cle_nom(q) || '%')
  )
  select b.*, count(*) over () from base b
  order by b.role, b.name
  limit greatest(1, least(coalesce(lim, 60), 300)) offset greatest(0, coalesce(off, 0))
$$;

revoke all on function public.ref_personnes(text, text, uuid, boolean, integer, integer) from public, anon;
grant execute on function public.ref_personnes(text, text, uuid, boolean, integer, integer) to authenticated;
