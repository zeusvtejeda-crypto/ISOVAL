#!/usr/bin/env python3
"""Brite Choice Dental reel: ffmpeg + ASS animaciones. Uso: python3 build_reel.py INPUT.mov OUT.mp4"""
import subprocess, sys, math, os
from PIL import Image, ImageDraw
SRC, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.join(HERE, "work"); os.makedirs(W, exist_ok=True)
DUR = 17.9
RED = "&H000000FF&"; WHITE = "&H00FFFFFF&"; YEL = "&H0000E8FF&"; BLK = "&H00000000&"

# --- logo circular con transparencia
im = Image.open(os.path.join(HERE, "assets/logo_src.png")).convert("RGB")
m = Image.new("L", im.size, 0); ImageDraw.Draw(m).ellipse((0, 0, im.size[0]-1, im.size[1]-1), fill=255)
im.putalpha(m); im.resize((800, 800), Image.LANCZOS).save(os.path.join(W, "logo.png"))

def pw(keys):  # interpolación lineal por tramos -> expresión ffmpeg
    e = str(keys[-1][1])
    for (t0, v0), (t1, v1) in reversed(list(zip(keys, keys[1:]))):
        e = f"if(lt(t,{t1}),{v0}+({v1}-{v0})*(t-{t0})/({t1}-{t0}),{e})"
    return e
# --- reencuadres (t0,t1,z0,z1,cx,cy): cortes duros = "jump cuts" con push-in
SEGS = [(0,2.3,1.0,1.06,.5,.5),(2.3,5.82,1.35,1.45,.80,.52),(5.82,8.6,1.12,1.18,.62,.5),
        (8.6,12.1,1.38,1.48,.80,.52),(12.1,15.3,1.15,1.22,.60,.5),(15.3,99,1.5,1.62,.80,.52)]
def segexpr(i):
    e = "1"
    for s in reversed(SEGS):
        t0, t1 = s[0], s[1]; v0, v1 = (s[2], s[3]) if i == 2 else (s[i+2], s[i+2])
        e = f"if(lt(t,{t1}),{v0}+({v1}-{v0})*(t-{t0})/({min(t1,17.9)}-{t0}),{e})"
    return e
Z = segexpr(2); CX = segexpr(0); CY = segexpr(1)
CX = CX.replace("(0)", "(0)")
# cx/cy: usar índices 4,5
def seg_const(idx):
    e = "0.5"
    for s in reversed(SEGS): e = f"if(lt(t,{s[1]}),{s[idx]},{e})"
    return e
CXE, CYE = seg_const(4), seg_const(5)
# --- logo: (t, diámetro, cx, cy)
K = [(0,2,540,480),(0.3,420,540,480),(0.5,330,540,480),(0.65,350,540,480),(2.3,350,540,480),
     (2.6,215,930,175),(15.8,215,930,175),(16.15,420,540,330),(16.35,360,540,330),(99,360,540,330)]
LD = pw([(a,b) for a,b,_,_ in K]); LX = pw([(a,c) for a,_,c,_ in K]); LY = pw([(a,d) for a,_,_,d in K])
Zs = f"trunc(1080*({Z})/2)*2"; Hs = f"trunc(1920*({Z})/2)*2"
Zn = Z.replace("t,", "(n/30),").replace("(t-", "((n/30)-")
fc = (f"[0:v]trim=0:{DUR},setpts=PTS-STARTPTS,scale=w='{Zs}':h='{Hs}':eval=frame:flags=bicubic,"
      f"crop=1080:1920:x='min(max(({CXE.replace('t,','(n/30),')})*1080*({Zn})-540,0),1080*({Zn})-1080)':y='min(max(({CYE.replace('t,','(n/30),')})*1920*({Zn})-960,0),1920*({Zn})-1920)',setsar=1,format=yuv420p[bg];"
      f"[1:v]format=rgba,scale=w='max(2,{LD})':h='max(2,{LD})':eval=frame[lg];"
      f"[bg][lg]overlay=x='{LX}-w/2':y='{LY}-h/2':eval=frame:format=auto[v1];"
      f"[v1]ass={os.path.join(W,'reel.ass')}:fontsdir=/usr/share/fonts/opentype/inter[v]")

