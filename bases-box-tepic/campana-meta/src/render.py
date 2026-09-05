#!/usr/bin/env python3
"""Genera los creativos PNG de la campaña a partir de una plantilla HTML.
Uso: python3 render.py   (requiere Chromium; ver CHROME abajo)"""
import os, subprocess, pathlib
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "creativos"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
WA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c.6.3 1.1.4 1.5.5a3.6 3.6 0 0 0 1.7.1 2.8 2.8 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>'

TPL = """<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
:root{--ink:#141414;--char:#1e2024;--gold:#c2a24e;--gold-lt:#e4c97e;--paper:#faf7f1;--s:%(scale)s}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:%(w)spx;height:%(h)spx;overflow:hidden;background:var(--char);color:var(--paper);font-family:'Inter Tight',Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.ad{position:absolute;inset:0;display:flex;flex-direction:column;padding:calc(64px*var(--s));padding-bottom:calc(190px*var(--s))}
.bg{position:absolute;inset:0;z-index:0}
.bg img{width:100%%;height:100%%;object-fit:cover;object-position:%(pos)s}
.bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,20,20,.72) 0%%,rgba(20,20,20,.08) 30%%,rgba(20,20,20,.12) 50%%,rgba(20,20,20,.94) 100%%)}
.top,.mid,.bot{position:relative;z-index:1}
.top{display:flex;justify-content:space-between;align-items:flex-start}
.logo{height:calc(88px*var(--s));filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.badge{border:2px solid var(--gold);color:var(--gold-lt);font-family:Jost,sans-serif;font-weight:600;font-size:calc(22px*var(--s));letter-spacing:.18em;text-transform:uppercase;padding:calc(12px*var(--s)) calc(20px*var(--s));text-align:center;line-height:1.15}
.badge b{display:block;font-size:calc(34px*var(--s));letter-spacing:.02em;color:var(--paper)}
.mid{display:flex;flex-direction:column;justify-content:flex-end;flex:1;min-height:0;gap:calc(22px*var(--s))}
.eyebrow{display:inline-flex;align-items:center;gap:14px;font-family:Jost,sans-serif;font-weight:600;font-size:calc(24px*var(--s));letter-spacing:.3em;text-transform:uppercase;color:var(--gold-lt)}
.eyebrow::before{content:"";width:calc(34px*var(--s));height:2px;background:var(--gold)}
.pill{align-self:flex-start;background:var(--gold);color:var(--ink);font-family:Jost,sans-serif;font-weight:600;font-size:calc(26px*var(--s));letter-spacing:.14em;text-transform:uppercase;padding:calc(12px*var(--s)) calc(22px*var(--s))}
h1{font-family:Fraunces,Georgia,serif;font-weight:300;font-size:calc(112px*var(--s));line-height:.98;letter-spacing:-.015em;max-width:%(h1w)s}
h1 em{font-style:italic;color:var(--gold-lt)}
.sub{font-size:calc(34px*var(--s));line-height:1.3;max-width:24ch;color:rgba(250,247,241,.92)}
.chips{display:flex;flex-wrap:wrap;gap:calc(12px*var(--s))}
.chip{border:1.5px solid rgba(250,247,241,.45);padding:calc(10px*var(--s)) calc(18px*var(--s));font-size:calc(24px*var(--s));font-weight:500;letter-spacing:.02em}
.chip b{color:var(--gold-lt);font-weight:600}
.bot{position:absolute;left:calc(64px*var(--s));right:calc(64px*var(--s));bottom:calc(64px*var(--s));display:flex;align-items:center;gap:calc(20px*var(--s));background:#25D366;color:#fff;padding:calc(22px*var(--s)) calc(30px*var(--s));font-weight:600;font-size:calc(34px*var(--s));letter-spacing:.01em}
.bot svg{width:calc(56px*var(--s));height:calc(56px*var(--s));flex:none}
.bot span b{font-weight:600;opacity:.9}
.bot small{margin-left:auto;font-size:calc(24px*var(--s));font-weight:500;opacity:.9;text-align:right;line-height:1.2}
.render{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:0}
.render img{width:%(renderW)s;filter:drop-shadow(0 60px 70px rgba(0,0,0,.6));transform:translateY(%(renderY)s)}
.render::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50%% 45%%,#2f333a 0%%,var(--char) 55%%,#141414 100%%)}
.render img{position:relative}
</style></head><body><div class="ad">%(bg)s
<div class="top"><img class="logo" src="img/logo.png" alt="Bases para cama tipo box · Tepic"><div class="badge">1 año<b>garantía</b></div></div>
<div class="mid">%(mid)s</div>
<div class="bot">%(wa)s<span>Cotiza por WhatsApp <b>· 311 108 3374</b></span><small>Fabricación propia<br>Tepic, Nayarit</small></div>
</div></body></html>"""

ADS = {
 "A-listas": dict(
   bg='<div class="bg"><img src="img/tonos-torre.jpg"></div>', pos="50% 40%", renderY="0",
   mid='<div class="pill">Listas para entregar · esta semana</div>'
       '<h1>Quedan pocas.<br><em>Elige tu tono.</em></h1>'
       '<p class="sub">Macizas por dentro, 8 tonos y todas las medidas. Directo de fábrica en Tepic.</p>'),
 "B-fabrica": dict(
   bg='<div class="render"><img src="img/base-render-3d.png"></div>', pos="50% 50%", renderY="-14%",
   mid='<div class="eyebrow">Directo de fábrica · sin intermediarios</div>'
       '<h1>Tu base, hecha <em>en Tepic.</em></h1>'
       '<div class="chips"><div class="chip"><b>Individual</b> 1.00 m</div><div class="chip"><b>Matrimonial</b> 1.35 m</div>'
       '<div class="chip"><b>Queen</b> 1.50 m</div><div class="chip"><b>King</b> 2.00 m</div><div class="chip">Medidas especiales</div></div>'),
 "C-taller": dict(
   bg='<div class="bg"><img src="img/taller-wide.jpg"></div>', pos="50% 62%", renderY="0",
   mid='<div class="eyebrow">Nuestro taller · fotos reales</div>'
       '<h1>Así se hacen <em>tus bases.</em></h1>'
       '<p class="sub">Se arman, tapizan y empacan aquí mismo. Te la llevamos a domicilio en Tepic.</p>'),
}
SIZES = {"1080x1350": (1080, 1350, 1.0, "12ch", "-16%", "88%"), "1080x1080": (1080, 1080, 0.8, "14ch", "-30%", "78%")}

def main():
    OUT.mkdir(exist_ok=True)
    for key, ad in ADS.items():
        for sname, (w, h, scale, h1w, ry, rw) in SIZES.items():
            html = TPL % dict(w=w, h=h, scale=scale, wa=WA, h1w=h1w, renderY=ry, renderW=rw, **{k: v for k, v in ad.items() if k != "renderY"})
            src = HERE / f"{key}-{sname}.html"
            src.write_text(html, encoding="utf-8")
            png = OUT / f"{key}-{sname}.png"
            subprocess.run([CHROME, "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                            "--force-device-scale-factor=1", f"--window-size={w},{h}",
                            f"--screenshot={png}", f"file://{src}"], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
            print("ok", png.name, png.stat().st_size)

if __name__ == "__main__":
    main()
