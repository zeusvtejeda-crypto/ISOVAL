#!/usr/bin/env bash
# Instala las dependencias del pipeline en un entorno aislado (video-edit/.venv).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v ffmpeg >/dev/null; then
  echo "Falta ffmpeg."
  case "$(uname -s)" in
    Darwin) echo "  brew install ffmpeg" ;;
    Linux)  echo "  sudo apt install ffmpeg   (o el gestor de tu distro)" ;;
  esac
  exit 1
fi

command -v python3 >/dev/null || { echo "Falta python3 (macOS: brew install python)"; exit 1; }

echo "==> Creando entorno en $HERE/.venv"
python3 -m venv "$HERE/.venv"
"$HERE/.venv/bin/pip" install --upgrade pip >/dev/null
echo "==> Instalando faster-whisper y auto-editor (puede tardar unos minutos)"
"$HERE/.venv/bin/pip" install -r "$HERE/requirements.txt"

echo
echo "Listo. Prueba:  ./video-edit/edit.sh mi-video.mp4 --vertical"
echo "La primera corrida descarga el modelo de Whisper (~500 MB con --model small)."