# --- ASS
def T(s): h=int(s//3600); m=int(s%3600//60); return f"{h}:{m:02d}:{s%60:05.2f}"
ev = []
def E(a, b, txt, layer=0): ev.append(f"Dialogue: {layer},{T(a)},{T(b)},Base,,0,0,0,,{txt}")
POP = lambda d=0: f"\\fscx0\\fscy0\\t({d},{d+160},\\fscx115\\fscy115)\\t({d+160},{d+280},\\fscx100\\fscy100)"
def rr(w,h): r=h//2; return (f"m {r} 0 l {w-r} 0 b {w-r+28} 0 {w} {r-28} {w} {r} b {w} {r+28} {w-r+28} {h} {w-r} {h} "
                            f"l {r} {h} b {r-28} {h} 0 {r+28} 0 {r} b 0 {r-28} {r-28} 0 {r} 0")
CHECK = "m 0 20 l 7 13 l 15 21 l 33 3 l 40 10 l 15 35 l 0 20"
STAR = "m 20 0 b 22 14 26 18 40 20 b 26 22 22 26 20 40 b 18 26 14 22 0 20 b 14 18 18 14 20 0"
def sparkle(t, x, y, sz=1.0, dur=0.9, col=YEL):
    ms=int(dur*1000); E(t,t+dur,f"{{\\an5\\pos({x},{y})\\p1\\1c{col}\\3c{WHITE}\\bord2\\shad0\\fscx0\\fscy0\\frz0\\t(0,{ms//2},\\fscx{int(120*sz)}\\fscy{int(120*sz)}\\frz90)\\t({ms//2},{ms},\\fscx0\\fscy0\\frz180)}}{STAR}",3)

# Hook
for i,(line,y) in enumerate([("SEGUROS DENTALES",150),("QUE ACEPTAMOS",262)]):
    E(0.05,2.3,f"{{\\an5\\pos(540,{y})\\fs100\\1c{WHITE}\\3c{RED}\\bord14\\shad0\\fad(0,200){POP(i*130)}}}{line}",2)
for (x,y,s,t) in [(300,330,1.2,.35),(790,300,1.0,.5),(250,640,.8,.7),(840,640,1.1,.6)]: sparkle(t,x,y,s)
# Flashes en cortes
for c in [2.3,5.82,8.6,12.1,15.3]:
    E(c,c+0.18,f"{{\\an7\\pos(0,0)\\p1\\1c{WHITE}\\bord0\\shad0\\alpha&H60&\\t(0,180,\\alpha&HFF&)}}m 0 0 l 1080 0 1080 1920 0 1920",5)
# Subtítulos palabra por palabra
G = [[("¿QUÉ",0),("ASEGURANZAS",.36)],[("MANEJAN",.78),("AQUÍ",1.12),("EN",1.34)],
     [("BRITE CHOICE",1.42),("DENTAL?",1.85)],[("LA",2.52),("MAYORÍA",2.9),("DE",3.26)],
     [("ASEGURANZAS",3.6),("PPO",4.46)],[("QUE",5.84),("SON",6.1),("LAS",6.4)],[("PRIVADAS",7.02)],
     [("LA",8.2),("ACEPTAMOS",8.74)],[("MEDI-CAL",10.38),("MEDICARE",11.28)],[("Y",12.68),("HMO",12.92)],
     [("ENTONCES",15.92),("SÍ",17.0)]]
GEND = [.78,1.42,2.3,3.6,5.48,7.02,8.0,10.3,12.09,13.4,17.89]
CAP = f"\\an5\\pos(540,1640)\\fs74\\1c{WHITE}\\3c{BLK}\\bord8\\shad3\\4c&H80000000&"
for g,ge in zip(G,GEND):
    for i,(w,s) in enumerate(g):
        e = g[i+1][1] if i+1<len(g) else ge
        if e-s<0.12: e=s+0.12
        parts=[]
        for j,(w2,_) in enumerate(g):
            if j==i: parts.append(f"{{\\1c{YEL}\\fscx80\\fscy80\\t(0,90,\\fscx118\\fscy118)\\t(90,180,\\fscx100\\fscy100)}}{w2}{{\\r\\{CAP}}}")
            else: parts.append(w2)
        E(s,e,f"{{{CAP}}}"+" ".join(parts),4)
