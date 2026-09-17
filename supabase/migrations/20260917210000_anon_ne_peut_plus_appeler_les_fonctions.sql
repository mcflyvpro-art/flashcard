-- Une fonction `security definer` s'exécute avec les droits de son
-- propriétaire : les règles RLS ne la retiennent pas, seul le test qu'elle
-- fait elle-même la retient. Or le rôle `anon` — celui de la clé publique
-- écrite dans l'app, donc celui de n'importe quel visiteur — pouvait les
-- appeler toutes, `ref_set_password` et `ref_set_role` comprises. Il
-- suffisait qu'une seule oublie son garde-fou pour ouvrir la porte à la
-- prise de contrôle d'un compte d'établissement.
--
-- On ne compte plus sur ces gardes internes : le rôle anonyme perd le droit
-- d'appeler ces fonctions. Elles ne servent qu'à un compte connecté, donc au
-- rôle `authenticated`, qui les garde.
--
-- Exception : `shared_deck(tok)` est la fonction du lien de consultation.
-- Elle doit rester appelable sans compte — c'est tout son objet — et ne
-- rend qu'un livre dont on connaît déjà le jeton.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname <> 'shared_deck'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from anon;', f.sig);
    raise notice 'anon ne peut plus appeler %', f.sig;
  end loop;
end $$;

-- Rappel pour les prochaines fonctions : ne pas accorder `execute` à anon
-- par défaut. Le réflexe est `grant execute on function ... to authenticated;`
