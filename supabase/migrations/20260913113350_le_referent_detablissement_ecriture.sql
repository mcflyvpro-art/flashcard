-- ══════════ le référent d'établissement — ce qu'il change ══════════
-- (Ce fichier réunit 20260913113125 et 20260913113350 : la première pose
--  ces fonctions, la seconde corrige le verrou d'identité. On n'en garde
--  que l'état final, et la raison de la correction est écrite plus bas.)
--
-- Ces fonctions touchent des comptes d'élèves mineurs : elles refont un
-- mot de passe, déplacent quelqu'un de classe, changent un rôle. Trois
-- règles s'appliquent à toutes, sans exception.
--
-- 1. Le périmètre est l'établissement, et rien d'autre. `is_ref()` pour le
--    rôle, l'appartenance à `my_org()` pour la cible. Vérifié dans chaque
--    fonction, parce qu'elles sont SECURITY DEFINER et que RLS ne les
--    rattrapera pas.
--
-- 2. Un référent ne touche ni un éditeur, ni un autre référent. Sans cette
--    règle, un seul compte compromis en récupère un deuxième, puis la
--    console d'administration : la hiérarchie ne doit pas se remonter.
--    Il ne peut pas non plus nommer d'éditeur — ce rôle vient d'ailleurs.
--
-- 3. Tout laisse une trace. Un DPO demandera qui a refait le mot de passe
--    d'un élève de quatrième, et « on ne sait pas » n'est pas une réponse.

create table if not exists public.ref_audit (
  id bigserial primary key,
  org_id uuid references public.orgs(id) on delete set null,
  actor uuid, cible uuid, acte text not null, detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ref_audit_org_idx on public.ref_audit (org_id, created_at desc);
alter table public.ref_audit enable row level security;

-- Lisible par les référents de l'établissement et par l'éditeur. Aucune
-- politique d'écriture : seules les fonctions ci-dessous y écrivent, et
-- personne ne peut effacer sa propre trace.
drop policy if exists audit_read on public.ref_audit;
create policy audit_read on public.ref_audit for select to authenticated
  using ((public.is_ref() and org_id = public.my_org()) or public.is_admin());

-- Le garde commun : lève si la cible n'est pas touchable, rend son rôle.
create or replace function public.ref_garde(cible uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  if not public.is_ref() then
    raise exception 'Réservé au référent de l''établissement';
  end if;
  if not exists (select 1 from public.org_members m
                 where m.user_id = cible and m.org_id = public.my_org()) then
    raise exception 'Ce compte n''est pas dans ton établissement';
  end if;
  r := coalesce((select role from public.user_roles where user_id = cible), 'eleve');
  if r in ('admin', 'ref') and cible <> auth.uid() then
    raise exception 'Un référent ne modifie ni un éditeur ni un autre référent';
  end if;
  return r;
end $$;

create or replace function public.ref_trace(cible uuid, acte text, detail jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (public.my_org(), auth.uid(), cible, acte, detail)
$$;

-- ── Refaire un mot de passe oublié ──────────────────────────────────────
-- Le cas le plus fréquent d'une rentrée, et celui qui fait perdre le plus
-- de temps quand il faut passer par l'éditeur. Le référent le fait lui-même
-- et lit le nouveau mot de passe à l'élève.
create or replace function public.ref_set_password(cible uuid, pw text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.ref_garde(cible);
  if length(coalesce(pw, '')) < 10 then
    raise exception 'Au moins dix caractères';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')),
         updated_at = now()
   where id = cible;
  perform public.ref_trace(cible, 'mot de passe refait');
end $$;

-- ── Le verrou d'identité ne se prête pas ────────────────────────────────
-- Première version : `ref_update_account` levait le verrou en posant un
-- drapeau de transaction (`folio.ref`), puis le laissait levé. Une
-- transaction PostgREST ne porte qu'une requête, donc rien n'était
-- exploitable depuis l'app — mais dans une même transaction, tout ce qui
-- suivait passait librement, y compris l'UPDATE d'un élève sur sa propre
-- ligne. Un verrou qu'on ouvre et qu'on oublie de refermer n'est pas un
-- verrou.
--
-- Le drapeau a disparu. Le trigger regarde qui appelle : un référent de
-- l'établissement de la cible passe, tout le reste est renversé. C'est la
-- même règle que `ref_garde`, posée là où elle s'applique, et elle ne peut
-- pas rester ouverte puisqu'elle n'est jamais ouverte — elle est évaluée à
-- chaque ligne.
--
-- Cela n'ouvre aucune porte vers l'API : la politique de `profiles` ne
-- laisse écrire que sa propre ligne, donc un référent qui appellerait
-- PATCH /profiles directement serait arrêté avant d'atteindre le trigger.
create or replace function public.lock_identite_scolaire()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_ref()
     and exists (select 1 from public.org_members m
                 where m.user_id = new.id and m.org_id = public.my_org())
  then
    return new;                       -- le référent corrige son établissement
  end if;
  if exists (select 1 from public.org_members m where m.user_id = new.id)
     and coalesce((select r.role from public.user_roles r where r.user_id = new.id), 'eleve') = 'eleve'
  then
    new.handle := old.handle;
    new.name   := old.name;
    new.email  := old.email;
  end if;
  return new;
end $$;

-- ── Corriger une identité ───────────────────────────────────────────────
-- Un nom mal orthographié à l'import, un pseudo déjà pris, une adresse à
-- changer.
create or replace function public.ref_update_account(
  cible uuid, nom text default null, pseudo text default null, adresse text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare av jsonb;
begin
  perform public.ref_garde(cible);
  select jsonb_build_object('nom', name, 'pseudo', handle, 'adresse', email)
    into av from public.profiles where id = cible;
  update public.profiles set
    name   = coalesce(nullif(trim(nom), ''), name),
    handle = coalesce(nullif(lower(trim(pseudo)), ''), handle),
    email  = coalesce(nullif(lower(trim(adresse)), ''), email),
    updated_at = now()
  where id = cible;
  if nullif(lower(trim(adresse)), '') is not null then
    update auth.users set email = lower(trim(adresse)), updated_at = now() where id = cible;
  end if;
  perform public.ref_trace(cible, 'identité corrigée',
    jsonb_build_object('avant', av, 'apres',
      jsonb_build_object('nom', nom, 'pseudo', pseudo, 'adresse', adresse)));
end $$;

-- ── Changer quelqu'un de classe ─────────────────────────────────────────
-- Un élève appartient à une classe à la fois dans son établissement. Le
-- déplacer, c'est le retirer de l'ancienne et l'inscrire dans la nouvelle :
-- en deux gestes séparés on oublie le premier, et l'élève reçoit les
-- devoirs de deux classes pendant trois semaines.
create or replace function public.ref_move_student(cible uuid, vers uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare qui text; avant text;
begin
  perform public.ref_garde(cible);
  if vers is not null and not public.class_in_org(vers) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  select string_agg(c.name, ', ') into avant
    from public.class_members cm join public.classes c on c.id = cm.class_id
    where cm.user_id = cible and c.org_id = public.my_org();
  delete from public.class_members cm using public.classes c
    where c.id = cm.class_id and cm.user_id = cible and c.org_id = public.my_org();
  if vers is not null then
    select coalesce(nullif(name, ''), handle, email) into qui
      from public.profiles where id = cible;
    insert into public.class_members (class_id, user_id, who)
    values (vers, cible, qui) on conflict do nothing;
  end if;
  perform public.ref_trace(cible,
    case when vers is null then 'retiré de sa classe' else 'changé de classe' end,
    jsonb_build_object('avant', avant,
      'apres', (select name from public.classes where id = vers)));
end $$;

-- ── Changer un rôle, dans les limites du rôle ───────────────────────────
create or replace function public.ref_set_role(cible uuid, nouveau text)
returns void language plpgsql security definer set search_path = '' as $$
declare av text;
begin
  av := public.ref_garde(cible);
  if nouveau not in ('eleve', 'prof') then
    raise exception 'Un référent nomme des élèves et des professeurs. Le reste vient de l''éditeur.';
  end if;
  if cible = auth.uid() then
    raise exception 'On ne se retire pas son propre rôle';
  end if;
  insert into public.user_roles (user_id, role) values (cible, nouveau)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  perform public.ref_trace(cible, 'rôle changé',
    jsonb_build_object('avant', av, 'apres', nouveau));
end $$;

grant execute on function public.ref_set_password(uuid, text) to authenticated;
grant execute on function public.ref_update_account(uuid, text, text, text) to authenticated;
grant execute on function public.ref_move_student(uuid, uuid) to authenticated;
grant execute on function public.ref_set_role(uuid, text) to authenticated;
revoke execute on function public.ref_garde(uuid) from authenticated, anon;
revoke execute on function public.ref_trace(uuid, text, jsonb) from authenticated, anon;