# Badges (pills) que se acumulan
PW,PH=440,100
BAD=[("PPO",4.46,90,1300),("MEDI-CAL",10.38,550,1300),("MEDICARE",11.28,90,1420),("HMO",12.92,550,1420)]
for name,t,x,y in BAD:
    end=15.3; ms=int((end-t)*1000); cx,cy=x+PW//2,y+PH//2
    base=f"\\org({cx},{cy})\\fscx0\\fscy0\\t(0,160,\\fscx112\\fscy112)\\t(160,280,\\fscx100\\fscy100)\\t({ms-220},{ms},\\fscx0\\fscy0)"
    E(t,end,f"{{\\an7\\pos({x},{y}){base}\\p1\\1c{RED}\\3c{WHITE}\\bord6\\shad4\\4c&H80000000&}}{rr(PW,PH)}",3)
    E(t,end,f"{{\\an7\\pos({x+34},{y+30}){base}\\p1\\1c{WHITE}\\bord0\\shad0}}{CHECK}",4)
    E(t,end,f"{{\\an5\\pos({cx+34},{cy})\\org({cx},{cy})\\fs56\\1c{WHITE}\\bord0\\shad2\\fscx0\\fscy0\\t(0,160,\\fscx112\\fscy112)\\t(160,280,\\fscx100\\fscy100)\\t({ms-220},{ms},\\fscx0\\fscy0)}}{name}",5)
# CTA final
t=15.95; ms=int((DUR-t)*1000); cx,cy=540,1330
E(t,DUR,f"{{\\an7\\pos(150,1280)\\org({cx},{cy})\\p1\\1c{RED}\\3c{WHITE}\\bord7\\shad4\\4c&H80000000&{POP()}}}{rr(780,110)}",3)
E(t,DUR,f"{{\\an5\\pos({cx},{cy})\\fs62\\1c{WHITE}\\bord0\\shad2{POP()}}}¡AGENDA TU CITA!",5)
E(t+.25,DUR,f"{{\\an5\\pos(540,1445)\\fs44\\1c{WHITE}\\3c{BLK}\\bord6\\shad2\\fad(150,0)}}PPO · MEDI-CAL · MEDICARE · HMO",5)
for (x,y,s,tt) in [(250,200,1.1,16.1),(830,260,1.3,16.25),(210,480,.8,16.4),(880,520,1.0,16.5)]: sparkle(tt,x,y,s)
# barra de progreso
E(0,DUR,f"{{\\an7\\pos(0,1884)\\p1\\1c{RED}\\bord0\\shad0\\fscx1\\t(0,{int(DUR*1000)},\\fscx10800)}}m 0 0 l 10 0 10 14 0 14",1)
hdr=f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Base,Inter Display,74,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,5,10,10,10,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
open(os.path.join(W,"reel.ass"),"w").write(hdr+"\n".join(ev)+"\n")
open(os.path.join(W,"fc.txt"),"w").write(fc)

# --- SFX sintéticos + mezcla
POPS=[0.1,4.46,10.38,11.28,12.92,15.95,16.15]; WHO=[2.3,5.82,8.6,12.1,15.3,15.8]
inputs=["-i",SRC,"-loop","1","-framerate","30","-t",str(DUR),"-i",os.path.join(W,"logo.png")]
af=[f"[0:a]atrim=0:{DUR},asetpts=PTS-STARTPTS,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11[voz]"]
k=2; mix=["[voz]"]
for t in POPS:
    inputs+=["-f","lavfi","-i","aevalsrc='0.55*sin(2*PI*(500+2800*t)*t)*exp(-22*t)':d=0.25:s=44100"]
    d=int(t*1000); af.append(f"[{k}:a]aformat=channel_layouts=stereo,adelay={d}|{d},volume=0.5[s{k}]"); mix.append(f"[s{k}]"); k+=1
for t in WHO:
    inputs+=["-f","lavfi","-i","anoisesrc=d=0.4:c=pink:a=0.5:r=44100"]
    d=int((t-0.12)*1000); af.append(f"[{k}:a]aformat=channel_layouts=stereo,bandpass=f=1800:w=1200,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.2,adelay={d}|{d},volume=0.5[s{k}]"); mix.append(f"[s{k}]"); k+=1
af.append("[voz]aformat=channel_layouts=stereo[voz2]"); mix[0]="[voz2]"
af.append("".join(mix)+f"amix=inputs={len(mix)}:normalize=0:duration=first,alimiter=limit=0.95[a]")
fc_full=fc+";"+";".join(af)
open(os.path.join(W,"fc.txt"),"w").write(fc_full)
subprocess.run(["ffmpeg","-y","-v","error","-stats",*inputs,"-filter_complex_script",os.path.join(W,"fc.txt"),
  "-map","[v]","-map","[a]","-t",str(DUR),"-r","30","-c:v","libx264","-crf","17","-preset","medium","-pix_fmt","yuv420p",
  "-c:a","aac","-b:a","192k","-movflags","+faststart",OUT],check=True)
