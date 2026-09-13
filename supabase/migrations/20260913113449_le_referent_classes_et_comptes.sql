-- ══════════ le référent — classes, services, ouverture de comptes ══════
-- La rentrée d'un établissement tient en trois gestes répétés : créer les
-- classes, attribuer les services d'enseignement, ouvrir les comptes. Sans
-- ces trois-là, un référent doit écrire à l'éditeur pour chaque ligne, et
-- personne ne déploie une app à ce prix.

-- ── Créer ou corriger une classe ────────────────────────────────────────
create or replace function public.ref_save_class(
  cid uuid default null, nom text default '', niveau text default '',
  cycle text default '', filiere text default '', prevu integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare k uuid; co text;
begin
  if not public.is_ref() then raise exception 'Réservé au référent de l''établissement'; end if;
  if nullif(trim(nom), '') is null then raise exception 'Il faut un nom de classe'; end if;
  if cid is null then
    co := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
             1 + floor(random() * 31)::integer, 1), '') from generate_series(1, 6));
    insert into public.classes (name, level, year, code, owner, org_id, filiere, cycle, effectif)
    values (trim(nom), nullif(trim(niveau), ''),
            case when extract(month from current_date) >= 8
                 then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
                 else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end,
            co, auth.uid(), public.my_org(), nullif(trim(filiere), ''),
            nullif(trim(cycle), ''), prevu)
    returning id into k;
    perform public.ref_trace(null, 'classe créée', jsonb_build_object('nom', nom, 'code', co));
    return k;
  end if;
  if not public.class_in_org(cid) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  update public.classes set
    name = trim(nom),
    level = nullif(trim(niveau), ''), cycle = nullif(trim(cycle), ''),
    filiere = nullif(trim(filiere), ''), effectif = prevu
  where id = cid;
  perform public.ref_trace(null, 'classe modifiée', jsonb_build_object('id', cid, 'nom', nom));
  return cid;
end $$;

-- ── Supprimer une classe, et seulement quand elle est vide ──────────────
-- Une classe pleine qu'on efface emporte ses devoirs et laisse trente
-- élèves sans rattachement. On demande de la vider d'abord : c'est un geste
-- de plus, et c'est le seul qui rende le premier réversible.
create or replace function public.ref_delete_class(cid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n integer; nom text;
begin
  if not public.is_ref() or not public.class_in_org(cid) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  select count(*) into n from public.class_members where class_id = cid;
  if n > 0 then
    raise exception 'Cette classe compte encore % élèves. Déplace-les d''abord.', n;
  end if;
  select name into nom from public.classes where id = cid;
  delete from public.teachings where class_id = cid;
  delete from public.classes where id = cid;
  perform public.ref_trace(null, 'classe supprimée', jsonb_build_object('nom', nom));
end $$;

-- ── Le service d'enseignement : qui fait quoi, où ───────────────────────
create or replace function public.ref_set_teaching(
  cid uuid, prof uuid, matiere text, pp boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare k uuid;
begin
  if not public.is_ref() or not public.class_in_org(cid) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  if not exists (select 1 from public.org_members m
                 where m.user_id = prof and m.org_id = public.my_org()) then
    raise exception 'Ce professeur n''est pas dans ton établissement';
  end if;
  if nullif(trim(matiere), '') is null then raise exception 'Il faut une matière'; end if;
  -- un seul professeur principal par classe : nommer le second démet le premier
  if pp then update public.teachings set principal = false where class_id = cid; end if;
  select id into k from public.teachings
    where class_id = cid and teacher = prof and subject = trim(matiere);
  if k is null then
    insert into public.teachings (class_id, teacher, subject, principal)
    values (cid, prof, trim(matiere), pp) returning id into k;
  else
    update public.teachings set principal = pp where id = k;
  end if;
  perform public.ref_trace(prof, 'service attribué',
    jsonb_build_object('classe', (select name from public.classes where id = cid),
                       'matiere', matiere, 'pp', pp));
  return k;
end $$;

create or replace function public.ref_drop_teaching(tid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare j record;
begin
  select t.teacher, t.subject, c.name as classe, c.id as cid into j
    from public.teachings t join public.classes c on c.id = t.class_id where t.id = tid;
  if j is null or not public.is_ref() or not public.class_in_org(j.cid) then
    raise exception 'Ce service n''est pas dans ton établissement';
  end if;
  delete from public.teachings where id = tid;
  perform public.ref_trace(j.teacher, 'service retiré',
    jsonb_build_object('classe', j.classe, 'matiere', j.subject));
end $$;

-- ── Ouvrir un compte ────────────────────────────────────────────────────
-- ⚠ Les huit colonnes de jetons ne peuvent pas rester NULL : le serveur
-- d'authentification est écrit en Go et les lit dans un type `string`. Il
-- répond 500 avant de regarder le mot de passe, et l'app affiche
-- « connexion impossible » sans que rien n'indique pourquoi. Voir
-- supabase/REGLAGES.md.
create or replace function public.ref_new_account(
  adresse text, nom text, pseudo text default '',
  qrole text default 'eleve', cid uuid default null, pw text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid; h text; ad text;
begin
  if not public.is_ref() then raise exception 'Réservé au référent de l''établissement'; end if;
  if qrole not in ('eleve', 'prof') then
    raise exception 'Un référent ouvre des comptes d''élève et de professeur.';
  end if;
  if length(coalesce(pw, '')) < 10 then raise exception 'Au moins dix caractères'; end if;
  ad := lower(trim(coalesce(adresse, '')));
  if ad !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if exists (select 1 from auth.users u where u.email = ad) then
    raise exception 'Cette adresse a déjà un compte';
  end if;
  if cid is not null and not public.class_in_org(cid) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  h := regexp_replace(lower(trim(coalesce(nullif(pseudo, ''), split_part(ad, '@', 1)))),
                      '[^a-z0-9_.-]', '', 'g');
  if exists (select 1 from public.profiles p where p.handle = h) then
    h := h || '.' || substr(md5(random()::text), 1, 3);
  end if;
  uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change,
    phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    ad, extensions.crypt(pw, extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (uid::text, uid,
          jsonb_build_object('sub', uid::text, 'email', ad, 'email_verified', true),
          'email', now(), now(), now());
  insert into public.profiles (id, email, name, handle)
  values (uid, ad, nullif(trim(nom), ''), h);
  insert into public.user_roles (user_id, role) values (uid, qrole)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  insert into public.org_members (user_id, org_id) values (uid, public.my_org())
    on conflict do nothing;
  if cid is not null and qrole = 'eleve' then
    insert into public.class_members (class_id, user_id, who)
    values (cid, uid, nullif(trim(nom), '')) on conflict do nothing;
  end if;
  perform public.ref_trace(uid, 'compte ouvert',
    jsonb_build_object('adresse', ad, 'role', qrole, 'pseudo', h));
  return uid;
end $$;

grant execute on function public.ref_save_class(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.ref_delete_class(uuid) to authenticated;
grant execute on function public.ref_set_teaching(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.ref_drop_teaching(uuid) to authenticated;
grant execute on function public.ref_new_account(text, text, text, text, uuid, text) to authenticated;
