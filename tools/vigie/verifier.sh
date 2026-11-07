#!/usr/bin/env bash
# La vigie (vigie.yml, M05.T6) : ce qu'un utilisateur rencontrerait, vérifié
# de l'extérieur, et ce que l'app a remonté (la fonction vigie() de la base,
# si SUPABASE_DB_URL est là). Écrit vigie.json — { problemes: [...], base:
# {...} } — et un résumé lisible. Aucun texte d'erreur : le dépôt est
# public, ses tickets aussi (la fonction vigie() n'en rend d'ailleurs pas).
#   SITE=https://mirandola.fr SUPABASE_URL=… SUPABASE_ANON_KEY=… [SUPABASE_DB_URL=…] bash tools/vigie/verifier.sh
set -uo pipefail
SITE=${SITE:-https://mirandola.fr}
problemes=()
ajoute() { problemes+=("$1"); echo "✗ $1"; }

# une page : son statut, son temps, ses en-têtes
page() {
  local chemin=$1 attendu=${2:-200}
  local h; h=$(mktemp)
  local r; r=$(curl -sS -o /dev/null -D "$h" -w '%{http_code} %{time_total}' --max-time 20 "$SITE$chemin" 2>&1) || r="000 0"
  local code=${r%% *} t=${r##* }
  if [ "$code" != "$attendu" ]; then ajoute "$chemin répond $code (attendu $attendu)"; rm -f "$h"; return; fi
  awk -v t="$t" 'BEGIN { exit !(t > 3) }' && ajoute "$chemin met ${t} s à répondre"
  echo "✓ $chemin $code en ${t} s"
  if [ "$attendu" = 200 ]; then
    grep -qi '^content-security-policy:' "$h" || ajoute "$chemin sans CSP appliquée"
    grep -qi '^content-security-policy-report-only:' "$h" && ajoute "$chemin : CSP revenue en observation"
    grep -qi '^strict-transport-security:' "$h" || ajoute "$chemin sans HSTS"
    grep -qi '^x-content-type-options: *nosniff' "$h" || ajoute "$chemin sans X-Content-Type-Options"
    grep -qi '^x-frame-options:' "$h" || ajoute "$chemin sans X-Frame-Options"
  fi
  rm -f "$h"
}

page /
page /app
page /tarifs
page /sw.js
page /moteur

# l'ancien domaine renvoie toujours vers mirandola.fr
r=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 https://www.folioflashcard.online/ 2>&1) || r="000"
case "$r" in 30[1278]\ https://mirandola.fr*) echo "✓ ancien domaine → mirandola.fr" ;; *) ajoute "l'ancien domaine ne redirige plus ($r)" ;; esac

# Supabase : l'authentification et l'API répondent
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/auth/v1/health" 2>&1) || c=000
  [ "$c" = 200 ] && echo "✓ Supabase auth $c" || ajoute "Supabase auth répond $c"
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/subjects?select=id&limit=1" 2>&1) || c=000
  if [ "$c" = 000 ] || [ "$c" -ge 500 ]; then ajoute "Supabase API répond $c"; else echo "✓ Supabase API $c"; fi
fi

# ce que l'app a remonté
base='null'
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  if base=$(psql "$SUPABASE_DB_URL" -X -A -t -q -c 'select public.vigie()' 2>/dev/null) && [ -n "$base" ]; then
    while IFS= read -r raison; do [ -n "$raison" ] && ajoute "$raison"; done < <(jq -r '.raisons[]' <<<"$base")
    jq -r '"ouvertures 24 h : \(.jour.demarrages), erreurs : \(.jour.erreurs), bloquées : \(.jour.bloques)"' <<<"$base"
  else
    base='null'; ajoute "la base ne répond pas à la vigie"
  fi
fi

printf '%s\n' "${problemes[@]+"${problemes[@]}"}" | jq -R . | jq -s --argjson base "$base" '{problemes: ., base: $base}' > vigie.json
echo "── ${#problemes[@]} problème(s)"
