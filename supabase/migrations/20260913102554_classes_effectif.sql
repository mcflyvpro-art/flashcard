-- L'effectif prévu d'une classe : ce que le référent a saisi à la rentrée.
-- Il diffère du nombre d'inscrits tant que tous les comptes ne sont pas
-- ouverts, et c'est justement l'écart qui intéresse le référent.
alter table public.classes add column if not exists effectif int not null default 0;
