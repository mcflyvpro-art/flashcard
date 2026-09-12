-- ══════════ comptes d'essai ══════════
-- À jouer dans l'éditeur SQL du projet. Trois comptes, trois interfaces :
-- l'élève reçoit et travaille, le professeur distribue et suit,
-- l'administrateur instruit les signalements.
--
--   admin@folio.app   FolioAdmin2026
--   prof@folio.app    FolioProf2026
--   eleve@folio.app   FolioEleve2026
--
-- ⚠ LE PIÈGE, et il coûte une heure si on ne le connaît pas.
-- Créer un compte à la main laisse les colonnes de jetons à NULL, alors que
-- l'inscription normale y met une chaîne vide. Le serveur d'authentification
-- est écrit en Go et les lit dans un type « string » qui n'accepte pas NULL :
-- il répond 500 avant même de regarder le mot de passe, et l'app affiche
-- « connexion impossible » sans que rien n'indique pourquoi. Dans les
-- journaux (auth_logs) cela donne :
--
--   error finding user: sql: Scan error on column index 3,
--   name "confirmation_token": converting NULL to string is unsupported
--
-- D'où le bloc de chaînes vides ci-dessous. Ne pas le retirer.

do $$
declare
  cible text[][] := array[
    array['admin@folio.app', 'FolioAdmin2026', 'admin', 'Direction'],
    array['prof@folio.app',  'FolioProf2026',  'prof',  'M. Bernard'],
    array['eleve@folio.app', 'FolioEleve2026', 'eleve', 'Léa Martin']
  ];
  ligne text[]; uid uuid;
begin
  foreach ligne slice 1 in array cible loop
    select id into uid from auth.users where email = ligne[1];
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
        -- jamais NULL : voir l'avertissement en tête de fichier
        confirmation_token, recovery_token, email_change_token_new,
        email_change_token_current, email_change, phone_change,
        phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        ligne[1], extensions.crypt(ligne[2], extensions.gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false,
        '', '', '', '', '', '', '', ''
      );
      insert into auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', ligne[1], 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
    insert into public.profiles (id, email, name, handle)
    values (uid, ligne[1], ligne[4], split_part(ligne[1], '@', 1))
      on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    insert into public.user_roles (user_id, role) values (uid, ligne[3])
      on conflict (user_id) do update set role = excluded.role, set_at = now();
  end loop;
end $$;

-- L'administrateur instruit les signalements.
insert into public.moderators (user_id)
select id from auth.users where email = 'admin@folio.app'
on conflict do nothing;

-- Une classe tenue par le professeur, que l'élève a rejointe, avec un devoir.
do $$
declare p uuid; e uuid; c uuid;
begin
  select id into p from auth.users where email = 'prof@folio.app';
  select id into e from auth.users where email = 'eleve@folio.app';
  select id into c from public.classes where code = '2NDEB1';
  if c is null then
    c := gen_random_uuid();
    insert into public.classes (id, name, level, year, code, owner)
    values (c, '2nde B — Anglais', 'Seconde', '2026-2027', '2NDEB1', p);
  end if;
  insert into public.class_members (class_id, user_id, who) values (c, e, 'Léa Martin')
    on conflict do nothing;
  if not exists (select 1 from public.assignments where class_id = c) then
    insert into public.assignments (class_id, name, cards, n, due, created_by)
    values (c, 'Irregular verbs — série 1',
      '[["to go","aller"],["to take","prendre"],["to bring","apporter"],["to think","penser"]]'::jsonb,
      4, current_date + 7, p);
  end if;
end $$;

-- Filet de sécurité : si un compte a été créé autrement, on répare ses jetons.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change               = coalesce(email_change, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '');

-- Vérification.
select u.email, r.role,
       u.encrypted_password is not null as mdp,
       u.email_confirmed_at is not null as confirme,
       u.confirmation_token = ''        as jetons_ok
from auth.users u join public.user_roles r on r.user_id = u.id
order by case r.role when 'admin' then 1 when 'prof' then 2 else 3 end;
