-- Tests de la migration 20261024232855_defis_en_direct_et_clubs : clubs
-- personnalisés et fermés aux élèves de classe, salles de défi en direct
-- (code, droits d'entrée, score calculé par la base, réponses cachées).
-- Même mode que classes_securisees.sql : transaction ANNULÉE, comptes
-- jetables, vrai rôle `authenticated`. now() est figé pour toute la
-- transaction : les chronos se règlent en déplaçant `debut` et `fin`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated;
grant all on sequence public.zz_res_n_seq to authenticated;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
grant execute on function public.zz_comme(uuid), public.zz_root() to authenticated;

do $$
declare
  oa uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid(); b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid(); u record;
  cid uuid; gid uuid; gcode text; gcode2 text; sid uuid; sid2 uuid; sid3 uuid; sid4 uuid; pin4 text; pin text; pin2 text; pin3 text;
  s text; t text; n integer; b boolean; j jsonb; q3 jsonb;
begin
  insert into public.orgs (id, code, name) values (oa, 'ZZD', 'Lycée Zed');
  for u in select * from (values
      (pa, 'prof', oa, 'Mme Zed', 'zzprof'), (e1, 'eleve', oa, 'Emma DURAND', null),
      (e2, 'eleve', oa, 'Lucas MARTIN', null), (b1, 'eleve', null, 'Sam François', 'samf'),
      (b2, 'eleve', null, 'Tibo', 'tibo'), (b3, 'eleve', null, 'Inès Batman', null)) x(id, role, org, nom, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    insert into public.user_roles (user_id, role) values (u.id, u.role)
    on conflict (user_id) do update set role = excluded.role;
    if u.org is not null then insert into public.org_members (user_id, org_id) values (u.id, u.org); end if;
  end loop;
  perform public.zz_comme(pa);
  cid := public.prof_creer_classe('ZZ 2nde 4', 'Seconde', 'Italien');
  perform public.zz_root();
  insert into public.class_members (class_id, user_id, who) values (cid, e1, 'Emma DURAND'), (cid, e2, 'Lucas MARTIN');

  -- ══════════ clubs ══════════
  perform public.zz_comme(b1);
  select c.id, c.code into gid, gcode from public.club_creer('Les Hiboux', 'chouette', 3, 'On lit la nuit') c;
  insert into public.zz_res (nom, ok, vu) values ('club créé : code de 8, son créateur en est le chef',
    gcode ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'
    and exists (select 1 from public.mes_clubs() m where m.id = gid and m.chef and m.membres = 1
                and m.embleme = 'chouette' and m.teinte = 3 and m.devise = 'On lit la nuit'), gcode);

  perform public.zz_comme(e1);
  begin perform public.club_creer('Club du lycée'); s := 'passé'; exception when others then s := 'refusé'; end;
  begin perform public.join_group(gcode); t := 'passé'; exception when others then t := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un élève de classe ne crée ni ne rejoint de club',
    s = 'refusé' and t = 'refusé', s || '/' || t);

  perform public.zz_comme(b2);
  perform public.join_group(lower(gcode));
  perform public.zz_comme(b3);
  begin insert into public.group_members (group_id, user_id) values (gid, b3); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('on n''entre plus dans un club sans son code (API brute)', s = 'refusé', s);
  begin insert into public.groups (name, code, owner) values ('Pirate', 'ZZPIRATE', b3); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('on ne crée plus un club par l''API brute', s = 'refusé', s);

  for n in 1..10 loop
    begin perform public.join_group('FAUX' || n); exception when others then null; end;
  end loop;
  begin perform public.join_group(gcode); s := 'passé'; exception when others then s := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('10 codes de club faux : le bon est refusé une heure',
    s like 'Trop de codes faux%', s);

  perform public.zz_comme(b2);
  select count(*) into n from public.club_membres(gid);
  perform public.zz_comme(b3);
  insert into public.zz_res (nom, ok, vu) values ('les membres ne se lisent que de l''intérieur',
    n = 2 and (select count(*) from public.club_membres(gid)) = 0, n::text);

  perform public.zz_comme(b2);
  begin perform public.club_nouveau_code(gid); s := 'passé'; exception when others then s := 'refusé'; end;
  perform public.zz_comme(b1);
  gcode2 := public.club_nouveau_code(gid);
  insert into public.zz_res (nom, ok, vu) values ('seul le chef change le code d''invitation',
    s = 'refusé' and gcode2 <> gcode and (select code from public.groups where id = gid) = gcode2, s);

  begin update public.groups set teinte = 40 where id = gid; s := 'passé'; exception when others then s := 'refusé'; end;
  update public.groups set embleme = 'fusee', teinte = 7, devise = 'Plus haut' where id = gid;
  insert into public.zz_res (nom, ok, vu) values ('personnaliser : le chef change emblème et couleur, dans les bornes',
    s = 'refusé' and (select embleme || teinte from public.groups where id = gid) = 'fusee7', s);

  perform public.zz_comme(b3);
  begin insert into public.duels (deck_id, owner, who, name, total, cards, group_id)
        values (gen_random_uuid(), b3, 'Inès', 'Intrus', 4, '[]', gid); s := 'passé';
  exception when others then s := 'refusé'; end;
  perform public.zz_comme(b2);
  begin insert into public.duels (deck_id, owner, who, name, total, cards, group_id)
        values (gen_random_uuid(), b2, 'Tibo', 'Capitales', 4, '[]', gid); t := 'passé';
  exception when others then t := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un défi à son rythme ne se poste que dans SON club',
    s = 'refusé' and t = 'passé', s || '/' || t);

  -- ══════════ une salle de classe ══════════
  q3 := '[{"e":"bonjour","c":["ciao","buongiorno","grazie","prego"],"b":1,"r":"buongiorno"},
          {"e":"merci","c":["grazie","ciao","prego","scusi"],"b":0,"r":"grazie"},
          {"e":"la gare","c":["la stazione","il treno","la piazza","il porto"],"b":0,"r":"la stazione"}]';
  perform public.zz_comme(pa);
  select o.id, o.pin into sid, pin from public.salle_ouvrir('Italien — voyage', 'qcm', 20, q3, cid) o;
  insert into public.zz_res (nom, ok, vu) values ('le prof ouvre une salle pour sa classe : code à 6 chiffres',
    pin ~ '^[0-9]{6}$', pin);

  perform public.zz_comme(e1);
  select r.statut into s from public.salle_rejoindre(substr(pin, 1, 3) || ' ' || substr(pin, 4)) r;
  perform public.zz_comme(b2);
  select r.statut into t from public.salle_rejoindre(pin) r;
  insert into public.zz_res (nom, ok, vu) values ('un élève de la classe entre (code avec espace), un autre compte non',
    s = 'ok' and t = 'classe', s || '/' || t);
  perform public.zz_comme(e2);
  perform public.salle_rejoindre(pin);

  perform public.zz_comme(e1);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('salle de classe : nom complet ; les joueurs ne voient pas les identifiants',
    j->>'etat' = 'attente' and j->'liste' @> '[{"nom":"Emma DURAND","moi":true}]'
    and not (j->'liste'->0 ? 'id') and (j->>'joueurs')::int = 2, j->>'liste');
  perform public.zz_comme(pa);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('l''hôte voit les identifiants (pour exclure)',
    (j->'liste'->0 ? 'id') and (j->>'hote')::boolean, '');

  perform public.zz_comme(e1);
  insert into public.zz_res (nom, ok, vu) values ('répondre avant le lancement : refusé',
    public.salle_repondre(sid, 0, 1) = 'ferme', '');
  begin perform public.salle_avancer(sid, 'attente', -1); s := 'passé'; exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un joueur ne fait pas avancer la salle', s = 'refusé', s);

  perform public.zz_comme(pa);
  s := public.salle_avancer(sid, 'attente', -1);
  t := public.salle_avancer(sid, 'attente', -1);          -- double clic
  perform public.zz_root();
  select rang into n from public.salles where id = sid;
  insert into public.zz_res (nom, ok, vu) values ('lancer : question 1 ; un double clic n''en saute pas une',
    s = 'question' and t = 'question' and n = 0, s || '/' || t || '/' || n);

  -- les 3 secondes de lecture : l'énoncé, pas encore les choix
  perform public.zz_comme(e1);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('pendant la lecture : énoncé visible, choix cachés, réponse refusée',
    j->'question'->>'enonce' = 'bonjour' and j->'question'->'choix' = '[]'::jsonb
    and public.salle_repondre(sid, 0, 1) = 'ferme', j->>'question');

  perform public.zz_root();
  update public.salles set debut = now() - interval '1 second', fin = now() + interval '19 seconds' where id = sid;
  perform public.zz_comme(e1);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('les choix arrivent SANS la bonne réponse',
    jsonb_array_length(j->'question'->'choix') = 4 and position('bonne' in j::text) = 0
    and position('"reponse"' in j::text) = 0, j->>'question');
  insert into public.zz_res (nom, ok, vu) values ('un joueur ne lit pas les questions en direct (RLS)',
    (select count(*) from public.salle_questions where salle_id = sid) = 0, '');
  s := public.salle_repondre(sid, 0, 1);
  t := public.salle_repondre(sid, 0, 2);
  insert into public.zz_res (nom, ok, vu) values ('répondre une fois, pas deux', s = 'ok' and t = 'deja', s || '/' || t);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('la réponse envoyée ne dit pas encore si c''est juste',
    j->>'etat' = 'question' and (j->'moi'->>'repondu')::boolean and (j->'moi'->'derniere') = 'null'::jsonb, j->>'moi');

  perform public.zz_comme(e2);
  perform public.salle_repondre(sid, 0, 3);                -- faux, et dernier à répondre
  perform public.zz_comme(e1);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('tout le monde a répondu : correction tout de suite',
    j->>'etat' = 'correction' and (j->'correction'->>'bonne')::int = 1
    and j->'correction'->'repartition' = '[0, 1, 0, 1]'::jsonb, j->>'correction');
  insert into public.zz_res (nom, ok, vu) values ('juste, au plus vite depuis la réception des choix : 1 000 points',
    (j->'moi'->'derniere'->>'juste')::boolean and (j->'moi'->'derniere'->>'points')::int = 1000
    and (j->'moi'->>'place')::int = 1, j->>'moi');
  insert into public.zz_res (nom, ok, vu) values ('un joueur ne lit que ses propres réponses',
    (select count(*) from public.salle_reponses where salle_id = sid) = 1, '');

  -- question 2 : réponse après 1 seconde, deuxième juste d'affilée
  perform public.zz_comme(pa);
  perform public.salle_avancer(sid, 'correction', 0);
  perform public.zz_root();
  update public.salles set debut = now() - interval '1 second', fin = now() + interval '19 seconds' where id = sid;
  perform public.zz_comme(e1);
  perform public.salle_repondre(sid, 1, 0);
  perform public.zz_root();
  select score, serie into n, s from public.salle_joueurs where salle_id = sid and user_id = e1;
  insert into public.zz_res (nom, ok, vu) values ('1 s sur 20 : 975 points, + 50 pour la série (2 d''affilée)',
    n = 2025 and s = '2', n || ' / série ' || s);

  -- le temps passe : la question se ferme seule, une réponse tardive est refusée
  update public.salles set fin = now() - interval '2 seconds' where id = sid;
  perform public.zz_comme(e2);
  s := public.salle_repondre(sid, 1, 0);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('temps écoulé : réponse refusée, la salle passe en correction',
    s = 'ferme' and j->>'etat' = 'correction', s || '/' || (j->>'etat'));

  perform public.zz_comme(pa);
  insert into public.zz_res (nom, ok, vu) values ('l''hôte lit les questions et toutes les réponses',
    (select count(*) from public.salle_questions where salle_id = sid) = 3
    and (select count(*) from public.salle_reponses where salle_id = sid) = 3, '');
  perform public.salle_exclure(sid, e2);
  perform public.zz_comme(e2);
  select r.statut into s from public.salle_rejoindre(pin) r;
  insert into public.zz_res (nom, ok, vu) values ('exclu : il ne voit plus la salle et n''y rentre pas',
    public.salle_etat(sid)->>'etat' = 'exclu' and s = 'exclu', s);

  perform public.zz_comme(e1);
  insert into public.zz_res (nom, ok, vu) values ('la salle de sa classe apparaît dans « en direct »',
    exists (select 1 from public.salles_ouvertes() o where o.id = sid and o.dedans and o.classe = 'ZZ 2nde 4'), '');
  perform public.zz_comme(pa);
  perform public.salle_avancer(sid, 'correction', 1);
  perform public.salle_avancer(sid, 'question', 2);
  s := public.salle_avancer(sid, 'correction', 2);
  perform public.zz_comme(e1);
  j := public.salle_etat(sid);
  insert into public.zz_res (nom, ok, vu) values ('dernière question passée : fin et podium',
    s = 'fini' and j->>'etat' = 'fini' and j->'top'->0->>'nom' = 'Emma DURAND'
    and jsonb_array_length(j->'top') = 1, j->>'top');
  insert into public.zz_res (nom, ok, vu) values ('les parties terminées de la classe, avec leur podium',
    exists (select 1 from public.salles_terminees(null, cid) x where x.id = sid
            and x.podium->0->>'nom' = 'Emma DURAND' and (x.moi->>'place')::int = 1), '');
  perform public.zz_comme(b2);
  insert into public.zz_res (nom, ok, vu) values ('… invisibles hors de la classe',
    not exists (select 1 from public.salles_terminees(null, cid)), '');

  -- ══════════ salles ouvertes et de club ══════════
  perform public.zz_comme(e1);
  begin perform public.salle_ouvrir('Pirate', 'qcm', 20, q3); s := 'passé'; exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un élève de classe n''ouvre pas de salle', s = 'refusé', s);

  perform public.zz_comme(b1);
  select o.id, o.pin into sid2, pin2 from public.salle_ouvrir('Capitales', 'qcm', 15, q3) o;
  perform public.zz_comme(e1);
  select r.statut into s from public.salle_rejoindre(pin2) r;
  perform public.zz_comme(b3);
  select r.statut into t from public.salle_rejoindre(pin2) r;
  perform public.zz_root();
  select nom into gcode from public.salle_joueurs where salle_id = sid2 and user_id = b3;
  insert into public.zz_res (nom, ok, vu) values ('salle ouverte d''un compte perso : pas d''élève de classe, les autres oui',
    s = 'inconnu' and t = 'ok' and gcode = 'Inès', s || '/' || t || '/' || coalesce(gcode, '∅'));

  perform public.zz_comme(pa);
  select o.id, o.pin into sid3, pin3 from public.salle_ouvrir('Ouverte', 'vf', 10,
    '[{"e":"bonjour","c":["grazie"],"b":1,"r":"buongiorno"}]') o;
  perform public.zz_comme(e1);
  select r.statut into s from public.salle_rejoindre(pin3) r;
  perform public.zz_root();
  select nom into t from public.salle_joueurs where salle_id = sid3 and user_id = e1;
  insert into public.zz_res (nom, ok, vu) values ('salle ouverte d''un prof : l''élève entre, sous « Prénom N. »',
    s = 'ok' and t = 'Emma D.', s || '/' || coalesce(t, '∅'));

  -- vrai ou faux : « bonjour — grazie ? » → faux (1)
  perform public.zz_comme(pa);
  perform public.salle_avancer(sid3, 'attente', -1);
  perform public.zz_root();
  update public.salles set debut = now(), fin = now() + interval '10 seconds' where id = sid3;
  perform public.zz_comme(e1);
  perform public.salle_etat(sid3);
  s := public.salle_repondre(sid3, 0, 1);
  j := public.salle_etat(sid3);
  insert into public.zz_res (nom, ok, vu) values ('vrai ou faux : « faux » était juste',
    s = 'ok' and (j->'moi'->'derniere'->>'juste')::boolean and j->'correction'->'repartition' = '[0, 1]'::jsonb, j::text);

  -- réponse écrite : comparée à la forme normalisée envoyée par l'app
  perform public.zz_comme(b1);
  select o.id, o.pin into sid4, pin4 from public.salle_ouvrir('Écrit', 'ecrit', 30,
    '[{"e":"bonjour","a":["buongiorno","buon giorno"],"r":"Buongiorno"}]', null, gid) o;
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('ouvrir une salle ferme la précédente du même hôte',
    (select etat from public.salles where id = sid2) = 'fini', '');
  perform public.zz_comme(b2);
  select r.statut into s from public.salle_rejoindre(pin4) r;
  perform public.zz_comme(b3);
  select r.statut into t from public.salle_rejoindre(pin4) r;
  insert into public.zz_res (nom, ok, vu) values ('salle de club : un membre entre, pas un autre',
    s = 'ok' and t = 'club', s || '/' || t);
  perform public.zz_comme(b1);
  perform public.salle_avancer(sid4, 'attente', -1);
  perform public.zz_root();
  update public.salles set debut = now(), fin = now() + interval '30 seconds' where id = sid4;
  perform public.zz_comme(b2);
  perform public.salle_etat(sid4);
  s := public.salle_repondre(sid4, 0, null, 'buon giorno');
  j := public.salle_etat(sid4);
  insert into public.zz_res (nom, ok, vu) values ('réponse écrite admise parmi les variantes',
    s = 'ok' and (j->'moi'->'derniere'->>'juste')::boolean, j->>'moi');
  perform public.zz_comme(b2);
  insert into public.zz_res (nom, ok, vu) values ('le club affiche sa salle en direct',
    (select m.en_direct from public.mes_clubs() m where m.id = gid) = sid4, '');

  -- ══════════ garde-fous ══════════
  perform public.zz_comme(b2);
  begin perform public.salle_ouvrir('X', 'qcm', 20, '[{"e":"a","c":["1","2","3","4","5"],"b":0,"r":"1"}]');
        s := 'passé'; exception when others then s := 'refusé'; end;
  begin perform public.salle_ouvrir('X', 'qcm', 20, '[{"e":"a","c":["1","2"],"b":2,"r":"1"}]');
        t := 'passé'; exception when others then t := 'refusé'; end;
  begin perform public.salle_ouvrir('X', 'qcm', 2, q3); b := true; exception when others then b := false; end;
  insert into public.zz_res (nom, ok, vu) values ('questions mal formées et durées hors bornes refusées',
    s = 'refusé' and t = 'refusé' and not b, s || '/' || t || '/' || b);
  begin perform public.salle_ouvrir('X', 'qcm', 20, q3, cid); s := 'passé'; exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('on n''ouvre pas de salle pour la classe d''un autre', s = 'refusé', s);

  perform public.zz_comme(b3);
  for n in 1..12 loop perform public.salle_rejoindre(lpad(n::text, 6, '9')); end loop;
  select r.statut into s from public.salle_rejoindre(pin4) r;
  insert into public.zz_res (nom, ok, vu) values ('12 codes de salle faux en 10 minutes : on attend', s = 'trop', s);

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('fonctions internes fermées, rien pour anon',
    not has_function_privilege('authenticated', 'public.est_eleve_de_classe(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.nom_joueur(uuid, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.purge_salles()', 'execute')
    and not has_function_privilege('anon', 'public.salle_etat(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.salle_rejoindre(text)', 'execute')
    and not has_function_privilege('anon', 'public.club_creer(text, text, integer, text)', 'execute')
    and not has_function_privilege('anon', 'public.join_group(text)', 'execute'), '');
end $$;

select n, ok, nom, vu from public.zz_res order by n;

rollback;
