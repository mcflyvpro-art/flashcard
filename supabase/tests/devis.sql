-- Tests de 20261114090000 : le devis. L'éditeur l'émet (totaux, numéro,
-- photographie), le référent le lit et y répond en ligne, un devis accepté
-- se facture d'un geste et ouvre la licence ; ce que personne ne fait à la
-- main ; qui lit quoi. Même mode que licence.sql : transaction ANNULÉE,
-- comptes jetables, vrais rôles `authenticated` et `anon`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated, anon;
grant all on sequence public.zz_res_n_seq to authenticated, anon;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
create function public.zz_leve(q text) returns text language plpgsql as $$
begin execute q; return null; exception when others then return sqlerrm; end $$;
grant execute on function public.zz_comme(uuid), public.zz_anon(), public.zz_root(), public.zz_leve(text) to authenticated, anon;

do $$
declare
  adm uuid := gen_random_uuid(); dir uuid := gen_random_uuid(); autre uuid := gen_random_uuid();
  eleve uuid := gen_random_uuid(); u record;
  j jsonb; o uuid; o2 uuid; o3 uuid; s text; n integer; ce text;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid; n1 text; n2 text; fid uuid;
begin
  for u in select * from (values
      (adm, 'zzadmin', 'admin'), (dir, 'zzdir', null), (autre, 'zzautre', null), (eleve, 'zzeleve', null)) x(id, pseudo, role) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    if u.role is not null then
      insert into public.user_roles (user_id, role) values (u.id, u.role)
      on conflict (user_id) do update set role = excluded.role;
    end if;
  end loop;

  -- ══════════ le décor : deux établissements en démo, chacun son référent, un prospect ══════════
  perform public.zz_comme(adm);
  o := public.admin_etab_enregistrer(null, '{"nom":"ZZ Lycée Camus","ville":"Nîmes","uai":"0301234A"}'::jsonb);
  o2 := public.admin_etab_enregistrer(null, '{"nom":"ZZ Collège Hugo","ville":"Lyon"}'::jsonb);
  o3 := public.admin_etab_enregistrer(null, '{"nom":"ZZ École Ferry","ville":"Arles"}'::jsonb);
  j := public.admin_lancer_demo(o, 30, 30, true);
  perform public.zz_comme(dir); perform public.rejoindre(j->>'code_ref', 'Marie', 'Curie');
  perform public.zz_comme(adm);
  j := public.admin_lancer_demo(o2, 30, 30, false);
  perform public.zz_comme(autre); perform public.rejoindre(j->>'code_ref', 'Victor', 'Hugo');
  perform public.zz_root();
  select k.eleve into ce from public.org_codes k where k.org_id = o;
  perform public.zz_comme(eleve); perform public.rejoindre(ce, 'Emma', 'Durand',
    (select c.id from public.classes c where c.org_id = o and c.genre = 'classe' order by c.name limit 1));

  -- ══════════ émettre ══════════
  perform public.zz_root();
  delete from public.vendeur;
  perform public.zz_comme(adm);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[{"libelle":"Licence","quantite":1,"prix_ht":90000}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('sans entreprise enregistrée, pas de devis', s like '%ton entreprise%', s);
  perform public.admin_vendeur_enregistrer('{"raison_sociale":"ZZ Mirandola","forme":"EI","adresse":"1 rue des Essais","code_postal":"75001",
    "ville":"Paris","siret":"73282932000074","regime_tva":"franchise","delai_jours":"30","email":"zz@exemple.invalid"}'::jsonb);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('un devis sans ligne ne s''émet pas', s like '%Une à vingt lignes%', s);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[{"libelle":"","quantite":1,"prix_ht":100}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('une ligne sans libellé est refusée', s like '%Ligne illisible%', s);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[{"libelle":"Rien","quantite":1,"prix_ht":0}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('un devis de zéro euro ne s''émet pas', s like '%zéro euro%', s);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[{"libelle":"L","quantite":1,"prix_ht":100}]''::jsonb, 0)');
  insert into public.zz_res (nom, ok, vu) values ('une validité de zéro jour est refusée', s like '%validité%', s);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[{"libelle":"L","quantite":1,"prix_ht":100}]''::jsonb, 30, ''2027-08-31'', ''2026-09-01'')');
  insert into public.zz_res (nom, ok, vu) values ('une période à l''envers est refusée', s like '%période%', s);

  j := public.admin_devis(o, '[{"libelle":"Licence Mirandola Campus, 300 places","quantite":300,"prix_ht":350},
    {"libelle":"Formation des professeurs","quantite":1.5,"prix_ht":10001}]'::jsonb, 30, '2026-09-01', '2027-08-31', 'Licence annuelle', 300);
  d1 := (j->>'id')::uuid; n1 := j->>'numero';
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'le devis : numéro D-AAAA-NNNN, totaux arrondis par ligne, franchise de TVA, valable 30 jours, envoyé',
    n1 ~ '^D-\d{4}-\d{4}$' and d.total_ht = 105000 + 15002 and d.tva = 0 and d.total_ttc = d.total_ht
    and d.mention_tva like '%293 B%' and d.valable_jusqua = current_date + 30 and d.statut = 'envoye' and d.places = 300,
    n1 || ' ' || d.total_ht || ' ' || d.valable_jusqua from public.devis d where d.id = d1;
  insert into public.zz_res (nom, ok, vu)
  select 'il photographie le vendeur et le client : sans coordonnées de facturation, le nom et la ville de l''établissement',
    d.vendeur->>'raison_sociale' = 'ZZ Mirandola' and d.vendeur->>'siret' = '73282932000074'
    and d.client->>'nom' = 'ZZ Lycée Camus' and d.client->>'ville' = 'Nîmes' and d.client->>'uai' = '0301234A',
    d.client::text from public.devis d where d.id = d1;
  perform public.zz_comme(adm);
  j := public.admin_devis(o3, '[{"libelle":"Licence","quantite":1,"prix_ht":50000}]'::jsonb);
  d4 := (j->>'id')::uuid; n2 := j->>'numero';
  insert into public.zz_res (nom, ok, vu) values ('la numérotation suit, sans trou, même après des refus',
    right(n2, 4)::int = right(n1, 4)::int + 1, n1 || ' puis ' || n2);
  -- un régime normal : la TVA sur le total
  perform public.admin_vendeur_enregistrer('{"raison_sociale":"ZZ Mirandola","forme":"SASU","adresse":"1 rue des Essais","code_postal":"75001",
    "ville":"Paris","siret":"73282932000074","regime_tva":"normal","taux_tva":"20","delai_jours":"30"}'::jsonb);
  j := public.admin_devis(o2, '[{"libelle":"Licence","quantite":3,"prix_ht":3333}]'::jsonb, 15);
  d3 := (j->>'id')::uuid;
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'assujetti : TVA de 20 % sur le total hors taxe, validité choisie', d.total_ht = 9999 and d.tva = 2000 and d.total_ttc = 11999
    and d.mention_tva = '' and d.valable_jusqua = current_date + 15, d.total_ht || ' ' || d.tva from public.devis d where d.id = d3;
  insert into public.zz_res (nom, ok, vu)
  select 'le devis d''avant garde ce qu''il disait du vendeur', d.vendeur->>'forme' = 'EI' and d.tva = 0, d.vendeur->>'forme'
  from public.devis d where d.id = d1;

  -- ══════════ figé, et rien à la main ══════════
  s := public.zz_leve('update public.devis set total_ht = 1, total_ttc = 1 where id = ''' || d1 || '''');
  insert into public.zz_res (nom, ok, vu) values ('un devis émis ne se modifie pas, même en base', s like '%ne se modifie pas%', s);
  perform public.zz_comme(dir);
  s := public.zz_leve('update public.devis set statut = ''accepte'' where id = ''' || d1 || '''');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le référent n''écrit pas la table à la main',
    (s like '%permission denied%' or s is null) and (select statut from public.devis where id = d1) = 'envoye', coalesce(s, 'aucune ligne touchée'));
  perform public.zz_comme(dir);
  s := public.zz_leve('insert into public.devis (org_id, numero, valable_jusqua, lignes, total_ht, tva, total_ttc, taux_tva, vendeur, client)
    values (''' || o || ''', ''D-0000-0000'', current_date, ''[]'', 0, 0, 0, 0, ''{}'', ''{}'')');
  insert into public.zz_res (nom, ok, vu) values ('ni n''en insère un', s like '%permission denied%' or s like '%row-level security%', s);
  s := public.zz_leve('select public.admin_devis(''' || o || ''', ''[{"libelle":"L","quantite":1,"prix_ht":100}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('ni n''en émet : réservé à l''éditeur', s like '%Réservé à l''éditeur%', s);

  -- ══════════ qui lit quoi ══════════
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('le référent voit son devis dans le tableau de sa licence, sans ses lignes',
    jsonb_array_length(j->'devis') = 1 and j->'devis'->0->>'numero' = n1 and (j->'devis'->0->>'total_ttc')::bigint = 120002
    and not (j->'devis'->0 ? 'lignes') and not (j->'devis'->0 ? 'vendeur'), (j->'devis')::text);
  j := public.devis(d1);
  insert into public.zz_res (nom, ok, vu) values ('et la pièce entière : deux lignes, leurs totaux, le genre',
    jsonb_array_length(j->'lignes') = 2 and (j->'lignes'->1->>'total_ht')::bigint = 15002 and j->>'genre' = 'devis', (j->'lignes')::text);
  select count(*) into n from public.devis;
  insert into public.zz_res (nom, ok, vu) values ('par l''API brute il ne lit que les siens', n = 1, n::text);
  s := public.zz_leve('select public.devis(''' || d3 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('pas celui d''un autre établissement', s is not null, s);
  perform public.zz_comme(eleve);
  select count(*) into n from public.devis;
  s := public.zz_leve('select public.devis(''' || d1 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('un élève de l''établissement ne lit aucun devis', n = 0 and s is not null, n || ' ' || coalesce(s, ''));
  s := public.zz_leve('select public.ref_devis_repondre(''' || d1 || ''', true, ''Emma Durand, élève'')');
  insert into public.zz_res (nom, ok, vu) values ('et n''y répond pas', s like '%Devis inconnu%', s);

  -- ══════════ la réponse du référent ══════════
  perform public.zz_comme(autre);
  s := public.zz_leve('select public.ref_devis_repondre(''' || d1 || ''', true, ''Victor Hugo, principal'')');
  insert into public.zz_res (nom, ok, vu) values ('le référent d''un autre établissement ne répond pas à ce devis', s like '%Devis inconnu%', s);
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.ref_devis_repondre(''' || d1 || ''', true, ''  '')');
  insert into public.zz_res (nom, ok, vu) values ('accepter demande un nom et une fonction', s like '%ton nom et ta fonction%', s);
  j := public.ref_devis_repondre(d1, true, 'Marie Curie, proviseure', 'BC-2026-042');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'accepté en ligne : la date, le signataire, le bon de commande', j->>'statut' = 'accepte' and d.statut = 'accepte'
    and d.repondu_le is not null and d.repondu_par = 'Marie Curie, proviseure' and d.engagement = 'BC-2026-042', d.repondu_par
  from public.devis d where d.id = d1;
  insert into public.zz_res (nom, ok, vu)
  select 'un mot prévient l''éditeur dans le fil des échanges', count(*) = 1 and max(e.message) like '%' || n1 || '%accepté par Marie Curie%BC-2026-042%',
    max(e.message) from public.org_echanges e where e.org_id = o and e.de = 'etab';
  insert into public.zz_res (nom, ok, vu)
  select 'et l''historique du référent le garde', count(*) = 1, count(*)::text from public.ref_audit a where a.org_id = o and a.acte = 'devis accepté';
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.ref_devis_repondre(''' || d1 || ''', false)');
  insert into public.zz_res (nom, ok, vu) values ('une réponse donnée ne se redonne pas', s like '%déjà sa réponse%', s);
  -- un devis périmé
  perform public.zz_root();
  alter table public.devis disable trigger devis_fige;
  update public.devis set emis_le = current_date - 40, valable_jusqua = current_date - 10 where id = d3;
  alter table public.devis enable trigger devis_fige;
  perform public.zz_comme(autre);
  s := public.zz_leve('select public.ref_devis_repondre(''' || d3 || ''', true, ''Victor Hugo, principal'')');
  insert into public.zz_res (nom, ok, vu) values ('un devis périmé ne s''accepte plus en ligne', s like '%plus valable%', s);

  -- ══════════ la réponse notée par l'éditeur ══════════
  perform public.zz_comme(adm);
  perform public.admin_devis_statut(d3, 'accepte', 'Victor Hugo, principal', 'BC-7');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'l''éditeur note un accord reçu par courrier, même après la date', d.statut = 'accepte' and d.engagement = 'BC-7', d.statut
  from public.devis d where d.id = d3;
  perform public.zz_comme(adm);
  perform public.admin_devis_statut(d3, 'envoye');
  perform public.admin_devis_statut(d4, 'refuse');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'il corrige une réponse notée à tort, et note un refus', (select statut = 'envoye' and repondu_le is null and engagement = '' from public.devis where id = d3)
    and (select statut = 'refuse' from public.devis where id = d4), '';
  perform public.zz_comme(adm);
  s := public.zz_leve('select public.admin_devis_statut(''' || d3 || ''', ''gagne'')');
  insert into public.zz_res (nom, ok, vu) values ('un statut inconnu est refusé', s like '%Statut inconnu%', s);

  -- ══════════ du devis à la facture et à la licence ══════════
  s := public.zz_leve('select public.admin_devis_facturer(''' || d3 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('un devis sans accord ne se facture pas', s like '%d''abord être accepté%', s);
  s := public.zz_leve('select public.admin_devis_facturer(''' || d1 || ''')');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'sans coordonnées de facturation, rien ne bouge : ni facture, ni licence', s like '%coordonnées de facturation%'
    and d.facture_id is null and x.offre = 'demo' and not exists (select 1 from public.factures k where k.org_id = o), s
  from public.devis d, public.orgs x where d.id = d1 and x.id = o;
  perform public.zz_comme(dir);
  perform public.facturation_enregistrer('{"nom":"ZZ Lycée Albert Camus","adresse":"12 avenue de la Paix","code_postal":"30000","ville":"Nîmes",
    "siret":"73282932000074","service":"SERV-1"}'::jsonb);
  s := public.zz_leve('select public.admin_devis_facturer(''' || d1 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('le référent ne facture pas lui-même', s like '%Réservé à l''éditeur%', s);
  perform public.zz_comme(adm);
  j := public.admin_devis_facturer(d1);
  fid := (j->>'id')::uuid;
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'la facture reprend les lignes, la période et le total du devis, et le cite', k.numero ~ '^F-\d{4}-\d{4}$' and k.total_ht = 120002
    and jsonb_array_length(k.lignes) = 2 and k.periode_debut = '2026-09-01' and k.periode_fin = '2027-08-31'
    and k.objet like 'Licence annuelle (devis ' || n1 || ')', k.numero || ' ' || k.objet
  from public.factures k where k.id = fid;
  insert into public.zz_res (nom, ok, vu)
  select 'le bon de commande de l''accord est sur la facture', k.engagement = 'BC-2026-042' and k.client->>'engagement' = 'BC-2026-042'
    and k.client->>'nom' = 'ZZ Lycée Albert Camus', k.client::text
  from public.factures k where k.id = fid;
  insert into public.zz_res (nom, ok, vu)
  select 'la licence s''ouvre du même geste : places, fin, client, prix convenu', (j->>'licence')::boolean and x.offre = 'etablissement'
    and x.places = 300 and x.licence_fin = '2027-08-31' and s2.statut = 'client' and s2.prix_euros = 1200,
    x.offre || ' ' || x.places || ' ' || x.licence_fin || ' ' || s2.prix_euros
  from public.orgs x join public.org_suivi s2 on s2.org_id = x.id where x.id = o;
  insert into public.zz_res (nom, ok, vu)
  select 'le devis sait sa facture', d.facture_id = fid, d.facture_id::text from public.devis d where d.id = d1;
  perform public.zz_comme(adm);
  s := public.zz_leve('select public.admin_devis_facturer(''' || d1 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('un devis ne se facture qu''une fois', s like '%déjà facturé%', s);
  s := public.zz_leve('select public.admin_devis_statut(''' || d1 || ''', ''refuse'')');
  insert into public.zz_res (nom, ok, vu) values ('facturé, sa réponse ne change plus', s like '%facturé%', s);
  perform public.zz_comme(dir);
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('le référent voit le devis accepté, sa facture, et sa licence ouverte',
    j->'devis'->0->>'statut' = 'accepte' and j->'devis'->0->>'facture_numero' ~ '^F-' and jsonb_array_length(j->'factures') = 1
    and j->>'offre' = 'etablissement' and (j->>'prix')::int = 1200, (j->'devis'->0)::text);

  -- un devis sans places ni fin : la facture seule, la licence ne bouge pas
  perform public.zz_comme(adm);
  j := public.admin_devis(o, '[{"libelle":"Vingt places de plus","quantite":20,"prix_ht":350}]'::jsonb);
  d2 := (j->>'id')::uuid;
  perform public.admin_devis_statut(d2, 'accepte', 'Marie Curie, proviseure');
  j := public.admin_devis_facturer(d2);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'sans places ni fin au devis, la facture part et la licence ne bouge pas', not (j->>'licence')::boolean and x.places = 300
    and (select count(*) from public.factures k where k.org_id = o) = 2, x.places::text
  from public.orgs x where x.id = o;

  -- ══════════ effacer un prospect emporte ses devis ══════════
  perform public.zz_comme(adm);
  perform public.admin_supprimer_etab(o3);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu)
  select 'un prospect effacé emporte ses devis', count(*) = 0, count(*)::text from public.devis d where d.id = d4;

  -- ══════════ les droits ══════════
  perform public.zz_anon();
  s := public.zz_leve('select public.devis(''' || d1 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('anon : rien', s like '%permission denied%', s);
  s := public.zz_leve('select count(*) from public.devis');
  insert into public.zz_res (nom, ok, vu) values ('anon : pas même la table', s like '%permission denied%', s);
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.piece_lignes(''[]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('l''outil interne ne s''appelle pas de l''extérieur', s like '%permission denied%', s);
  perform public.zz_root();
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
