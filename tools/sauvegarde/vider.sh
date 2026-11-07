#!/usr/bin/env bash
# La sauvegarde de la base (sauvegarde.yml, M22.T5) : la procédure de
# Supabase pour une sauvegarde qu'on restaure soi-même — les rôles, le
# schéma, puis les données (dont les comptes d'auth et les lignes du
# stockage) en COPY. Plus, pour vérifier la restauration, le nombre exact
# de lignes de chaque table (comptes.tsv : des nombres, aucune donnée). Si
# SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont là, les fichiers du seau
# « media » aussi (les images et sons des pages).
#   SUPABASE_DB_URL=… bash tools/sauvegarde/vider.sh <dossier>
# Rien n'est affiché de ce qui est vidé : le dépôt est public, ses journaux
# de CI aussi.
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant}"
out=${1:?dossier de sortie}
mkdir -p "$out"

supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$out/roles.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$out/data.sql"
# ce que le vidage ne rend pas fidèlement (les droits exacts, nos déclencheurs
# sur auth.users, nos politiques du stockage, les tâches pg_cron) : écrit
# depuis le catalogue, rejoué après les données (droits-ecrire.sql)
psql "$SUPABASE_DB_URL" -X -A -t -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/droits-ecrire.sql" > "$out/droits.sql"

# le compte exact de chaque table de ce qu'on restaure
psql "$SUPABASE_DB_URL" -X -A -t -q -F $'\t' > "$out/comptes.tsv" <<'SQL'
select format('select %L, count(*) from %I.%I', schemaname || '.' || tablename, schemaname, tablename)
from pg_tables where schemaname in ('public', 'auth', 'storage') order by 1
\gexec
SQL

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  mkdir -p "$out/media"
  psql "$SUPABASE_DB_URL" -X -A -t -q -c "select name from storage.objects where bucket_id = 'media' order by name" |
  while IFS= read -r nom; do
    [ -z "$nom" ] && continue
    mkdir -p "$out/media/$(dirname "$nom")"
    curl -sSf -o "$out/media/$nom" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      "$SUPABASE_URL/storage/v1/object/authenticated/media/$nom"
  done
fi
echo "vidage : $(du -sh "$out" | cut -f1), $(wc -l < "$out/comptes.tsv") tables comptées, $(grep -c ';' "$out/droits.sql") instructions de droits"
