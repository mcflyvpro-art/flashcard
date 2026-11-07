-- L'éditeur offre Mirandola Infini (2026-11-07, demandé : « dans l'éditeur je
-- veux pouvoir offrir Mirandola Infini »). admin_offrir_plus gagne un niveau :
-- « plus » (d'office, comme avant) ou « infini ». La ligne offerte reste UNE
-- (clé (user_id, source) : la source « offert ») ; Infini s'y lit à sa formule
-- « infini_annuel », la seule chose que regardent abonnement_courant et
-- niveau_de — rien d'autre ne bouge, ni le quota d'IA (ia_droits lit le
-- niveau), ni les médias, ni mon_offre. Offrir Mirandola+ à qui avait Infini
-- offert le ramène à Mirandola+ ; « Reprendre » finit la ligne, quel que soit
-- son niveau.
--
-- La version à trois arguments part : gardée à côté, PostgREST ne saurait
-- laquelle appeler (PGRST203) pour une app d'avant qui envoie cible, jusqua
-- et retirer ; la nouvelle, avec son niveau par défaut, lui répond pareil.

drop function if exists public.admin_offrir_plus(uuid, timestamptz, boolean);

create function public.admin_offrir_plus(cible uuid, jusqua timestamptz default null,
                                         retirer boolean default false, niveau text default 'plus')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = cible) then raise exception 'Compte inconnu' using errcode = '22023'; end if;
  if jusqua is not null and jusqua <= now() and not retirer then raise exception 'Date passée' using errcode = '22023'; end if;
  if coalesce(niveau, '') not in ('plus', 'infini') then raise exception 'Niveau inconnu' using errcode = '22023'; end if;
  insert into public.abonnements as a (user_id, offre, statut, source, formule, fin_periode, maj_le)
  values (cible, 'plus', case when retirer then 'fini' else 'actif' end, 'offert',
          case when niveau = 'infini' then 'infini_annuel' end,
          case when retirer then now() else jusqua end, now())
  on conflict (user_id, source) do update
    set statut = excluded.statut, fin_periode = excluded.fin_periode, fin_prevue = false, maj_le = now(),
        formule = case when retirer then a.formule else excluded.formule end;
  return jsonb_build_object('offre', public.offre_de(cible), 'niveau', public.niveau_de(cible));
end $$;

revoke all on function public.admin_offrir_plus(uuid, timestamptz, boolean, text) from public, anon;
grant execute on function public.admin_offrir_plus(uuid, timestamptz, boolean, text) to authenticated;
