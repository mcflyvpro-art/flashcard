-- Tests de 20261026130000 : la licence d'un établissement. Une place par
-- élève et par professeur, retirer quelqu'un libère sa place ; les
-- coordonnées de facturation ; les factures (totaux calculés en base,
-- numérotation continue sans trou, photographie du vendeur et du client,
-- inaltérables, avoirs) ; les échanges entre le référent et Folio ; qui lit
-- quoi. Même mode que etablissement.sql : transaction ANNULÉE, comptes
-- jetables, vrais rôles `authenticated` et `anon`.

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
  adm uuid := gen_random_uuid(); dir uuid := gen_random_uuid(); jean uuid := gen_random_uuid();
  emma uuid := gen_random_uuid(); lucas uuid := gen_random_uuid(); paul uuid := gen_random_uuid();
  autre uuid := gen_random_uuid(); u record; anne uuid;
  j jsonb; o uuid; o2 uuid; o3 uuid; ce text; cp text; c1 uuid; g uuid; s text; n integer;
  f1 uuid; f2 uuid; f3 uuid; a1 uuid; n1 text; n2 text;
begin
  for u in select * from (values
      (adm, 'zzadmin', 'admin'), (dir, 'zzdir', null), (jean, 'zzjean', null), (emma, 'zzemma', null),
      (lucas, 'zzlucas', null), (paul, 'zzpaul', null), (autre, 'zzautre', null)) x(id, pseudo, role) loop
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

  -- ══════════ deux établissements, chacun son référent ══════════
  perform public.zz_comme(adm);
  o := public.admin_etab_enregistrer(null, '{"nom":"ZZ Lycée Camus","ville":"Nîmes"}'::jsonb);
  o2 := public.admin_etab_enregistrer(null, '{"nom":"ZZ Collège Hugo","ville":"Lyon"}'::jsonb);
  o3 := public.admin_etab_enregistrer(null, '{"nom":"ZZ École Ferry","ville":"Arles"}'::jsonb);
  j := public.admin_lancer_demo(o, 3, 30, true);
  perform public.zz_comme(dir); perform public.rejoindre(j->>'code_ref', 'Marie', 'Curie');
  perform public.zz_comme(adm);
  j := public.admin_lancer_demo(o2, 30, 30, false);
  perform public.zz_comme(autre); perform public.rejoindre(j->>'code_ref', 'Victor', 'Hugo');
  perform public.zz_root();
  select k.eleve, k.prof into ce, cp from public.org_codes k where k.org_id = o;
  select c.id into c1 from public.classes c where c.org_id = o and c.genre = 'classe' order by c.name limit 1;

  -- ══════════ une place par professeur et par élève ══════════
  perform public.zz_comme(jean); perform public.rejoindre(cp, 'Jean', 'Moulin');
  perform public.zz_comme(emma); perform public.rejoindre(ce, 'Emma', 'Durand', c1);
  perform public.zz_comme(lucas); perform public.rejoindre(ce, 'Lucas', 'Martin', c1);
  perform public.zz_comme(paul);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('trois places : un professeur et deux élèves, la quatrième personne voit « plein »',
    j->>'statut' = 'plein', j::text);
  perform public.zz_comme(dir);
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('le tableau du référent : 3 places prises (1 professeur, 2 élèves) sur 3',
    (j->>'prises')::int = 3 and (j->>'profs')::int = 1 and (j->>'eleves')::int = 2 and (j->>'places')::int = 3
    and j->>'org' = 'ZZ Lycée Camus', j::text);
  s := public.zz_leve('select public.ref_new_account(''zz-' || gen_random_uuid() || '@exemple.invalid'', ''Anne LEROY'', '''', ''prof'', null, ''provisoire-123'')');
  insert into public.zz_res (nom, ok, vu) values ('licence pleine : le référent n''ouvre pas de compte de plus', s like '%places de la licence%', s);
  select count(*) into n from public.prof_creer_eleves(c1, '[{"prenom":"Alice","nom":"Bernard"}]'::jsonb) x where x.statut = 'complet';
  insert into public.zz_res (nom, ok, vu) values ('licence pleine : les cartes élève non plus', n = 1, n::text);

  -- ══════════ retirer quelqu'un libère sa place ══════════
  perform public.zz_comme(jean);
  g := public.prof_groupe('Atelier', array[emma]);
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.ref_retirer(''' || dir || ''')');
  insert into public.zz_res (nom, ok, vu) values ('on ne se retire pas soi-même', s like '%soi-même%', s);
  s := public.zz_leve('select public.ref_retirer(''' || paul || ''')');
  insert into public.zz_res (nom, ok, vu) values ('on ne retire pas quelqu''un d''ailleurs', s like '%pas dans ton établissement%', s);
  perform public.ref_retirer(jean);
  perform public.ref_retirer(lucas);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('un professeur retiré : hors de l''établissement, son groupe archivé',
    not exists (select 1 from public.org_members m where m.user_id = jean)
    and (select archived_at is not null from public.classes where id = g)
    and not exists (select 1 from public.teachings t where t.teacher = jean), 'jean');
  insert into public.zz_res (nom, ok, vu) values ('un élève retiré : hors de sa classe, son compte reste',
    not exists (select 1 from public.class_members m where m.user_id = lucas)
    and exists (select 1 from public.profiles p where p.id = lucas), 'lucas');
  insert into public.zz_res (nom, ok, vu) values ('le journal du référent le dit, avec le nom',
    (select count(*) from public.ref_audit a where a.org_id = o and a.acte = 'retiré de l''établissement'
       and a.detail->>'nom' in ('Jean MOULIN', 'Lucas MARTIN')) = 2, 'journal');
  perform public.zz_comme(dir);
  anne := public.ref_new_account('zz-' || gen_random_uuid() || '@exemple.invalid', 'Anne LEROY', '', 'prof', null, 'provisoire-123');
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('une place libérée : le référent ouvre le compte d''une professeure',
    (j->>'prises')::int = 2 and (j->>'profs')::int = 1, j::text);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('son adresse ne va pas au journal',
    exists (select 1 from public.ref_audit a where a.cible = anne and a.acte = 'compte ouvert' and not a.detail ? 'adresse'), 'trace');
  perform public.zz_comme(paul);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('une place libre : le code fait de nouveau entrer', j->>'statut' = 'ok', j::text);

  -- ══════════ les coordonnées de facturation ══════════
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.facturation_enregistrer(''{"nom":"Lycée","siret":"1234"}''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('un SIRET compte quatorze chiffres', s like '%quatorze chiffres%', s);
  perform public.facturation_enregistrer(jsonb_build_object('nom', 'Lycée Albert Camus', 'adresse', '51 avenue Kennedy',
    'code_postal', '30000', 'ville', 'Nîmes', 'siret', '193 000 015 00012', 'service', 'FOLIO', 'engagement', 'BC-2026-118',
    'email', 'Intendance@Camus.zz'));
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('le référent enregistre ses coordonnées (SIRET sans espaces, e-mail en minuscules)',
    j->'facturation'->>'siret' = '19300001500012' and j->'facturation'->>'email' = 'intendance@camus.zz'
    and j->'facturation'->>'engagement' = 'BC-2026-118', j::text);
  update public.org_facturation set nom = 'Pirate' where org_id = o;
  select count(*) into n from public.org_facturation where nom = 'Pirate';
  insert into public.zz_res (nom, ok, vu) values ('pas d''écriture directe dans la table', n = 0, n::text);
  perform public.zz_comme(autre);
  select count(*) into n from public.org_facturation;
  insert into public.zz_res (nom, ok, vu) values ('un autre référent ne lit pas ces coordonnées', n = 0, n::text);
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('licence_tableau rend son établissement à lui', j->>'org' = 'ZZ Collège Hugo', j->>'org');
  s := public.zz_leve('select public.licence_tableau(''' || o || ''')');
  insert into public.zz_res (nom, ok, vu) values ('il ne lit pas celui d''un autre en le désignant', s like '%Réservé%', s);

  -- ══════════ les factures ══════════
  perform public.zz_comme(adm);
  perform public.admin_vendeur_enregistrer('{"raison_sociale":"","adresse":""}'::jsonb);
  s := public.zz_leve('select public.admin_facturer(''' || o || ''', ''[{"libelle":"Licence","quantite":1,"prix_ht":100}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('pas de facture sans l''identité du vendeur', s like '%Remplis d''abord ton entreprise%', s);
  perform public.admin_vendeur_enregistrer(jsonb_build_object('raison_sociale', 'Folio', 'forme', 'EI', 'adresse', '1 rue des Livres',
    'code_postal', '30000', 'ville', 'Nîmes', 'siret', '912 345 678 00011', 'immatriculation', 'RCS Nîmes 912 345 678',
    'regime_tva', 'franchise', 'email', 'Contact@Folio.zz', 'delai_jours', '30'));
  s := public.zz_leve('select public.admin_facturer(''' || o3 || ''', ''[{"libelle":"Licence","quantite":1,"prix_ht":100}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('pas de facture sans les coordonnées du client', s like '%coordonnées de facturation%', s);
  j := public.admin_facturer(o, '[{"libelle":"Licence Folio — 3 places, année 2026-2027","quantite":3,"prix_ht":30000}]'::jsonb,
    current_date, current_date + 300, 'Licence annuelle');
  f1 := (j->>'id')::uuid; n1 := j->>'numero';
  j := public.facture(f1);
  insert into public.zz_res (nom, ok, vu) values ('franchise : 900 € HT, pas de TVA, la mention de l''article 293 B, échéance à 30 jours',
    n1 ~ ('^F-' || extract(year from current_date) || '-[0-9]{4}$') and (j->>'total_ht')::bigint = 90000
    and (j->>'tva')::bigint = 0 and (j->>'total_ttc')::bigint = 90000
    and j->>'mention_tva' = 'TVA non applicable, art. 293 B du CGI'
    and (j->>'echeance')::date = current_date + 30, j::text);
  insert into public.zz_res (nom, ok, vu) values ('la facture photographie le vendeur et le client, et le bon de commande',
    j->'vendeur'->>'siret' = '91234567800011' and j->'client'->>'nom' = 'Lycée Albert Camus'
    and j->>'engagement' = 'BC-2026-118' and j->'lignes'->0->>'total_ht' = '90000', j::text);
  perform public.admin_vendeur_enregistrer(jsonb_build_object('raison_sociale', 'Folio SAS', 'forme', 'SAS au capital de 1 000 €',
    'adresse', '1 rue des Livres', 'code_postal', '30000', 'ville', 'Nîmes', 'siret', '91234567800011',
    'tva_intracom', 'fr 12 912345678', 'regime_tva', 'normal', 'taux_tva', '20', 'delai_jours', '45'));
  s := public.zz_leve('select public.admin_facturer(''' || o || ''', ''[{"libelle":"","quantite":1,"prix_ht":100}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('une ligne sans libellé : refusée', s like '%Ligne illisible%', s);
  j := public.admin_facturer(o, '[{"libelle":"Places supplémentaires","quantite":50,"prix_ht":300},
                                  {"libelle":"Formation des professeurs","quantite":1,"prix_ht":12345}]'::jsonb);
  f2 := (j->>'id')::uuid; n2 := j->>'numero';
  insert into public.zz_res (nom, ok, vu) values ('numérotation continue : la suivante, sans trou',
    split_part(n2, '-', 3)::int = split_part(n1, '-', 3)::int + 1, n1 || ' → ' || n2);
  j := public.facture(f2);
  insert into public.zz_res (nom, ok, vu) values ('régime normal : 273,45 € HT, TVA 20 % arrondie au centime, 328,14 € TTC',
    (j->>'total_ht')::bigint = 27345 and (j->>'tva')::bigint = 5469 and (j->>'total_ttc')::bigint = 32814
    and (j->>'taux_tva')::numeric = 20 and j->>'mention_tva' = '' and j->'vendeur'->>'tva_intracom' = 'FR12912345678'
    and (j->>'echeance')::date = current_date + 45, j::text);
  perform public.zz_comme(dir);
  perform public.facturation_enregistrer(jsonb_build_object('nom', 'Lycée Albert Camus', 'adresse', '2 place Neuve',
    'code_postal', '30000', 'ville', 'Nîmes'));
  j := public.facture(f1);
  insert into public.zz_res (nom, ok, vu) values ('une adresse qui change ne réécrit pas une facture émise',
    j->'client'->>'adresse' = '51 avenue Kennedy', j->'client'->>'adresse');
  perform public.zz_root();
  s := public.zz_leve('update public.factures set total_ht = 1, tva = 0, total_ttc = 1 where id = ''' || f1 || '''');
  insert into public.zz_res (nom, ok, vu) values ('une facture émise ne se modifie pas, même par le propriétaire de la base',
    s like '%ne se modifie pas%', s);
  s := public.zz_leve('delete from public.factures where id = ''' || f1 || '''');
  insert into public.zz_res (nom, ok, vu) values ('ni ne s''efface', s like '%ne s''efface pas%', s);
  perform public.zz_comme(adm);
  perform public.admin_facture_dates(f1, current_date, current_date);
  insert into public.zz_res (nom, ok, vu) values ('déposée sur Chorus Pro, payée : les deux seules dates qui bougent',
    (select payee_le = current_date and deposee_le = current_date from public.factures where id = f1), 'dates');
  j := public.admin_avoir(f2, 'erreur de quantité');
  a1 := (j->>'id')::uuid;
  j := public.facture(a1);
  insert into public.zz_res (nom, ok, vu) values ('un avoir reprend la facture en négatif, sous son propre numéro',
    j->>'numero' ~ ('^A-' || extract(year from current_date) || '-[0-9]{4}$') and (j->>'total_ttc')::bigint = -32814
    and (j->>'origine')::uuid = f2 and j->>'origine_numero' = n2 and (j->'lignes'->0->>'quantite')::numeric = -50, j::text);
  insert into public.zz_res (nom, ok, vu) values ('la facture annulée connaît son avoir', public.facture(f2)->>'avoir_numero' = j->>'numero', 'avoir');
  s := public.zz_leve('select public.admin_avoir(''' || f2 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('une facture n''a qu''un avoir', s like '%déjà son avoir%', s);
  s := public.zz_leve('select public.admin_avoir(''' || a1 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('on n''émet pas d''avoir sur un avoir', s like '%Facture inconnue%', s);
  perform public.facturation_enregistrer('{"nom":"École Ferry","adresse":"3 rue Haute","ville":"Arles"}'::jsonb, o3);
  f3 := (public.admin_facturer(o3, '[{"libelle":"Licence","quantite":1,"prix_ht":30000}]'::jsonb)->>'id')::uuid;
  s := public.zz_leve('select public.admin_supprimer_etab(''' || o3 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('un établissement facturé ne s''efface plus (dix ans de conservation)',
    s like '%dix ans%', s);

  -- ══════════ ce que lit le référent ══════════
  perform public.zz_comme(dir);
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('le référent voit ses trois pièces, sans leurs lignes, la plus récente d''abord',
    jsonb_array_length(j->'factures') = 3 and not (j->'factures'->0 ? 'lignes') and not (j->'factures'->0 ? 'client')
    and j->'vendeur'->>'raison_sociale' = 'Folio SAS' and not (j->'vendeur' ? 'iban'), j::text);
  s := public.zz_leve('select public.facture(''' || f3 || ''')');
  insert into public.zz_res (nom, ok, vu) values ('il ne lit pas la facture d''un autre établissement', s like '%Réservé%', s);
  s := public.zz_leve('select public.admin_facturer(''' || o || ''', ''[{"libelle":"x","quantite":1,"prix_ht":1}]''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('le référent n''émet pas de facture', s like '%Réservé à l''éditeur%', s);
  s := public.zz_leve('insert into public.factures (org_id, numero, genre, echeance, lignes, total_ht, tva, total_ttc, taux_tva, vendeur, client)
    values (''' || o || ''', ''X-1'', ''facture'', current_date, ''[]'', 0, 0, 0, 0, ''{}'', ''{}'')');
  insert into public.zz_res (nom, ok, vu) values ('ni n''en écrit une à la main', s is not null, coalesce(s, 'inséré !'));
  perform public.zz_comme(emma);
  select count(*) into n from public.factures;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne lit aucune facture', n = 0, n::text);
  s := public.zz_leve('select public.licence_tableau()');
  insert into public.zz_res (nom, ok, vu) values ('ni le tableau de la licence', s like '%Réservé%', s);

  -- ══════════ les échanges ══════════
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.ref_ecrire(''pirate'', ''x'')');
  insert into public.zz_res (nom, ok, vu) values ('un sujet inconnu : refusé', s like '%Sujet inconnu%', s);
  s := public.zz_leve('select public.ref_ecrire(''places'', ''   '')');
  insert into public.zz_res (nom, ok, vu) values ('un message vide : refusé', s like '%vide%', s);
  perform public.ref_ecrire('places', 'Il nous faudrait 50 places de plus pour les 2nde.');
  perform public.zz_comme(adm);
  select a.n into n from public.admin_echanges_attente() a where a.org_id = o;
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur voit un message en attente', n = 1, coalesce(n::text, 'rien'));
  perform public.admin_repondre(o, 'C''est fait : 50 places de plus, la facture suit.', 'places');
  insert into public.zz_res (nom, ok, vu) values ('répondre, c''est avoir lu',
    not exists (select 1 from public.admin_echanges_attente() a where a.org_id = o), 'lu');
  perform public.zz_comme(dir);
  j := public.licence_tableau();
  insert into public.zz_res (nom, ok, vu) values ('le référent lit le fil dans l''ordre, la réponse de Folio pas encore lue',
    jsonb_array_length(j->'echanges') = 2 and j->'echanges'->0->>'de' = 'etab' and j->'echanges'->0->>'auteur' = 'Marie CURIE'
    and j->'echanges'->1->>'auteur' = 'Folio' and j->'echanges'->1->>'lu' is null, j->'echanges'::text);
  perform public.echanges_lus();
  insert into public.zz_res (nom, ok, vu) values ('il l''a lue',
    public.licence_tableau()->'echanges'->1->>'lu' is not null, 'lu');
  for n in 1..19 loop perform public.ref_ecrire('question', 'Question ' || n); end loop;
  s := public.zz_leve('select public.ref_ecrire(''question'', ''Une de trop'')');
  insert into public.zz_res (nom, ok, vu) values ('vingt messages par jour au plus', s like '%Vingt messages%', s);
  perform public.zz_comme(autre);
  insert into public.zz_res (nom, ok, vu) values ('un autre établissement ne voit pas ce fil',
    jsonb_array_length(public.licence_tableau()->'echanges') = 0
    and (select count(*) from public.org_echanges) = 0, 'cloisonné');

  -- ══════════ les droits ══════════
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon : rien de tout cela',
    not has_function_privilege('anon', 'public.licence_tableau(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.admin_facturer(uuid, jsonb, date, date, text)', 'execute')
    and not has_function_privilege('anon', 'public.ref_ecrire(text, text)', 'execute')
    and not has_function_privilege('anon', 'public.ref_retirer(uuid)', 'execute'), 'anon');
  insert into public.zz_res (nom, ok, vu) values ('les outils internes ne s''appellent pas de l''extérieur',
    not has_function_privilege('authenticated', 'public.numero_suivant(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.etab_places_prises(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.etab_libres(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.licence_org(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.factures_inalterables()', 'execute'), 'internes');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
