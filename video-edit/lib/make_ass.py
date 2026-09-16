#!/usr/bin/env python3
"""Convierte palabras con timestamps (transcribe.py) en subtitulos .ass karaoke.

Cada linea se emite una vez por palabra: la palabra activa cambia de color y
crece un poco, el resto queda en el color base. Es el efecto "karaoke" de
Reels/TikTok, pero renderizado por libass dentro de ffmpeg (sin dependencias JS).
"""
import argparse
import json
import os
import sys

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,{font},{size},{base},{base},{outline_c},{shadow_c},{bold},0,0,0,100,100,0,0,1,{outline},{shadow},2,{ml},{mr},{mv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

SENTENCE_END = ".?!…:"


def ts(t: float) -> str:
    t = max(t, 0.0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def srt_ts(t: float) -> str:
    t = max(t, 0.0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"


def inline_color(ass_color: str) -> str:
    """&HAABBGGRR (Style) -> &HBBGGRR& , que es lo que espera el override \\1c."""
    digits = ass_color.replace("&H", "").replace("&", "")
    return "&H" + digits[-6:] + "&"


def escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def group_words(words, max_chars, max_words, max_gap=0.7):
    """Agrupa palabras en lineas cortas: corta por pausa, por largo o por frase."""
    lines, cur = [], []
    for w in words:
        if cur:
            gap = w["start"] - cur[-1]["end"]
            width = sum(len(x["word"]) + 1 for x in cur) + len(w["word"])
            if (gap > max_gap
                    or width > max_chars
                    or len(cur) >= max_words
                    or cur[-1]["word"][-1] in SENTENCE_END):
                lines.append(cur)
                cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return lines


def render_line(line, style, tail=0.18):
    """Un evento Dialogue por palabra, con la palabra activa resaltada."""
    pop = int(style["pop_scale"])
    hi = inline_color(style["highlight_color"])
    tokens = [escape(w["word"].upper() if style["uppercase"] else w["word"]) for w in line]
    line_end = line[-1]["end"] + tail
    events = []
    for i, w in enumerate(line):
        start = w["start"]
        end = line[i + 1]["start"] if i + 1 < len(line) else line_end
        end = max(end, start + 0.06)
        parts = list(tokens)
        parts[i] = (f"{{\\1c{hi}\\fscx{pop + 8}\\fscy{pop + 8}"
                    f"\\t(0,90,\\fscx{pop}\\fscy{pop})}}{tokens[i]}{{\\r}}")
        events.append(f"Dialogue: 0,{ts(start)},{ts(end)},Karaoke,,0,0,0,,{' '.join(parts)}")
    return events


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("words_json")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--style", default="pop")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--font", help="sobrescribe la fuente del preset")
    ap.add_argument("--srt", help="ademas escribe un .srt normal (para subir a la plataforma)")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "styles.json"), encoding="utf-8") as fh:
        styles = json.load(fh)
    if args.style not in styles:
        print(f"Estilo desconocido '{args.style}'. Opciones: {', '.join(styles)}", file=sys.stderr)
        return 1
    style = styles[args.style]
    if args.font:
        style = {**style, "font": args.font}

    with open(args.words_json, encoding="utf-8") as fh:
        words = json.load(fh)["words"]
    if not words:
        print("La transcripcion no trae palabras: no hay nada que subtitular.", file=sys.stderr)
        return 1

    lines = group_words(words, style["max_chars"], style["max_words"])

    body = [HEADER.format(
        w=args.width, h=args.height,
        font=style["font"],
        size=max(16, round(args.height * style["size_ratio"])),
        base=style["base_color"],
        outline_c=style["outline_color"],
        shadow_c=style["shadow_color"],
        bold=style["bold"],
        outline=style["outline"], shadow=style["shadow"],
        ml=round(args.width * 0.07), mr=round(args.width * 0.07),
        mv=round(args.height * style["margin_ratio"]),
    )]
    for line in lines:
        body.extend(render_line(line, style))

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(body) + "\n")

    if args.srt:
        with open(args.srt, "w", encoding="utf-8") as fh:
            for n, line in enumerate(lines, 1):
                text = " ".join(w["word"] for w in line)
                fh.write(f"{n}\n{srt_ts(line[0]['start'])} --> {srt_ts(line[-1]['end'])}\n{text}\n\n")

    print(f"{len(lines)} lineas de subtitulo -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
