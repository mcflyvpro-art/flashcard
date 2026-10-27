#!/usr/bin/env bash
# Ce qu'il faut pour tourner la Folio Academy, rangé hors du suivi git
# (.academie/ à la racine, ou ACADEMIE_DIR) : un Python à part pour la voix,
# et, faute de clé de voix (GEMINI_API_KEY, GOOGLE_TTS_API_KEY), la voix de
# repli Kokoro (Apache 2.0, ~350 Mo, depuis GitHub). ffmpeg doit être là.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
TRAVAIL="${ACADEMIE_DIR:-$ICI/../../.academie}"
mkdir -p "$TRAVAIL"

[ -x "$TRAVAIL/venv/bin/python" ] || python3 -m venv "$TRAVAIL/venv"
"$TRAVAIL/venv/bin/pip" install -q --upgrade pip
"$TRAVAIL/venv/bin/pip" install -q numpy soundfile kokoro-onnx

if [ -z "${GEMINI_API_KEY:-}${GOOGLE_TTS_API_KEY:-}" ] || [ "${1:-}" = "--kokoro" ]; then
  K="$TRAVAIL/kokoro"
  mkdir -p "$K"
  for f in kokoro-v1.0.onnx voices-v1.0.bin; do
    [ -s "$K/$f" ] || curl -sSL --fail -o "$K/$f" \
      "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
  done
fi

command -v ffmpeg >/dev/null || { echo "ffmpeg manque (apt-get install ffmpeg)"; exit 1; }
echo "prêt : $TRAVAIL"
