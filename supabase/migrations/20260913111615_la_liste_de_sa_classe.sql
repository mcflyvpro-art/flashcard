-- ══════════ la liste de sa classe ══════════
-- `cm_read` ne laisse un élève lire que sa propre inscription : il ne peut
-- pas lister ses camarades. C'était juste tant qu'il n'avait rien à en
-- faire — mais on lui demande maintenant d'ajouter les gens de sa classe,
-- et le faire en tapant un pseudo qu'il ne peut voir nulle part n'est pas
-- une fonctionnalité, c'est une devinette.
--
-- On ouvre donc la liste, et elle seule : prénom, pseudo, rien d'autre.
-- Pas d'adresse, pas de progression, pas de date d'inscription. Ce que
-- l'élève voit déjà en tournant la tête dans la salle.

create or replace function public.my_classmates()
returns table (id uuid, handle text, name text, lien text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, coalesce(nullif(cm.who, ''), nullif(p.name, ''), p.handle),
         coalesce((select f.status from public.friends f
                   where (f.user_id = auth.uid() and f.friend_id = p.id)
                      or (f.friend_id = auth.uid() and f.user_id = p.id)
                   limit 1), '')
  from public.class_members moi
  join public.class_members cm on cm.class_id = moi.class_id
  join public.profiles p on p.id = cm.user_id
  where moi.user_id = auth.uid()
    and cm.user_id <> auth.uid()
    and not public.blocked(p.id)
  order by 3
$$;

grant execute on function public.my_classmates() to authenticated;
