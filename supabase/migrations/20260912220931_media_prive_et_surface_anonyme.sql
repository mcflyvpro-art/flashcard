-- ══════════ ce qu'un visiteur non connecté peut appeler ══════════
-- « revoke from public » ne suffisait pas : Supabase accorde en plus le
-- droit directement au rôle anon, qui restait donc capable d'appeler
-- chaque fonction. Les retours étaient vides par accident — auth.uid()
-- vaut NULL et aucune comparaison ne réussit — mais se reposer sur la
-- sémantique du NULL n'est pas une politique de sécurité.
-- Seule shared_deck reste ouverte : un lien de partage doit s'ouvrir sans
-- compte, et il est protégé par son jeton de dix caractères.
revoke execute on function public.delete_me() from anon;
revoke execute on function public.find_user(text) from anon;
revoke execute on function public.my_friends() from anon;
revoke execute on function public.leaderboard(integer, uuid) from anon;
revoke execute on function public.join_group(text) from anon;
revoke execute on function public.in_group(uuid) from anon, public;
revoke execute on function public.is_friend(uuid) from anon, public;
revoke execute on function public.join_group(text) from public;

-- ══════════ les médias ne sont plus sur la voie publique ══════════
-- Le bucket était public : la photo d'un cours ou l'enregistrement de la
-- voix d'un élève se lisait sans compte, par simple URL, indéfiniment.
-- L'identifiant aléatoire du fichier n'est pas un contrôle d'accès.
update storage.buckets set public = false where id = 'media';

-- La lecture suit désormais la même règle que l'écriture : le dossier
-- porte l'identifiant du compte, et seul ce compte y accède. Les paquets
-- prêtés ou publiés ne voyagent qu'avec le texte de leurs cartes, jamais
-- avec leurs médias — personne d'autre n'a donc à les lire.
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
