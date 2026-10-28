-- ══════════ Folio devient Mirandola (2026-10-28) ══════════
-- Deux choses, sans rien changer à ce qui est rangé :
--
-- 1. Le montant d'un abonnement. L'écran Mirandola+ de l'app montre ce que
--    l'abonné paie (« 49,99 € par an ») : c'est le prix de SON abonnement,
--    dit par Stripe ou le magasin quand la ligne s'écrit (stripe-webhook,
--    magasins), pas le prix du jour — qui a pris une formule avant un
--    changement de prix garde le sien. En centimes, TVA comprise ; nul pour
--    un abonnement offert ou une ligne écrite avant cette migration (l'app
--    montre alors le prix de sa formule). mon_offre() le rend.
--
--    À appliquer AVANT de redéployer stripe-webhook et magasins : elles
--    écrivent cette colonne, qu'une base sans elle refuserait.
--
-- 2. Le nom. Les messages que la base renvoie à l'app (licence échue,
--    places prises, abonnement à résilier, l'auteur « Folio » d'un échange)
--    disent désormais Mirandola. Plutôt que de recopier ces fonctions —
--    au risque d'écraser une version plus récente —, chacune est réécrite
--    depuis sa propre définition actuelle (pg_get_functiondef), le mot seul
--    remplacé : signature, propriétaire et droits ne bougent pas (create or
--    replace les garde). Les valeurs rangées (`org_echanges.de = 'folio'`,
--    les clés) restent : elles sont en minuscules et ne se montrent pas.
--
-- 3. Les pseudos : « mirandola » est réservé, comme « folio » l'était (un
--    pseudo ne doit pas imiter l'équipe). pseudo_motif est recopiée de
--    20261027090000, les deux mots ajoutés ; src/pseudo.js a les mêmes listes,
--    mot pour mot (test/pseudo.test.js lit la dernière définition).

alter table public.abonnements add column if not exists montant integer;
alter table public.abonnements drop constraint if exists abonnements_montant_positif;
alter table public.abonnements add constraint abonnements_montant_positif check (montant is null or montant >= 0);
comment on column public.abonnements.montant is
  'Prix d''une période, en centimes TTC, dit par Stripe ou le magasin à l''écriture de la ligne ; nul si offert';

create or replace function public.mon_offre()
returns jsonb language sql stable security definer set search_path to '' as $$
  with etab as (
    select o.name, o.licence_fin
    from public.org_members m
    join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and (o.licence_fin is null or o.licence_fin >= current_date)
    limit 1
  ), ab as (
    select a.* from public.abonnements a where a.user_id = auth.uid()
    order by public.abonnement_ouvre(a.statut, a.fin_periode) desc, a.fin_periode desc nulls first, a.maj_le desc
    limit 1
  )
  select jsonb_build_object(
    'offre', public.offre_de(auth.uid()),
    'etablissement', (select name from etab),
    'licence_fin', (select licence_fin from etab),
    'abonnement', (select jsonb_build_object('statut', ab.statut, 'formule', ab.formule, 'source', ab.source,
                     'fin_periode', ab.fin_periode, 'fin_prevue', ab.fin_prevue, 'montant', ab.montant) from ab))
  where auth.uid() is not null
$$;
revoke all on function public.mon_offre() from public, anon;
grant execute on function public.mon_offre() to authenticated;

do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public' and p.prokind in ('f', 'p') and d.objid is null
      and p.prosrc like '%Folio%'
  loop
    def := pg_get_functiondef(f.oid);
    -- et le geste que nomme delete_me est désormais « Résilier l'abonnement » (écran Mirandola+)
    execute replace(replace(def, 'Folio', 'Mirandola'), 'Gérer mon abonnement', 'Résilier l''''abonnement');
  end loop;
end $$;

create or replace function public.pseudo_motif(h text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  reserves constant text[] := array['admin', 'administrateur', 'administratrice', 'administration', 'moderateur', 'moderatrice',
      'moderation', 'modo', 'folio', 'mirandola', 'support', 'staff', 'equipe', 'team', 'officiel',
      'officielle', 'official', 'system', 'systeme', 'root', 'anthropic', 'claude', 'prof',
      'professeur', 'professeure', 'referent', 'referente', 'editeur', 'proviseur', 'proviseure',
      'principal', 'principale', 'directeur', 'directrice', 'securite', 'security', 'aide', 'help',
      'contact', 'service', 'null', 'undefined', 'anonyme', 'inconnu', 'utilisateur', 'compte',
      'eleve', 'enseignant', 'enseignante', 'cpe', 'bot'];
  prefixes constant text[] := array['folio', 'mirandola', 'admin', 'moderat'];
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
revoke all on function public.pseudo_motif(text) from public, anon;
grant execute on function public.pseudo_motif(text) to authenticated;
