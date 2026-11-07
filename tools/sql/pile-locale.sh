#!/usr/bin/env bash
# La pile locale de Supabase (CLI + Docker) pour les essais de base de la CI.
#   bash tools/sql/pile-locale.sh            → dans le dépôt : toutes nos migrations, depuis la première (base.yml)
#   bash tools/sql/pile-locale.sh <dossier>  → un projet vide, sans nos migrations : on y restaure une sauvegarde (sauvegarde.yml)
# Postgres 17 comme le projet ; ni studio, ni temps réel, ni journaux : seulement
# la base, l'authentification, le stockage et l'API, ce que la RLS et les
# fonctions emploient. supabase/config.toml n'est pas versionné : il naît ici.
set -euo pipefail
dossier=${1:-$(cd "$(dirname "$0")/../.." && pwd)}
mkdir -p "$dossier"
cd "$dossier"
[ -f supabase/config.toml ] || supabase init --force > /dev/null
sed -i 's/^major_version = .*/major_version = 17/' supabase/config.toml
supabase start -x studio,imgproxy,mailpit,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta
