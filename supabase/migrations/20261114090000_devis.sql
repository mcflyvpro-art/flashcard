-- Le devis : le chaînon qui manquait entre la démo et la licence.
--
-- Mirandola Campus se vend « sur devis » (le site le dit depuis le
-- 2026-11-05), mais rien dans l'app ne faisait un devis : l'éditeur passait
-- du prix convenu à la facture, sans pièce que l'établissement puisse
-- signer ni joindre à son bon de commande. Désormais :
--
--   1. l'éditeur émet un devis (admin_devis) : numéroté D-AAAA-0001 dans la
--      même suite sans trou que les factures, totaux calculés ici avec la
--      même règle (arrondi par ligne, TVA selon le régime du vendeur),
--      photographie du vendeur et du client, valable trente jours ;
--   2. le référent le lit dans sa Licence (licence_tableau rend `devis`,
--      devis(id) la pièce entière) et y répond en ligne
--      (ref_devis_repondre : « bon pour accord », son nom et sa fonction, le
--      numéro de son bon de commande) — ou l'éditeur note la réponse reçue
--      par courrier (admin_devis_statut) ;
--   3. un devis accepté se facture d'un geste (admin_devis_facturer) : la
--      facture reprend ses lignes et sa période, le bon de commande rejoint
--      les coordonnées de facturation, et la licence s'ouvre — places, fin,
--      prix convenu — sans rien retaper.
--
-- Un devis émis ne se modifie pas (déclencheur devis_fige) : seuls sa
-- réponse et sa facture bougent. Il n'est pas une pièce comptable : il part
-- avec l'établissement qu'on efface (un prospect sans compte ni facture).
--
-- Droits : la table se lit par le référent de l'établissement et l'éditeur
-- (RLS), ne s'écrit que par les fonctions. Rien pour anon.

-- ---------- 1. la série D ----------
alter table public.facture_compteurs drop constraint if exists facture_compteurs_serie_check;
alter table public.facture_compteurs add constraint facture_compteurs_serie_check check (serie in ('F', 'A', 'D'));

-- ---------- 2. la table ----------
create table if not exists public.devis (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  numero text not null unique,
  emis_le date not null default current_date,
  valable_jusqua date not null,
  periode_debut date,
  periode_fin date,
  places integer check (places is null or places between 1 and 100000),
  objet text not null default '',
  lignes jsonb not null,
  total_ht bigint not null,
  tva bigint not null,
  total_ttc bigint not null,
  taux_tva numeric(4, 2) not null,
  mention_tva text not null default '',
  vendeur jsonb not null,
  client jsonb not null,
  statut text not null default 'envoye' check (statut in ('envoye', 'accepte', 'refuse')),
  repondu_le timestamptz,
  repondu_par text not null default '' check (length(repondu_par) <= 120),
  engagement text not null default '' check (length(engagement) <= 60),
  facture_id uuid references public.factures(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint devis_totaux check (total_ttc = total_ht + tva),
  constraint devis_validite check (valable_jusqua >= emis_le)
);
create index if not exists devis_org on public.devis (org_id, emis_le desc);
create index if not exists devis_facture on public.devis (facture_id) where facture_id is not null;
alter table public.devis enable row level security;
revoke all on public.devis from anon, authenticated;
grant select on public.devis to authenticated;
drop policy if exists devis_lecture on public.devis;
create policy devis_lecture on public.devis for select to authenticated
  using ((org_id = (select public.my_org()) and (select public.is_ref())) or (select public.is_admin()));

/* Ce qu'un devis dit ne change plus : on en émet un autre. Seuls bougent sa
   réponse (statut, date, signataire, bon de commande) et sa facture. */
create or replace function public.devis_fige()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'statut' - 'repondu_le' - 'repondu_par' - 'engagement' - 'facture_id')
     is distinct from (to_jsonb(old) - 'statut' - 'repondu_le' - 'repondu_par' - 'engagement' - 'facture_id') then
    raise exception 'Un devis émis ne se modifie pas : on en émet un autre';
  end if;
  return new;
end $$;
revoke all on function public.devis_fige() from public, anon, authenticated;
drop trigger if exists devis_fige on public.devis;
create trigger devis_fige before update on public.devis
  for each row execute function public.devis_fige();

