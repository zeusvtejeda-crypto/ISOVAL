# video-edit — edición automática de video con Claude Code

Pipeline local para pasar de un video crudo a un Reel/TikTok con silencios
cortados y subtítulos karaoke. **Sin claves de API y sin servicios de pago:**
todo corre en tu máquina con ffmpeg + Whisper.

## Instalación (una sola vez)

```bash
brew install ffmpeg          # macOS
./video-edit/setup.sh
```

La primera corrida descarga el modelo de Whisper (~500 MB con `--model small`).

## Uso

```bash
./video-edit/edit.sh mi-video.mp4 --vertical
```

Sale `mi-video-edit.mp4` (video con subtítulos quemados) y `mi-video-edit.srt`
(por si prefieres subir los subtítulos nativos a Instagram/TikTok).

### Opciones

| Flag | Qué hace | Default |
|---|---|---|
| `-o, --out` | Archivo de salida | `<entrada>-edit.mp4` |
| `--style` | `pop` (TikTok), `clean` (YouTube), `neon` | `pop` |
| `--model` | `tiny`→`large-v3`: más grande = mejor y más lento | `small` |
| `--lang` | Idioma del audio (`es`, `en`, `auto`) | `es` |
| `--vertical` | Reencuadra a 9:16 1080x1920 | off |
| `--font` | Fuerza una fuente instalada en el sistema | la del estilo |
| `--threshold` | Sensibilidad del corte de silencios | `4%` |
| `--margin` | Aire antes/después de cada corte | `0.2s` |
| `--no-cut` / `--no-subs` | Saltar una etapa | — |
| `--keep` | Conserva `work/` (audio, transcripción, `.ass`) | off |

### Ejemplos

```bash
# Reel vertical, estilo TikTok
./video-edit/edit.sh crudo.mov --vertical

# YouTube horizontal, subtítulos sobrios, transcripción más precisa
./video-edit/edit.sh clase.mp4 --style clean --model medium

# Solo cortar silencios, sin subtítulos
./video-edit/edit.sh entrevista.mp4 --no-subs --threshold 3%

# Revisar la transcripción antes de dar por bueno el video
./video-edit/edit.sh crudo.mp4 --vertical --keep
# -> video-edit/work/crudo/words.json  y  subs.ass  quedan disponibles
```

## Cómo funciona

```
entrada.mp4
  │ auto-editor        corta los silencios
  │ ffmpeg             extrae audio mono 16 kHz
  │ faster-whisper     transcribe con timestamps por palabra  (lib/transcribe.py)
  │ make_ass.py        agrupa en líneas y escribe .ass karaoke (lib/make_ass.py)
  │ ffmpeg             reencuadra 9:16 + quema subtítulos
salida.mp4 + salida.srt
```

El efecto karaoke se hace con un evento `Dialogue` por palabra: la palabra
activa cambia de color y crece; el resto de la línea queda en el color base.
Lo renderiza libass dentro de ffmpeg, así que no hace falta Remotion ni Node.

## Ajustar el look

Los tres estilos viven en `lib/styles.json` (colores en formato ASS
`&HAABBGGRR`, o sea **BGR invertido**, no RGB). Campos útiles:

- `highlight_color` — color de la palabra activa
- `pop_scale` — cuánto crece la palabra activa (100 = sin crecer)
- `size_ratio` / `margin_ratio` — tamaño de fuente y altura, como fracción del alto del video
- `max_chars` / `max_words` — cuántas palabras entran por línea
- `uppercase` — MAYÚSCULAS

Para agregar un estilo propio, copia un bloque con otro nombre y úsalo con
`--style <nombre>`.

## Notas y límites

- Las fuentes se resuelven en tu sistema. `Arial Black` y `Helvetica` existen
  en macOS; en Linux instala las fuentes o pasa `--font "DejaVu Sans"`.
- El render es la parte lenta y la hace tu CPU/GPU, no la IA. Un Reel de 1 min
  con `--model small` tarda ~1-2 min en un MacBook Apple Silicon.
- `work/` y los videos están en `.gitignore`: nunca se suben al repo.
- Whisper se equivoca con nombres propios y jerga. Con `--keep` puedes editar
  `words.json` y regenerar solo los subtítulos:
  ```bash
  .venv/bin/python lib/make_ass.py work/<video>/words.json \
      -o work/<video>/subs.ass --style pop --width 1080 --height 1920
  ```

## Usarlo desde Claude Code

Una vez instalado, en la terminal del proyecto:

> "Edita `~/Desktop/corte-fade.mov` como Reel vertical con subtítulos estilo pop,
> y si la transcripción escribe mal 'Isoval' corrígelo antes de renderizar."

Claude ejecuta `edit.sh`, revisa `words.json` y vuelve a generar los subtítulos
si hace falta. El único costo es el de la conversación: el video se procesa local.
