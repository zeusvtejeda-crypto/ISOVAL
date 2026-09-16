#!/usr/bin/env python3
"""Transcribe un audio con faster-whisper y vuelca palabras con timestamps.

Salida JSON: {"language": "es", "duration": 61.2,
              "words": [{"start": 0.12, "end": 0.41, "word": "Hola"}, ...]}
Todo corre en local: no usa API ni necesita clave.
"""
import argparse
import json
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--model", default="small",
                    help="tiny|base|small|medium|large-v3 (mas grande = mejor y mas lento)")
    ap.add_argument("--lang", default="es", help="codigo ISO, o 'auto' para detectar")
    ap.add_argument("--compute-type", default="int8",
                    help="int8 (CPU), int8_float16 o float16 (GPU)")
    args = ap.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("Falta faster-whisper. Ejecuta video-edit/setup.sh", file=sys.stderr)
        return 1

    model = WhisperModel(args.model, device="auto", compute_type=args.compute_type)
    segments, info = model.transcribe(
        args.audio,
        language=None if args.lang == "auto" else args.lang,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 400},
    )

    words = []
    text_parts = []
    for seg in segments:
        text_parts.append(seg.text.strip())
        for w in seg.words or []:
            token = w.word.strip()
            if not token:
                continue
            words.append({"start": round(w.start, 3),
                          "end": round(max(w.end, w.start + 0.04), 3),
                          "word": token})
        # feedback en vivo: transcribir es el paso lento del pipeline
        print(f"  [{seg.start:6.1f}s] {seg.text.strip()[:70]}", file=sys.stderr)

    payload = {"language": info.language,
               "duration": round(info.duration, 3),
               "text": " ".join(text_parts),
               "words": words}
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    print(f"{len(words)} palabras -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