-- ---------- 3. les lignes d'une pièce, lues une fois ----------
/* La même lecture que admin_facturer : un libellé, une quantité, un prix
   unitaire hors taxe en centimes ; arrondi au centime par ligne. */
create or replace function public.piece_lignes(lignes jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare l jsonb; lib text; q numeric; pu bigint; t bigint; ht bigint := 0; propres jsonb := '[]'::jsonb;
begin
  if lignes is null or jsonb_typeof(lignes) <> 'array' or jsonb_array_length(lignes) not between 1 and 20 then
    raise exception 'Une à vingt lignes';
  end if;
  for l in select e.value from jsonb_array_elements(lignes) e loop
    lib := trim(coalesce(l->>'libelle', ''));
    q := nullif(l->>'quantite', '')::numeric;
    pu := nullif(l->>'prix_ht', '')::bigint;
    if lib = '' or length(lib) > 200 or q is null or q <= 0 or q > 100000 or pu is null or pu < 0 or pu > 100000000 then
      raise exception 'Ligne illisible : un libellé, une quantité, un prix';
    end if;
    t := round(q * pu)::bigint;
    ht := ht + t;
    propres := propres || jsonb_build_array(jsonb_build_object('libelle', lib, 'quantite', q, 'prix_ht', pu, 'total_ht', t));
  end loop;
  return jsonb_build_object('lignes', propres, 'ht', ht);
end $$;
revoke all on function public.piece_lignes(jsonb) from public, anon, authenticated;

-- ---------- 4. émettre un devis ----------
create or replace function public.admin_devis(org uuid, lignes jsonb, valable integer default 30, debut date default null,
  fin date default null, objet text default '', places integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.vendeur%rowtype; f public.org_facturation%rowtype; x public.orgs%rowtype; p jsonb; ht bigint;
        taux numeric := 0; tva bigint := 0; mention text := ''; num text; did uuid; c jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  select * into x from public.orgs where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
  select * into v from public.vendeur where id;
  if not found or v.raison_sociale = '' or v.adresse = '' or v.siret = '' then
    raise exception 'Remplis d''abord ton entreprise : raison sociale, adresse, SIRET';
  end if;
  if valable is null or valable not between 1 and 365 then raise exception 'Une validité de 1 à 365 jours'; end if;
  if debut is not null and fin is not null and fin < debut then raise exception 'La période finit avant de commencer'; end if;
  if places is not null and places not between 1 and 100000 then raise exception 'Nombre de places impossible'; end if;
  p := public.piece_lignes(lignes);
  ht := (p->>'ht')::bigint;
  if ht <= 0 then raise exception 'Un devis de zéro euro ne s''émet pas'; end if;
  if v.regime_tva = 'normal' then
    taux := v.taux_tva; tva := round(ht * taux / 100)::bigint;
  else
    mention := 'TVA non applicable, art. 293 B du CGI';
  end if;
  -- le client : ses coordonnées de facturation s'il les a données, sinon le nom de l'établissement
  select * into f from public.org_facturation where org_id = org;
  c := case when f.org_id is null then '{}'::jsonb else to_jsonb(f) - 'org_id' - 'maj' end;
  if coalesce(c->>'nom', '') = '' then c := c || jsonb_build_object('nom', x.name); end if;
  if coalesce(c->>'ville', '') = '' then c := c || jsonb_build_object('ville', coalesce(x.ville, '')); end if;
  c := c || jsonb_build_object('uai', x.uai);
  num := public.numero_suivant('D');
  insert into public.devis (org_id, numero, emis_le, valable_jusqua, periode_debut, periode_fin, places, objet, lignes,
                            total_ht, tva, total_ttc, taux_tva, mention_tva, vendeur, client)
  values (org, num, current_date, current_date + valable, debut, fin, places, left(trim(coalesce(objet, '')), 200), p->'lignes',
          ht, tva, ht + tva, taux, mention, to_jsonb(v) - 'id' - 'maj', c)
  returning id into did;
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (org, auth.uid(), null, 'devis émis', jsonb_build_object('numero', num));
  return jsonb_build_object('id', did, 'numero', num);
end $$;
revoke all on function public.admin_devis(uuid, jsonb, integer, date, date, text, integer) from public, anon;
grant execute on function public.admin_devis(uuid, jsonb, integer, date, date, text, integer) to authenticated;

-- ---------- 5. lire un devis ----------
create or replace function public.devis(did uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare k public.devis%rowtype;
begin
  select * into k from public.devis where id = did;
  if not found then raise exception 'Devis inconnu'; end if;
  perform public.licence_org(k.org_id);
  return to_jsonb(k) || jsonb_build_object('genre', 'devis',
    'facture_numero', (select f.numero from public.factures f where f.id = k.facture_id));
end $$;
revoke all on function public.devis(uuid) from public, anon;
grant execute on function public.devis(uuid) to authenticated;

-- ---------- 6. la réponse du référent ----------
/* « Bon pour accord » en ligne : son nom et sa fonction, et le numéro du
   bon de commande s'il en a un. Un mot part dans le fil des échanges : c'est
   lui qui prévient l'éditeur (la pastille « message » de sa liste). */
create or replace function public.ref_devis_repondre(did uuid, accepte boolean, nom text default '', engagement text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.devis%rowtype; qui text := left(trim(coalesce(nom, '')), 120); bc text := left(trim(coalesce(engagement, '')), 60);
begin
  select * into k from public.devis where id = did;
  if not found or not public.is_ref() or public.my_org() is distinct from k.org_id then
    raise exception 'Devis inconnu';
  end if;
  if k.statut <> 'envoye' then raise exception 'Ce devis a déjà sa réponse'; end if;
  if k.valable_jusqua < current_date then raise exception 'Ce devis n''est plus valable : demande-en un nouveau'; end if;
  if accepte is null then raise exception 'Accepter ou refuser'; end if;
  if accepte and length(qui) < 3 then raise exception 'Indique ton nom et ta fonction'; end if;
  update public.devis set statut = case when accepte then 'accepte' else 'refuse' end, repondu_le = now(),
    repondu_par = qui, engagement = case when accepte then bc else '' end
  where id = did;
  insert into public.org_echanges (org_id, de, auteur, sujet, message)
  values (k.org_id, 'etab', auth.uid(), 'question',
    case when accepte then 'Devis ' || k.numero || ' accepté par ' || qui
      || case when bc <> '' then ' (bon de commande ' || bc || ')' else '' end || '.'
    else 'Devis ' || k.numero || ' refusé.' end);
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (k.org_id, auth.uid(), null, case when accepte then 'devis accepté' else 'devis refusé' end,
    jsonb_build_object('numero', k.numero));
  return jsonb_build_object('statut', case when accepte then 'accepte' else 'refuse' end);
end $$;
revoke all on function public.ref_devis_repondre(uuid, boolean, text, text) from public, anon;
grant execute on function public.ref_devis_repondre(uuid, boolean, text, text) to authenticated;

-- ---------- 7. la réponse notée par l'éditeur ----------
/* Un devis signé arrive souvent par courrier ou avec un bon de commande :
   l'éditeur le note. Il corrige aussi une réponse notée à tort, tant que le
   devis n'est pas facturé. */
create or replace function public.admin_devis_statut(did uuid, statut text, nom text default '', engagement text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare k public.devis%rowtype;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  select * into k from public.devis where id = did;
  if not found then raise exception 'Devis inconnu'; end if;
  if statut is null or statut not in ('envoye', 'accepte', 'refuse') then raise exception 'Statut inconnu'; end if;
  if k.facture_id is not null then raise exception 'Ce devis est facturé : sa réponse ne change plus'; end if;
  update public.devis d set statut = admin_devis_statut.statut,
    repondu_le = case when admin_devis_statut.statut = 'envoye' then null else now() end,
    repondu_par = case when admin_devis_statut.statut = 'envoye' then '' else left(trim(coalesce(nom, '')), 120) end,
    engagement = case when admin_devis_statut.statut = 'accepte' then left(trim(coalesce(admin_devis_statut.engagement, '')), 60) else '' end
  where d.id = did;
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (k.org_id, auth.uid(), null, 'devis : ' || statut, jsonb_build_object('numero', k.numero));
end $$;
revoke all on function public.admin_devis_statut(uuid, text, text, text) from public, anon;
grant execute on function public.admin_devis_statut(uuid, text, text, text) to authenticated;

-- ---------- 8. du devis accepté à la facture, et à la licence ----------
/* La facture reprend les lignes, la période et l'objet du devis ; le bon de
   commande donné à l'acceptation rejoint les coordonnées de facturation (la
   facture le photographie, Chorus Pro le demande). Avec `licence`, et si le
   devis dit ses places et sa fin, la licence s'ouvre du même geste et le
   prix convenu devient celui du devis. Tout dans une transaction : une
   facture refusée (coordonnées manquantes) ne change rien. */
create or replace function public.admin_devis_facturer(did uuid, licence boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.devis%rowtype; r jsonb; l jsonb; ouverte boolean := false;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  select * into k from public.devis where id = did for update;
  if not found then raise exception 'Devis inconnu'; end if;
  if k.facture_id is not null then raise exception 'Ce devis est déjà facturé'; end if;
  if k.statut <> 'accepte' then raise exception 'Le devis doit d''abord être accepté'; end if;
  if k.engagement <> '' then
    update public.org_facturation set engagement = k.engagement, maj = now() where org_id = k.org_id;
  end if;
  select jsonb_agg(e.value - 'total_ht') into l from jsonb_array_elements(k.lignes) e;
  r := public.admin_facturer(k.org_id, l, k.periode_debut, k.periode_fin,
    left(trim(k.objet || ' (devis ' || k.numero || ')'), 200));
  update public.devis set facture_id = (r->>'id')::uuid where id = did;
  if coalesce(licence, true) and k.places is not null and k.periode_fin is not null then
    perform public.admin_licence(k.org_id, k.places, k.periode_fin, 'etablissement');
    update public.org_suivi set prix_euros = round(k.total_ht / 100.0)::integer, maj = now() where org_id = k.org_id;
    ouverte := true;
  end if;
  return r || jsonb_build_object('licence', ouverte);
end $$;
revoke all on function public.admin_devis_facturer(uuid, boolean) from public, anon;
grant execute on function public.admin_devis_facturer(uuid, boolean) to authenticated;

-- ---------- 9. le tableau de la licence rend aussi les devis ----------
/* La définition du moment, plus une clé : `devis` (sans leurs lignes ni
   leurs photographies ; devis(id) les rend). Une app d'avant l'ignore. */
create or replace function public.licence_tableau(org uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o uuid := public.licence_org(org); x public.orgs%rowtype; f public.org_facturation%rowtype;
        v public.vendeur%rowtype; prix integer;
begin
  select * into x from public.orgs where id = o;
  select * into f from public.org_facturation where org_id = o;
  select * into v from public.vendeur where id;
  select s.prix_euros into prix from public.org_suivi s where s.org_id = o;
  return jsonb_build_object(
    'org', x.name, 'offre', x.offre, 'places', x.places, 'licence_fin', x.licence_fin,
    'eleves', public.etab_eleves(o), 'prises', public.etab_places_prises(o),
    'profs', (select count(*) from public.org_members m join public.user_roles r on r.user_id = m.user_id
              where m.org_id = o and r.role = 'prof'),
    'prix', prix,
    'facturation', case when f.org_id is null then null else to_jsonb(f) - 'org_id' end,
    'factures', coalesce((select jsonb_agg(to_jsonb(k) - 'vendeur' - 'client' - 'lignes' order by k.emise_le desc, k.numero desc)
                          from public.factures k where k.org_id = o), '[]'::jsonb),
    'devis', coalesce((select jsonb_agg((to_jsonb(d) - 'vendeur' - 'client' - 'lignes')
                            || jsonb_build_object('facture_numero', (select k.numero from public.factures k where k.id = d.facture_id))
                          order by d.emis_le desc, d.numero desc)
                       from public.devis d where d.org_id = o), '[]'::jsonb),
    'echanges', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'de', e.de, 'sujet', e.sujet, 'message', e.message,
                            'cree', e.created_at, 'lu', e.lu_le,
                            'auteur', case when e.de = 'folio' then 'Mirandola' else coalesce(p.name, '') end) order by e.created_at, e.id)
                          from public.org_echanges e left join public.profiles p on p.id = e.auteur where e.org_id = o), '[]'::jsonb),
    'vendeur', case when v.id is null then null else
      jsonb_build_object('raison_sociale', v.raison_sociale, 'forme', v.forme, 'adresse', v.adresse,
        'code_postal', v.code_postal, 'ville', v.ville, 'siret', v.siret, 'email', v.email, 'regime_tva', v.regime_tva) end);
end $$;
revoke all on function public.licence_tableau(uuid) from public, anon;
grant execute on function public.licence_tableau(uuid) to authenticated;
