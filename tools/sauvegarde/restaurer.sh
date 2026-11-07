#!/usr/bin/env bash
# Restaurer une sauvegarde chiffrée dans une base Supabase VIERGE (la pile
# locale de la CI, sans nos migrations), puis la vérifier : le même nombre
# de lignes que la production table par table, et toute la suite de tests
# SQL qui passe dessus (M13.T5 : une sauvegarde qu'on n'a jamais restaurée
# n'est pas une sauvegarde). C'est aussi, à la main, la procédure du jour
# où il faudrait vraiment restaurer (docs/FIABILITE.md).
#   SAUVEGARDE_CLE=… bash tools/sauvegarde/restaurer.sh <fichier.tar.gz.gpg>
set -euo pipefail
: "${SAUVEGARDE_CLE:?SAUVEGARDE_CLE manquante}"
fichier=$(realpath "${1:?fichier chiffré}")
racine=$(cd "$(dirname "$0")/../.." && pwd)
d=$(mktemp -d)
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$fichier" 3<<<"$SAUVEGARDE_CLE" | tar xzf - -C "$d"

bash "$racine/tools/sql/pile-locale.sh" "$(mktemp -d)"
R=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# le chargement passe par supabase_admin, le superutilisateur de la pile
# locale : les tables du stockage (storage.buckets_vectors…) appartiennent à
# supabase_storage_admin, et postgres n'y écrit pas (« permission denied »,
# le premier essai du 2026-11-07). La vérification, elle, reste en postgres.
A=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres
psql "$A" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  -f "$d/roles.sql" -f "$d/schema.sql" \
  -c 'set session_replication_role = replica' -f "$d/data.sql"
# puis les droits exacts de la source, nos déclencheurs sur auth.users, nos
# politiques du stockage et les tâches pg_cron (droits-ecrire.sql) : sans eux,
# la base vierge ouvrait à anon toutes les fonctions internes (le premier
# essai, 2026-11-07)
psql "$A" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  -c 'create extension if not exists pg_cron with schema extensions' -f "$d/droits.sql"
echo "restaurée"

# table par table, le même nombre de lignes
ecarts=0; n=0
while IFS=$'\t' read -r table attendu; do
  [ -z "$table" ] && continue
  n=$((n + 1))
  vu=$(psql "$R" -X -A -t -q -c "select count(*) from $table" 2>/dev/null || echo absente)
  if [ "$vu" != "$attendu" ]; then echo "::error::$table : $attendu lignes sauvegardées, $vu restaurées"; ecarts=$((ecarts + 1)); fi
done < "$d/comptes.tsv"
echo "$n tables comparées, $ecarts écart(s)"
[ "$ecarts" -eq 0 ]

# et la base restaurée se comporte comme la vraie : toute la suite SQL
cd "$racine" && PGURL="$R" bash tools/sql/tests.sh
