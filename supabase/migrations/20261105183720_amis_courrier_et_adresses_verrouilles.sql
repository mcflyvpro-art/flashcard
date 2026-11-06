-- Amis, courrier et adresses : trois portes que l'API brute laissait
-- ouvertes (session de débogage du 2026-11-05, chaque trou prouvé sur la
-- vraie base, en transaction annulée, avant d'écrire ceci ; les cas sont
-- rejoués par supabase/tests/amis_courrier.sql).
--
-- 1. Une amitié forcée. `friends_ask` ne regardait pas le statut : un
--    compte pouvait écrire (lui, un élève, 'ok') sans que l'élève ait rien
--    accepté — et, devenu « ami », lire ses chiffres (`profil_lecteur` :
--    série, pages, heures de travail, matières) et lui écrire. Et
--    `friends_accept` laissait celui qui reçoit une demande en réécrire
--    les deux bouts : (A, moi) devenait (C, moi, 'ok'), une amitié que C
--    n'avait jamais demandée. Désormais une demande naît « pending », et
--    seul celui qui la reçoit la passe à « ok » — rien d'autre ne bouge
--    (droit d'écriture sur la seule colonne `status`). L'app n'écrit pas
--    autrement (askFriend, answerFriend).
--
-- 2. Du courrier de n'importe qui, signé n'importe comment. On pouvait
--    écrire à tout compte (seul un blocage l'arrêtait), avec un
--    `from_name` choisi — « Ton professeur » — et un message sans limite.
--    L'app, elle, n'écrit qu'à un ami accepté (prêter un livre) ou, pour
--    un professeur, à un élève de ses classes (un mot, sendMotProf) : c'est
--    maintenant la règle. Le nom de l'expéditeur est celui de son profil,
--    posé par la base ; la date aussi ; et le destinataire ne change plus
--    que `read_at` et `added_at`. Les fonctions de la base qui écrivent un
--    mot (prof_message_classe, prof_relance, prof_refuser) gardent le leur.
--    Des longueurs bornées, largement au-dessus de l'usage (le plus long
--    message à ce jour : 43 signes ; le plus gros livre : 494 pages).
--
-- 3. L'adresse e-mail des autres. `profiles_read` rendait la ligne entière
--    — e-mail compris — de quiconque avait une ligne d'amitié avec soi,
--    même une demande qu'on venait d'envoyer soi-même, et de tous les
--    membres d'un club où l'on était entré : trouver le pseudo d'un élève,
--    lui envoyer une demande, lire son adresse. L'app ne lit jamais la
--    ligne d'un autre (my_friends, club_membres, visuels… passent par des
--    fonctions qui ne rendent pas d'adresse) : chacun ne lit plus que la
--    sienne. Retirer la seule colonne `email` aurait été plus fin, mais
--    l'upsert de profil de l'app (resolution=merge-duplicates) a besoin de
--    la lire : essayé, refusé en 42501.
--
-- 4. Un partage sur le livre d'un autre. `shares_own` vérifiait le
--    propriétaire de la ligne, pas celui du livre : qui connaissait
--    l'identifiant d'un livre pouvait s'en faire un code et le lire par
--    `shared_deck`. Un code se crée désormais sur ses propres livres.

-- ═══ 1. amis ═══
drop policy if exists friends_ask on public.friends;
create policy friends_ask on public.friends for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and friend_id <> (select auth.uid())
    and not public.blocked(friend_id)
    and (public.my_org() is null or public.my_role() <> 'eleve' or public.same_class(friend_id))
  );

drop policy if exists friends_accept on public.friends;
create policy friends_accept on public.friends for update to authenticated
  using (friend_id = (select auth.uid()))
  with check (friend_id = (select auth.uid()) and status = 'ok');

revoke update on public.friends from authenticated, anon;
grant update (status) on public.friends to authenticated;

-- ═══ 2. courrier ═══
drop policy if exists "mail sender inserts as self" on public.mail;
create policy "mail sender inserts as self" on public.mail for insert to authenticated
  with check (
    from_user = (select auth.uid())
    and not public.blocked(to_user)
    and (public.is_friend(to_user)
         or exists (select 1 from public.class_members cm
                    where cm.user_id = to_user and public.class_staff(cm.class_id)))
  );

revoke update on public.mail from authenticated, anon;
grant update (read_at, added_at) on public.mail to authenticated;

-- Le nom et la date d'une lettre écrite par l'API : ceux de la base. Une
-- fonction de déclencheur SECURITY INVOKER : `current_user` y vaut
-- 'authenticated' pour une écriture de l'app, le propriétaire pour une
-- fonction de la base (qui garde alors le nom qu'elle a choisi).
create or replace function public.courrier_signe() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.from_name := left(coalesce(
      (select coalesce(nullif(trim(p.name), ''), p.handle) from public.profiles p where p.id = new.from_user),
      'Lecteur'), 120);
    new.created_at := now();
    new.read_at := null;
    new.added_at := null;
  end if;
  return new;
end $$;
revoke all on function public.courrier_signe() from public, anon, authenticated;

drop trigger if exists courrier_signe on public.mail;
create trigger courrier_signe before insert on public.mail
  for each row execute function public.courrier_signe();

alter table public.mail drop constraint if exists mail_message_len;
alter table public.mail add constraint mail_message_len check (char_length(message) <= 2000) not valid;
alter table public.mail validate constraint mail_message_len;
alter table public.mail drop constraint if exists mail_deck_name_len;
alter table public.mail add constraint mail_deck_name_len check (char_length(deck_name) <= 200) not valid;
alter table public.mail validate constraint mail_deck_name_len;
alter table public.mail drop constraint if exists mail_from_name_len;
alter table public.mail add constraint mail_from_name_len check (char_length(from_name) <= 120) not valid;
alter table public.mail validate constraint mail_from_name_len;
alter table public.mail drop constraint if exists mail_cards_taille;
alter table public.mail add constraint mail_cards_taille check (
  cards is null or (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) <= 5000
                    and octet_length(cards::text) <= 4000000)) not valid;
alter table public.mail validate constraint mail_cards_taille;

-- ═══ 3. adresses ═══
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- ═══ 4. partages ═══
drop policy if exists shares_own on public.shares;
create policy shares_own on public.shares for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid()))
  );
