#!/usr/bin/env bash
# Toute la suite de tests SQL (supabase/tests/*.sql) contre la base de
# $PGURL — la pile locale de la CI (base.yml), ou une sauvegarde restaurée
# (sauvegarde.yml). Jamais contre la production : rien ne l'empêche (chaque
# test se déroule dans une transaction annulée), mais rien ne l'exige.
#
# Les tests n'écrivent pas tous leur bilan de la même façon (ok/ÉCHEC,
# t/f, OK/KO) ; ils remplissent tous la même table, zz_res. On retire donc
# leur dernier `select … from public.zz_res` et le `rollback`, et l'on y lit
# nous-mêmes ce qui a réussi, avant d'annuler. Un fichier qui lève (une
# erreur SQL) échoue aussi : ON_ERROR_STOP.
#
#   PGURL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash tools/sql/tests.sh [fichiers…]
set -uo pipefail
cd "$(dirname "$0")/../.."
: "${PGURL:?PGURL manquant}"

fichiers=("$@")
[ ${#fichiers[@]} -eq 0 ] && fichiers=(supabase/tests/*.sql)

echec=0; total=0
for f in "${fichiers[@]}"; do
  sortie=$( { sed -E '/^select n, (ok|case)/,$d' "$f"
             echo "select 'BILAN', count(*) filter (where ok), count(*) filter (where ok is not true),"
             echo "  coalesce(string_agg(n || ' : ' || nom, ' ; ' order by n) filter (where ok is not true), '') from public.zz_res;"
             echo "rollback;"; } \
           | psql "$PGURL" -X -A -t -q -v ON_ERROR_STOP=1 -F $'\t' 2>&1 )
  code=$?
  bilan=$(grep '^BILAN' <<<"$sortie" | tail -1)
  ok=$(cut -f2 <<<"$bilan"); ko=$(cut -f3 <<<"$bilan"); quoi=$(cut -f4- <<<"$bilan")
  if [ $code -ne 0 ] || [ -z "$bilan" ] || [ "${ko:-1}" != "0" ] || [ "${ok:-0}" = "0" ]; then
    echo "::error file=$f::${ko:-?} cas en échec (code $code)"
    [ -n "$quoi" ] && echo "   $quoi"
    [ $code -ne 0 ] && grep -E 'ERROR|ERREUR|FATAL' <<<"$sortie" | head -5 | sed 's/^/   /'
    echec=1
  else
    echo "✓ $(basename "$f") : $ok cas"
    total=$((total + ok))
  fi
done
echo "── $total cas réussis"
exit $echec
