-- L'examen blanc de Mirandola Infini (2026-11-06) : ce qu'on garde d'un
-- examen corrigé par l'IA — la note, le compte des réponses justes, et le
-- détail en texte (les questions, ce que l'IA a lu, sa correction et son
-- conseil quand une réponse était fausse, les pages à revoir). Jamais une
-- photo de copie : elle ne sert qu'à la correction et ne quitte pas
-- l'appareil au-delà.
--
-- Un examen appartient à un livre : il part avec lui. Un livre à la
-- corbeille garde ses examens (l'app ne les montre plus) et les retrouve
-- s'il revient ; supprimé pour de bon — la purge de la corbeille, ou le
-- compte supprimé —, ses examens partent en cascade.
--
-- Qui fait quoi : chacun lit, écrit et efface les siens, sur un livre à
-- lui ; personne ne modifie un examen (une note ne se réécrit pas) ; anon
-- rien. La vérification en deux étapes tient comme pour le reste de ce qui
-- est à soi (politique restrictive deux_etapes, mfa_ok).

create table public.examens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  created_at timestamptz not null default now(),
  note numeric(3, 1) not null check (note >= 0 and note <= 20),
  questions smallint not null check (questions between 1 and 40),
  justes smallint not null check (justes >= 0 and justes <= questions),
  copie text not null default 'clavier' check (copie in ('clavier', 'photo')),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 65536)
);

create index examens_livre on public.examens (deck_id, created_at desc);
create index examens_compte on public.examens (user_id);

alter table public.examens enable row level security;

create policy examens_lire on public.examens for select to authenticated
  using (user_id = (select auth.uid()));
create policy examens_ecrire on public.examens for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));
create policy examens_effacer on public.examens for delete to authenticated
  using (user_id = (select auth.uid()));
create policy deux_etapes on public.examens as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());

revoke all on public.examens from anon;
revoke update on public.examens from authenticated;
grant select, insert, delete on public.examens to authenticated;
