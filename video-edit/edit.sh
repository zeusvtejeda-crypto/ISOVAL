#!/usr/bin/env bash
# Pipeline de edicion: corta silencios -> transcribe -> subtitulos karaoke -> render.
# Todo local y sin claves de API. Uso: ./edit.sh entrada.mp4 [opciones]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$HERE/lib"

IN=""; OUT=""; STYLE="pop"; MODEL="small"; LANG="es"
THRESHOLD="4%"; MARGIN="0.2s"; FONT=""
VERTICAL=0; DO_CUT=1; DO_SUBS=1; KEEP=0

usage() {
  cat <<'USAGE'
Uso: ./edit.sh entrada.mp4 [opciones]

  -o, --out ARCHIVO   salida (por defecto: <entrada>-edit.mp4)
      --style NOMBRE  pop | clean | neon            (default: pop)
      --model NOMBRE  tiny|base|small|medium|large-v3 (default: small)
      --lang CODIGO   es, en, auto...               (default: es)
      --vertical      reencuadra a 9:16 1080x1920 (Reels/TikTok)
      --font NOMBRE   fuerza una fuente instalada en el sistema
      --threshold N%  sensibilidad del corte de silencios (default: 4%)
      --margin Ns     aire que deja antes/despues de cada corte (default: 0.2s)
      --no-cut        no cortar silencios
      --no-subs       no poner subtitulos
      --keep          conserva la carpeta work/ (audio, transcripcion, .ass)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--out)      OUT="$2"; shift 2 ;;
    --style)       STYLE="$2"; shift 2 ;;
    --model)       MODEL="$2"; shift 2 ;;
    --lang)        LANG="$2"; shift 2 ;;
    --font)        FONT="$2"; shift 2 ;;
    --threshold)   THRESHOLD="$2"; shift 2 ;;
    --margin)      MARGIN="$2"; shift 2 ;;
    --vertical)    VERTICAL=1; shift ;;
    --no-cut)      DO_CUT=0; shift ;;
    --no-subs)     DO_SUBS=0; shift ;;
    --keep)        KEEP=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    -*)            echo "Opcion desconocida: $1" >&2; usage; exit 1 ;;
    *)             IN="$1"; shift ;;
  esac
done

[[ -n "$IN" ]] || { usage; exit 1; }
[[ -f "$IN" ]] || { echo "No existe el archivo: $IN" >&2; exit 1; }
command -v ffmpeg  >/dev/null || { echo "Falta ffmpeg. Corre video-edit/setup.sh" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "Falta ffprobe (viene con ffmpeg)." >&2; exit 1; }

IN="$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")"
BASE="$(basename "${IN%.*}")"
[[ -n "$OUT" ]] || OUT="$(dirname "$IN")/${BASE}-edit.mp4"
mkdir -p "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

# El venv de setup.sh si existe; si no, el python del sistema.
PY="$HERE/.venv/bin/python"
[[ -x "$PY" ]] || PY="python3"
AE="$HERE/.venv/bin/auto-editor"
[[ -x "$AE" ]] || AE="auto-editor"

WORK="$HERE/work/$BASE"
rm -rf "$WORK"; mkdir -p "$WORK"
START=$SECONDS

# 1. Cortar silencios --------------------------------------------------------
CUT="$WORK/cut.mp4"
if [[ $DO_CUT -eq 1 ]] && command -v "$AE" >/dev/null 2>&1; then
  echo "==> 1/4 Cortando silencios (threshold $THRESHOLD, margen $MARGIN)"
  "$AE" "$IN" --edit "audio:threshold=$THRESHOLD" --margin "$MARGIN" -o "$CUT" >/dev/null
else
  if [[ $DO_CUT -eq 1 ]]; then
    echo "==> 1/4 auto-editor no instalado: se salta el corte de silencios"
  else
    echo "==> 1/4 Corte de silencios desactivado"
  fi
  ffmpeg -y -v error -i "$IN" -c copy "$CUT"
fi

# Dimensiones de salida (afectan el tamano de fuente de los subtitulos).
if [[ $VERTICAL -eq 1 ]]; then
  W=1080; H=1920
else
  read -r W H < <(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height -of csv=p=0:s=" " "$CUT")
fi

# 2 y 3. Transcribir y generar subtitulos ------------------------------------
if [[ $DO_SUBS -eq 1 ]]; then
  echo "==> 2/4 Transcribiendo con Whisper local (modelo $MODEL, idioma $LANG)"
  ffmpeg -y -v error -i "$CUT" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$WORK/audio.wav"
  "$PY" "$LIB/transcribe.py" "$WORK/audio.wav" -o "$WORK/words.json" \
        --model "$MODEL" --lang "$LANG"

  echo "==> 3/4 Generando subtitulos karaoke (estilo $STYLE, ${W}x${H})"
  FONT_ARG=()
  [[ -n "$FONT" ]] && FONT_ARG=(--font "$FONT") || true
  "$PY" "$LIB/make_ass.py" "$WORK/words.json" -o "$WORK/subs.ass" \
        --style "$STYLE" --width "$W" --height "$H" --srt "$WORK/subs.srt" \
        "${FONT_ARG[@]+"${FONT_ARG[@]}"}"
  cp "$WORK/subs.srt" "${OUT%.*}.srt"
else
  echo "==> 2-3/4 Subtitulos desactivados"
fi

# 4. Render final ------------------------------------------------------------
echo "==> 4/4 Renderizando"
FILTERS=()
[[ $VERTICAL -eq 1 ]] && FILTERS+=("scale=1080:1920:force_original_aspect_ratio=increase" "crop=1080:1920" "setsar=1")
[[ $DO_SUBS -eq 1 ]] && FILTERS+=("ass=subs.ass")

if [[ ${#FILTERS[@]} -eq 0 ]]; then
  ffmpeg -y -v error -stats -i "$CUT" -c copy "$OUT"
else
  VF="$(IFS=,; echo "${FILTERS[*]}")"
  ( cd "$WORK" && ffmpeg -y -v error -stats -i "$CUT" -vf "$VF" \
      -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
      -c:a aac -b:a 192k -movflags +faststart "$OUT" )
fi

[[ $KEEP -eq 1 ]] || rm -rf "$WORK"

echo
echo "Listo en $((SECONDS - START))s"
echo "  video: $OUT"
if [[ $DO_SUBS -eq 1 ]]; then
  echo "  subs : ${OUT%.*}.srt  (para subir a la plataforma si los quieres nativos)"
fi
if [[ $KEEP -eq 1 ]]; then
  echo "  work : $WORK"
fi
