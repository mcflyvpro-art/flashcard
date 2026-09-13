-- La matière principale d'un membre du personnel. Elle sert au référent
-- pour répartir les services, et à l'écran du professeur pour ne lui
-- proposer que ce qui le concerne.
alter table public.org_members add column if not exists subject text not null default '';
