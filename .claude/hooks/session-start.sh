#!/bin/bash
# Démarrage d'une session Claude dans le cloud : que lint, tests, build et
# parcours e2e tournent d'emblée (voir CLAUDE.md, « Commandes utiles »).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Dépendances : seulement si elles manquent (l'état du conteneur est gardé
# en cache après ce script, une session reprise les a déjà).
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  npm ci --no-audit --no-fund
fi

# `vite build` refuse de partir sans l'adresse du projet Supabase et sa clé
# anon. Les deux sont publiques par nature (elles partent dans chaque build ;
# c'est la RLS qui cloisonne les comptes) : on pose .env.local s'il manque.
if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
VITE_SUPABASE_URL=https://qqbzefpdeinlynjtarqr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxYnplZnBkZWlubHluanRhcnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5Nzk0MTIsImV4cCI6MjEwNDU1NTQxMn0.CLTRJl1ZOg1tbzSIEBiRhhoiiJIVD4cHqkk1qBwV9FI
ENV
fi
