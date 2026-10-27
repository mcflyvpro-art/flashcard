-- ══════════ Les pseudos ont des règles (2026-10-27) ══════════
-- Jusqu'ici, rien ne cadrait le pseudo : trois caractères au moins côté
-- app, n'importe quoi d'autre (tirets, majuscules, mots grossiers,
-- « admin »), des comptes sans pseudo, et un déclencheur
-- (lock_identite_scolaire) qui rendait en silence son ancien pseudo à tout
-- élève d'établissement. Désormais :
--   · tout compte a un pseudo, attribué d'office à la création de sa ligne
--     de profil (le prénom, sinon « lecteur », et des chiffres s'il est
--     pris) — rétroactivement pour ceux qui n'en avaient pas ;
--   · un pseudo suit la règle `pseudo_motif` (3 à 20 caractères, lettres
--     minuscules, chiffres, point, tiret bas ; commence par une lettre,
--     finit par une lettre ou un chiffre, jamais deux signes à la suite ;
--     ni mot réservé, ni mot grossier) — la même, mot pour mot, que
--     src/pseudo.js (test/pseudo.test.js compare les listes) ;
--   · deux comptes n'ont jamais le même pseudo, au point et au tiret bas
--     près (`cle_pseudo` : « lea.martin » = « lea_martin » = « leamartin ») ;
--   · il ne se change que par `changer_pseudo` : deux changements par
--     semaine au plus, et un pseudo quitté reste à son ancien titulaire
--     30 jours (personne ne prend aussitôt le nom d'un autre). L'API brute
--     ne peut plus l'écrire (droits par colonne) ;
--   · un élève d'établissement a son pseudo comme tout le monde : seuls son
--     nom (« Prénom NOM ») et son adresse restent verrouillés.

-- ---------- 1. la règle ----------
create or replace function public.pseudo_motif(h text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  reserves constant text[] := array['admin', 'administrateur', 'administratrice', 'administration', 'moderateur', 'moderatrice',
      'moderation', 'modo', 'folio', 'support', 'staff', 'equipe', 'team', 'officiel',
      'officielle', 'official', 'system', 'systeme', 'root', 'anthropic', 'claude', 'prof',
      'professeur', 'professeure', 'referent', 'referente', 'editeur', 'proviseur', 'proviseure',
      'principal', 'principale', 'directeur', 'directrice', 'securite', 'security', 'aide', 'help',
      'contact', 'service', 'null', 'undefined', 'anonyme', 'inconnu', 'utilisateur', 'compte',
      'eleve', 'enseignant', 'enseignante', 'cpe', 'bot'];
  prefixes constant text[] := array['folio', 'admin', 'moderat'];
  mots constant text[] := array['con', 'conne', 'cons', 'cul', 'culs', 'pute', 'putes', 'bite', 'bites', 'nique', 'niquer',
      'ntm', 'tg', 'pd', 'pede', 'pedes', 'pedo', 'chatte', 'zizi', 'sexe', 'sex', 'viol', 'nazi',
      'nazis', 'negre', 'negro', 'dick', 'cock', 'cunt', 'fag', 'rape', 'porc', 'gouine',
      'tapette', 'suce', 'sucer', 'kys', 'tepu'];
  racines constant text[] := array['connard', 'connasse', 'salope', 'salaud', 'encule', 'batard', 'putain', 'merde', 'fdp',
      'couille', 'branlette', 'branleur', 'penis', 'vagin', 'porn', 'xxx', 'fuck', 'shit', 'bitch',
      'nigger', 'nigga', 'whore', 'slut', 'hitler', 'pedophile', 'violeur', 'suicide', 'terroris',
      'pucelle'];
  s text;
begin
  if h is null or length(h) < 3 then return 'court'; end if;
  if length(h) > 20 then return 'long'; end if;
  if h !~ '^[a-z0-9._]+$' then return 'caracteres'; end if;
  if h !~ '^[a-z]' then return 'debut'; end if;
  if h ~ '[._]$' then return 'fin'; end if;
  if h ~ '[._]{2}' then return 'double'; end if;
  s := translate(h, '013457', 'oieast');               -- « c0nn4rd » se lit « connard »
  if exists (select 1 from unnest(regexp_split_to_array(s, '[^a-z]+')) m where m = any (reserves))
     or exists (select 1 from unnest(prefixes) p where starts_with(s, p)) then
    return 'reserve';
  end if;
  if exists (select 1 from unnest(regexp_split_to_array(s, '[^a-z]+')) m where m = any (mots)) then
    return 'interdit';
  end if;
  if exists (select 1 from unnest(racines) r where strpos(translate(s, '._', ''), r) > 0) then
    return 'interdit';
  end if;
  return 'ok';
end $$;

-- la clé d'unicité : sans les points ni les tirets bas
create or replace function public.cle_pseudo(h text)
returns text language sql immutable set search_path = '' as $$ select translate(lower(h), '._', '') $$;

-- pur, sans rien de privé : tout compte peut s'en servir (contrainte, index)
revoke all on function public.pseudo_motif(text), public.cle_pseudo(text) from public, anon;
grant execute on function public.pseudo_motif(text), public.cle_pseudo(text) to authenticated;

-- ---------- 2. le journal : les changements, et les pseudos quittés ----------
create table if not exists public.pseudo_journal (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ancien text,
  nouveau text not null,
  cree_le timestamptz not null default now()
);
create index if not exists pseudo_journal_compte on public.pseudo_journal (user_id, cree_le desc);
create index if not exists pseudo_journal_ancien on public.pseudo_journal (public.cle_pseudo(ancien), cree_le desc);
alter table public.pseudo_journal enable row level security;
drop policy if exists "pseudo_journal : chacun lit le sien" on public.pseudo_journal;
create policy "pseudo_journal : chacun lit le sien" on public.pseudo_journal
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.pseudo_journal from anon;
revoke insert, update, delete, truncate on public.pseudo_journal from authenticated;

-- pris : par un autre compte, ou quitté par un autre depuis moins de 30 jours
create or replace function public.pseudo_pris(h text, pour uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where public.cle_pseudo(p.handle) = public.cle_pseudo(h) and p.id is distinct from pour)
      or exists (select 1 from public.pseudo_journal j
                 where public.cle_pseudo(j.ancien) = public.cle_pseudo(h)
                   and j.user_id is distinct from pour and j.cree_le > now() - interval '30 days')
$$;

-- un pseudo libre tiré d'un prénom : le prénom s'il passe la règle et
-- qu'il est libre, sinon avec des chiffres, « lecteur » s'il ne passe pas
create or replace function public.pseudo_neuf(base text, pour uuid default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare b text; k text; n integer := 0;
begin
  b := lower(extensions.unaccent('extensions.unaccent'::regdictionary, split_part(trim(coalesce(base, '')), ' ', 1)));
  b := regexp_replace(b, '[^a-z0-9._]', '', 'g');
  b := regexp_replace(b, '^[^a-z]+', '');
  b := regexp_replace(b, '[._]{2,}', '.', 'g');
  b := regexp_replace(left(b, 14), '[._]+$', '');
  if public.pseudo_motif(b) <> 'ok' then b := 'lecteur'; end if;
  k := b;
  while public.pseudo_motif(k) <> 'ok' or public.pseudo_pris(k, pour) loop
    n := n + 1;
    k := b || case when n <= 20 then (10 + floor(random() * 90))::int else (1000 + floor(random() * 9000))::int end::text;
  end loop;
  return k;
end $$;
revoke all on function public.pseudo_pris(text, uuid), public.pseudo_neuf(text, uuid) from public, anon, authenticated;

-- ---------- 3. le nom reste verrouillé, plus le pseudo ----------
create or replace function public.lock_identite_scolaire()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_ref()
     and exists (select 1 from public.org_members m
                 where m.user_id = new.id and m.org_id = public.my_org()) then
    return new;
  end if;
  if exists (select 1 from public.comptes_geres g
             where g.user_id = new.id
               and (g.cree_par = auth.uid()
                    or exists (select 1 from public.class_members cm
                               where cm.user_id = new.id and public.class_manager(cm.class_id)))) then
    return new;
  end if;
  if (exists (select 1 from public.org_members m where m.user_id = new.id)
      and coalesce((select r.role from public.user_roles r where r.user_id = new.id), 'eleve') = 'eleve')
     or exists (select 1 from public.comptes_geres g where g.user_id = new.id) then
    -- le pseudo n'est plus verrouillé (2026-10-27) : il a sa règle et sa
    -- porte (changer_pseudo) ; le nom de classe et l'adresse, si
    new.name  := old.name;
    new.email := old.email;
  end if;
  return new;
end $$;
revoke all on function public.lock_identite_scolaire() from public, anon, authenticated;

-- ---------- 4. un pseudo pour tous, dans la règle ----------
-- les comptes sans ligne de profil en reçoivent une
insert into public.profiles (id, email, handle)
select u.id, coalesce(u.email, u.id::text || '@compte.folio.invalid'), null
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- puis chaque pseudo absent, hors règle ou en double (le plus ancien garde
-- le sien) est remplacé, une ligne après l'autre
do $$
declare r record;
begin
  for r in select p.id, p.name, p.handle from public.profiles p order by p.created_at, p.id loop
    if r.handle is null or public.pseudo_motif(lower(r.handle)) <> 'ok'
       or exists (select 1 from public.profiles q
                  where public.cle_pseudo(q.handle) = public.cle_pseudo(r.handle) and q.id <> r.id
                    and (q.created_at, q.id) < (select x.created_at, x.id from public.profiles x where x.id = r.id)) then
      update public.profiles set handle = public.pseudo_neuf(coalesce(nullif(r.name, ''), 'lecteur'), r.id) where id = r.id;
    elsif r.handle <> lower(r.handle) then
      update public.profiles set handle = lower(r.handle) where id = r.id;
    end if;
  end loop;
end $$;

drop index if exists public.profiles_handle_key;
create unique index if not exists profiles_pseudo_unique on public.profiles (public.cle_pseudo(handle));
alter table public.profiles alter column handle set not null;
alter table public.profiles drop constraint if exists profiles_pseudo_regle;
alter table public.profiles add constraint profiles_pseudo_regle check (public.pseudo_motif(handle) = 'ok');

-- chaque nouvelle ligne en reçoit un ; un changement passe la règle
create or replace function public.profiles_pseudo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.handle := lower(trim(new.handle));
  if tg_op = 'INSERT' then
    if new.handle is null or public.pseudo_motif(new.handle) <> 'ok' or public.pseudo_pris(new.handle, new.id) then
      new.handle := public.pseudo_neuf(coalesce(nullif(new.name, ''), 'lecteur'), new.id);
    end if;
  elsif new.handle is distinct from old.handle then
    if public.pseudo_motif(new.handle) <> 'ok' then
      raise exception 'Pseudo hors de la règle : %', public.pseudo_motif(new.handle) using errcode = '23514';
    end if;
    if public.pseudo_pris(new.handle, new.id) then
      raise exception 'Ce pseudo est déjà pris' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.profiles_pseudo() from public, anon, authenticated;
drop trigger if exists profiles_pseudo on public.profiles;
create trigger profiles_pseudo before insert or update of handle on public.profiles
  for each row execute function public.profiles_pseudo();

-- l'API brute ne touche plus au pseudo : ses colonnes, sauf celle-là
revoke insert, update on public.profiles from authenticated, anon;
revoke delete, truncate, references, trigger on public.profiles from anon;
grant insert (id, email, name, figure, teinte) on public.profiles to authenticated;
grant update (id, email, name, figure, teinte, updated_at) on public.profiles to authenticated;

-- ---------- 5. vérifier, changer ----------
-- ce que l'écran demande pendant la frappe : le verdict, et une variante
-- libre quand celui-ci est pris
create or replace function public.pseudo_libre(p text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare h text := ltrim(lower(trim(coalesce(p, ''))), '@'); m text; moi text;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  m := public.pseudo_motif(h);
  if m <> 'ok' then return jsonb_build_object('statut', m, 'pseudo', h); end if;
  select handle into moi from public.profiles where id = auth.uid();
  if moi = h then return jsonb_build_object('statut', 'meme', 'pseudo', h); end if;
  if public.pseudo_pris(h, auth.uid()) then
    return jsonb_build_object('statut', 'pris', 'pseudo', h, 'suggestion', public.pseudo_neuf(h, auth.uid()));
  end if;
  return jsonb_build_object('statut', 'ok', 'pseudo', h);
end $$;

-- la seule porte : la règle, la place libre, deux changements par semaine
create or replace function public.changer_pseudo(p text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v jsonb; h text; moi text; n integer; prochain timestamptz;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  v := public.pseudo_libre(p);
  if v->>'statut' <> 'ok' then return v; end if;
  h := v->>'pseudo';
  select count(*), min(x.cree_le) + interval '7 days' into n, prochain
  from (select j.cree_le from public.pseudo_journal j
        where j.user_id = auth.uid() and j.cree_le > now() - interval '7 days'
        order by j.cree_le desc limit 2) x;
  if n >= 2 then return jsonb_build_object('statut', 'trop', 'pseudo', h, 'jusqua', prochain); end if;
  select handle into moi from public.profiles where id = auth.uid() for update;
  if not found then
    insert into public.profiles (id, email, handle)
    select u.id, coalesce(u.email, u.id::text || '@compte.folio.invalid'), h from auth.users u where u.id = auth.uid();
  else
    update public.profiles set handle = h, updated_at = now() where id = auth.uid();
  end if;
  insert into public.pseudo_journal (user_id, ancien, nouveau) values (auth.uid(), moi, h);
  return jsonb_build_object('statut', 'ok', 'pseudo', h);
exception when unique_violation then
  return jsonb_build_object('statut', 'pris', 'pseudo', h);
end $$;
revoke all on function public.pseudo_libre(text), public.changer_pseudo(text) from public, anon;
grant execute on function public.pseudo_libre(text), public.changer_pseudo(text) to authenticated;

-- ---------- 6. trouver quelqu'un : au point et au tiret bas près ----------
create or replace function public.find_user(q text)
returns table (id uuid, handle text, name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, coalesce(nullif(p.name, ''), p.handle)
  from public.profiles p
  where public.cle_pseudo(p.handle) = public.cle_pseudo(trim(replace(q, '@', '')))
    and p.id <> auth.uid()
    and (public.my_org() is null
      or public.my_role() <> 'eleve'
      or public.same_class(p.id))
  limit 1
$$;

-- ---------- 7. le journal ne garde que ce qu'il faut ----------
-- 30 jours de réserve, 7 de compte : 60 jours suffisent, puis on efface
-- (les anciens pseudos d'un élève ne traînent pas, RGPD)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-pseudos-quotidienne') then
      perform cron.unschedule('purge-pseudos-quotidienne');
    end if;
    perform cron.schedule('purge-pseudos-quotidienne', '29 3 * * *',
      'delete from public.pseudo_journal where cree_le < now() - interval ''60 days'';');
  else
    raise notice 'pg_cron absent : effacer chaque jour le journal des pseudos de plus de 60 jours (supabase/REGLAGES.md)';
  end if;
end $$;
