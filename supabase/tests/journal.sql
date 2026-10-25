-- Tests de la migration 20261025170855_journal_avec_contexte : une révision
-- garde son contexte du moment, quoi qu'on fasse ensuite du livre ; le
-- journal agrégé ne compte que les siennes, au bon jour, sans doublon.
-- Même mode que les autres : transaction ANNULÉE, comptes jetables, vrai
-- rôle `authenticated`.

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
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); u uuid;
  livre uuid := gen_random_uuid(); autre uuid := gen_random_uuid();
  bornes integer[] := array[1, 3, 14, 90];
  r public.reviews; j jsonb; s text; t0 timestamptz := date_trunc('day', now()) - interval '10 days';
begin
  foreach u in array array[a, b] loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'zz-' || u || '@exemple.invalid');
  end loop;

  perform public.zz_comme(a);
  insert into public.subjects (user_id, id, name, color) values (a, 'zzdroit', 'Droit', 'pink'), (a, 'zzang', 'Anglais', 'graphite');
  insert into public.decks (id, user_id, name, subject) values (livre, a, 'Code civil', 'zzdroit'), (autre, a, 'Verbes', 'zzang');

  -- ══════════ le déclencheur complète une app ancienne ══════════
  insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at)
  values (a, livre, 'c1', 'study', true, 4000, t0) returning * into r;
  insert into public.zz_res (nom, ok, vu) values ('une app ancienne : matière, nom et livre complétés depuis le paquet',
    r.subject = 'zzdroit' and r.subject_name = 'Droit' and r.deck_name = 'Code civil',
    concat_ws('/', r.subject, r.subject_name, r.deck_name));
  insert into public.zz_res (nom, ok, vu) values ('la toute première lecture d''une page : écart -1', r.ecart = -1, r.ecart::text);

  insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at)
  values (a, livre, 'c1', 'study', false, 6000, t0 + interval '3 days 2 hours') returning * into r;
  insert into public.zz_res (nom, ok, vu) values ('trois jours plus tard : écart 3, calculé depuis le journal', r.ecart = 3, r.ecart::text);

  insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at, subject, subject_name, deck_name, ecart)
  values (a, livre, 'c2', 'study', true, 2000, t0 + interval '4 days', 'zzang', 'Anglais', 'Vieux nom', 0) returning * into r;
  insert into public.zz_res (nom, ok, vu) values ('ce que l''app envoie n''est jamais remplacé',
    r.subject = 'zzang' and r.subject_name = 'Anglais' and r.deck_name = 'Vieux nom' and r.ecart = 0,
    concat_ws('/', r.subject, r.deck_name, r.ecart));

  insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at, client_id)
  values (a, livre, 'c3', 'study', true, 1000, now() + interval '2 days', 'zz-futur') returning * into r;
  insert into public.zz_res (nom, ok, vu) values ('une date dans le futur est ramenée à maintenant',
    r.created_at <= now() + interval '1 second', r.created_at::text);

  -- ══════════ le passé ne bouge plus ══════════
  update public.decks set subject = 'zzang', name = 'Droit des contrats' where id = livre;
  update public.subjects set name = 'Droit civil' where id = 'zzdroit' and user_id = a;
  delete from public.decks where id = livre;
  j := public.journal(t0 - interval '1 day', 'Europe/Paris', bornes, array['zz-futur', 'zz-inconnu']);
  insert into public.zz_res (nom, ok, vu) values ('livre renommé, changé de matière puis supprimé : ses révisions restent en Droit',
    (select sum((e->>4)::int) from jsonb_array_elements(j->'jours') e where e->>1 = 'zzdroit') = 3
    and (select sum((e->>4)::int) from jsonb_array_elements(j->'jours') e) = 4,
    (j->'jours')::text);
  insert into public.zz_res (nom, ok, vu) values ('le nom d''un livre disparu se lit encore dans le journal',
    j->'livres'->>livre::text in ('Code civil', 'Vieux nom'), (j->'livres')::text);
  insert into public.zz_res (nom, ok, vu) values ('le nom de matière est celui du moment (l''app résout le nom actuel)',
    j->'matieres'->>'zzdroit' = 'Droit', (j->'matieres')::text);
  insert into public.zz_res (nom, ok, vu) values ('paliers : écart -1 → -1, 0 → 0, 3 → 2 (bornes de l''app)',
    exists (select 1 from jsonb_array_elements(j->'jours') e where (e->>3)::int = -1)
    and exists (select 1 from jsonb_array_elements(j->'jours') e where (e->>3)::int = 0)
    and exists (select 1 from jsonb_array_elements(j->'jours') e where (e->>3)::int = 2), (j->'jours')::text);
  insert into public.zz_res (nom, ok, vu) values ('connus : la base dit lesquelles elle a déjà, pas les autres',
    j->'connus' = '["zz-futur"]'::jsonb, (j->'connus')::text);
  insert into public.zz_res (nom, ok, vu) values ('toujours : quatre révisions, trois justes',
    (j->'toujours'->>'n')::int = 4 and (j->'toujours'->>'ok')::int = 3, (j->'toujours')::text);

  -- ══════════ le jour est celui de l'appareil ══════════
  insert into public.decks (id, user_id, name, subject) values (livre, a, 'Code civil', 'zzdroit');
  insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at)
  values (a, autre, 'v1', 'study', true, 1000, date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' - interval '30 minutes');
  j := public.journal(now() - interval '1 day 12 hours', 'Europe/Paris', bornes);
  s := (select string_agg(e->>0, ',') from jsonb_array_elements(j->'jours') e where e->>2 = autre::text);
  insert into public.zz_res (nom, ok, vu) values ('23 h 30 UTC compte pour le lendemain à Paris',
    s = to_char((now() at time zone 'UTC')::date, 'YYYY-MM-DD'), s);
  j := public.journal(now() - interval '1 day 12 hours', 'Pas/UnFuseau', bornes);
  insert into public.zz_res (nom, ok, vu) values ('un fuseau inconnu compte en UTC au lieu d''échouer',
    jsonb_array_length(j->'jours') >= 1, (j->'jours')::text);

  -- ══════════ chacun les siennes ══════════
  perform public.zz_comme(b);
  j := public.journal(t0 - interval '1 day', 'UTC', bornes, array['zz-futur']);
  insert into public.zz_res (nom, ok, vu) values ('un autre compte ne voit rien des miennes, même par leur client_id',
    (j->'toujours'->>'n')::int = 0 and j->'connus' = '[]'::jsonb, j::text);
  begin
    insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms) values (a, autre, 'x', 'study', true, 1);
    s := 'passé';
  exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('personne n''écrit dans le journal d''un autre', s = '42501', s);

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('journal : authenticated oui, anon non ; le déclencheur ne s''appelle pas',
    has_function_privilege('authenticated', 'public.journal(timestamptz, text, integer[], text[])', 'execute')
    and not has_function_privilege('anon', 'public.journal(timestamptz, text, integer[], text[])', 'execute')
    and not has_function_privilege('authenticated', 'public.reviews_contexte()', 'execute'), 'droits');

  -- ══════════ un livre partagé garde le nom de sa matière ══════════
  insert into public.shares (token, deck_id, user_id, mode) values ('zztokjournal', livre, a, 'read');
  perform set_config('role', 'anon', true);
  s := (select d.subject_name from public.shared_deck('zztokjournal') d);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('shared_deck rend le nom de la matière, même sans compte', s = 'Droit civil', s);
  begin
    insert into public.mail (from_user, to_user, from_name, deck_name, message, cards, subject_name)
    values (a, b, 'A', 'L', '', '[]', repeat('x', 61));
    s := 'passé';
  exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('un nom de matière de plus de 60 signes est refusé au courrier', s = '23514', s);
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
