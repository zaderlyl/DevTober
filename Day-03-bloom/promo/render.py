#!/usr/bin/env python3
"""Génère la bande d'annonce de Day 03 - Bloom (bloom.mp4 et bloom.gif), image par image.

Aucune capture : chaque image est CALCULÉE à partir du temps t (Pillow), donc le mouvement est fluide et le rendu
est identique à chaque exécution. L'interface « chat » est une recréation stylisée, pas une vraie capture de Discord.

    python3 render.py            # tout générer (images dans un dossier temporaire, puis ffmpeg)
    python3 render.py --still 5.2   # une seule image PNG à t = 5,2 s, pour régler le dessin
"""
import math, os, subprocess, sys, tempfile
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont

W = H = 1080
S = 2                      # sur-échantillonnage : on dessine en 2160 puis on réduit, pour des bords nets
FPS = 30
DURATION = 10.8
HERE = os.path.dirname(os.path.abspath(__file__))

# ---- couleurs (celles de la page bloom.css)
BG = (31, 157, 85); INK = (255, 255, 255)
STEM = (13, 107, 54); LEAF = (185, 243, 207); PETAL = (255, 208, 230); PETAL_EDGE = (255, 154, 200)
CORE = (255, 216, 74); CORE_EDGE = (224, 168, 0); SOIL = (91, 58, 30); SEED = (200, 155, 90); RAIN = (191, 233, 255)
PANEL = (43, 45, 49); BAR = (56, 58, 64); CHIP = (64, 68, 78); MUTED = (160, 164, 172); ACCENT = (120, 200, 255)

# ---- le scénario : quatre arrosages, un par étape de pousse
WATER = [2.9, 4.5, 6.1, 7.7]
STAGE_NAMES = ['Graine', 'Pousse', 'Tige', 'Bouton', 'Fleur']
HEIGHT = [0, 55, 115, 140, 150]      # hauteur de la tige à chaque étape (unités de la page)

MENLO = '/System/Library/Fonts/Menlo.ttc'
_fonts = {}
def font(size, bold=False):
    key = (size, bold)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(MENLO, int(size * S), index=1 if bold else 0)
    return _fonts[key]

# ---- outils d'animation
clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
def seg(t, a, b): return clamp((t - a) / (b - a))
def out_cubic(x): return 1 - (1 - x) ** 3
def out_back(x, c=1.7): x = clamp(x); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
def lerp(a, b, x): return a + (b - a) * x
def mix(c1, c2, a): return tuple(int(lerp(c1[i], c2[i], clamp(a))) for i in range(3))

def growth(t):
    """g = 0 (graine) .. 4 (fleur) : monte d'une étape, avec un petit dépassement, après chaque arrosage."""
    return sum(out_back(seg(t, w + 0.3, w + 1.2), 1.2) for w in WATER)

def stem_height(g):
    g = clamp(g, 0, 4.3); i = min(int(g), 3); return lerp(HEIGHT[i], HEIGHT[i + 1], g - i) if g <= 4 else HEIGHT[4]

# ---- dessin
def ell(cx, cy, rx, ry, rot=0.0, n=56):
    r = math.radians(rot); c, s = math.cos(r), math.sin(r)
    return [((cx + rx * math.cos(a) * c - ry * math.sin(a) * s) * S, (cy + rx * math.cos(a) * s + ry * math.sin(a) * c) * S)
            for a in (2 * math.pi * k / n for k in range(n))]

def text(d, xy, s, size, fill, bold=False, anchor='mm', spacing=0.0):
    if spacing:
        total = sum(d.textlength(ch, font=font(size, bold)) / S + spacing for ch in s) - spacing
        x = xy[0] - total / 2 if anchor == 'mm' else xy[0]
        for ch in s:
            d.text((x * S, xy[1] * S), ch, font=font(size, bold), fill=fill, anchor='lm')
            x += d.textlength(ch, font=font(size, bold)) / S + spacing
        return
    d.text((xy[0] * S, xy[1] * S), s, font=font(size, bold), fill=fill, anchor=anchor)

def rrect(d, x0, y0, x1, y1, r, fill, outline=None, width=0):
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], r * S, fill=fill, outline=outline, width=int(width * S))

def drop(d, x, y, size, fill):
    """une goutte : une pointe en haut et un rond en bas"""
    r = size * 0.62; cy = y + size * 0.2
    pts = [(x, y - size)]
    pts += [(x + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(-20, 201, 12)]
    d.polygon([(px * S, py * S) for px, py in pts], fill=fill)

SOIL_Y = 724; K = 1.7; CX = 540

def draw_plant(d, t):
    g = growth(t)
    appear = out_cubic(seg(t, 0.2, 0.9))
    # terre
    d.polygon(ell(CX, SOIL_Y, 280 * appear, 46 * appear), fill=SOIL)
    d.polygon(ell(CX, SOIL_Y - 8, 220 * appear, 20 * appear), fill=mix(SOIL, (120, 80, 44), 0.5))
    # graine
    ss = clamp(1 - g * 1.4) * appear
    if ss > 0.02: d.polygon(ell(CX, SOIL_Y - 14, 22 * ss, 15 * ss, -10), fill=SEED)
    h = stem_height(g) * K
    top = SOIL_Y - 14 - h
    if h > 1:
        rrect(d, CX - 6, top, CX + 6, SOIL_Y - 10, 6, STEM)
    # feuilles (à partir de l'étape « tige »)
    lf = out_back(seg(g, 1.5, 2.2), 1.4)
    if lf > 0.02:
        ly = SOIL_Y - 14 - h * 0.45
        for sgn in (-1, 1):
            d.polygon(ell(CX + sgn * 36 * K * 0.62 * lf, ly - 6 * lf, 34 * K * 0.62 * lf, 15 * K * 0.62 * lf, sgn * 25), fill=LEAF)
    # bouton puis fleur
    bud = clamp((g - 2.5) * 2) * (1 - seg(g, 3.3, 3.8))
    if bud > 0.02:
        d.polygon(ell(CX, top - 14 * K * bud, 11 * K * bud, 17 * K * bud), fill=PETAL, outline=PETAL_EDGE, width=int(2 * S))
    fl = out_back(seg(g, 3.3, 4.0), 1.5)
    if fl > 0.02:
        spin = (1 - seg(g, 3.3, 4.0)) * 40
        for a in range(0, 360, 60):
            r = math.radians(a + spin)
            ox, oy = 34 * K * fl * math.sin(r), -34 * K * fl * math.cos(r)
            d.polygon(ell(CX + ox, top + oy, 11 * K * fl, 20 * K * fl, a + spin), fill=PETAL, outline=PETAL_EDGE, width=int(2 * S))
        d.ellipse([(CX - 12 * K * fl) * S, (top - 12 * K * fl) * S, (CX + 12 * K * fl) * S, (top + 12 * K * fl) * S], fill=CORE, outline=CORE_EDGE, width=int(2 * S))
    return g, top

def draw_rain(d, t):
    for w in WATER:
        u = (t - w - 0.1) / 1.1
        if 0 <= u <= 1:
            for i, dx in enumerate((-90, -30, 30, 90, 0)):
                v = clamp((u * 1.25) - i * 0.07)
                if 0 < v < 1:
                    y = lerp(470, SOIL_Y - 24, v * v)
                    drop(d, CX + dx, y, 15, mix(RAIN, BG, clamp((v - 0.7) * 3.3)))

def draw_sparkles(d, t, top):
    u = seg(t, WATER[3] + 1.0, WATER[3] + 1.9)
    if 0 < u < 1:
        for k in range(10):
            a = math.radians(k * 36 + 12)
            rr = lerp(60, 190 + (k % 3) * 25, out_cubic(u)); x, y = CX + rr * math.cos(a), top + rr * math.sin(a)
            sz = (1 - u) * (9 + (k % 2) * 5)
            col = mix((255, 244, 176), BG, u * 0.8)
            d.polygon([(x * S, (y - sz * 1.8) * S), ((x + sz * .45) * S, (y - sz * .45) * S), ((x + sz * 1.8) * S, y * S), ((x + sz * .45) * S, (y + sz * .45) * S),
                       (x * S, (y + sz * 1.8) * S), ((x - sz * .45) * S, (y + sz * .45) * S), ((x - sz * 1.8) * S, y * S), ((x - sz * .45) * S, (y - sz * .45) * S)], fill=col)

def draw_title(d, t):
    a = out_cubic(seg(t, 0.0, 0.6)); b = out_back(seg(t, 0.05, 0.85), 1.9)
    text(d, (CX, 66), 'DAY 03  /  DEVTOBER', 28, mix(BG, INK, a * 0.85), spacing=7)
    y = 190 - (1 - b) * 70
    text(d, (CX, y), 'Bloom', 190, mix(BG, INK, clamp(b * 1.4)), bold=True)
    text(d, (CX, 318), 'un bot Discord qui fait pousser une plante', 29, mix(BG, INK, out_cubic(seg(t, 0.6, 1.3)) * 0.85))

# ---- le panneau « chat »
PX0, PX1, PY0, PY1 = 90, 990, 790, 1030

def draw_panel(d, t):
    slide = 1 - out_cubic(seg(t, 1.4, 2.1)) + out_cubic(seg(t, 9.15, 9.75))
    oy = slide * 330
    if oy > 320: return
    rrect(d, PX0, PY0 + oy, PX1, PY1 + oy, 30, PANEL)
    # entrée de texte
    iy0, iy1 = PY1 - 74 + oy, PY1 - 22 + oy
    rrect(d, PX0 + 22, iy0, PX1 - 22, iy1, 18, BAR)
    cy = (iy0 + iy1) / 2
    # quel arrosage est en train d'être tapé ?
    typing, prog, sent = None, 0.0, -1
    for i, w in enumerate(WATER):
        dur = 0.95 if i == 0 else 0.45
        st = w - 0.15 - dur
        if t >= st - 0.05:
            typing = i
        if t >= w: sent = i
    cmd = '/arroser'
    shown = ''
    if typing is not None and typing > sent:
        w = WATER[typing]; dur = 0.95 if typing == 0 else 0.45; st = w - 0.15 - dur
        n = int(clamp((t - st) / dur) * len(cmd) + 0.999) if t >= st else 0
        shown = cmd[:n]
    if shown:
        text(d, (PX0 + 52, cy), shown, 36, INK, anchor='lm')
        cx = PX0 + 52 + d.textlength(shown, font=font(36)) / S + 3
        if int(t * 4) % 2 == 0 or len(shown) < len(cmd): rrect(d, cx, cy - 18, cx + 3, cy + 18, 1, ACCENT)
    else:
        text(d, (PX0 + 52, cy), 'Envoyer un message', 33, (105, 109, 117), anchor='lm')
    # historique : le dernier échange
    if sent >= 0:
        w = WATER[sent]; u = out_back(seg(t, w, w + 0.4), 1.4); fade = clamp((t - w) / 0.18)
        y = PY0 + 22 + oy + (1 - u) * 22
        # ligne de l'utilisateur : avatar, nom, commande
        d.ellipse([(PX0 + 28) * S, y * S, (PX0 + 68) * S, (y + 40) * S], fill=mix(PANEL, (122, 140, 255), fade))
        text(d, (PX0 + 88, y + 20), 'toi', 26, mix(PANEL, MUTED, fade), anchor='lm')
        rrect(d, PX0 + 150, y + 3, PX0 + 150 + 168, y + 37, 11, mix(PANEL, CHIP, fade))
        text(d, (PX0 + 168, y + 20), '/arroser', 26, mix(PANEL, INK, fade), anchor='lm')
        # réponse du bot
        by = y + 58
        d.ellipse([(PX0 + 28) * S, by * S, (PX0 + 68) * S, (by + 40) * S], fill=mix(PANEL, BG, fade))
        for a in range(0, 360, 72):
            r = math.radians(a)
            d.polygon(ell(PX0 + 48 + 7 * math.sin(r), by + 20 - 7 * math.cos(r), 3.8, 6.4, a), fill=mix(PANEL, INK, fade))
        text(d, (PX0 + 88, by + 12), 'Bloom', 26, mix(PANEL, INK, fade), bold=True, anchor='lm')
        drop(d, PX0 + 98, by + 40, 12, mix(PANEL, RAIN, fade))
        text(d, (PX0 + 120, by + 40), 'Arrosé !', 30, mix(PANEL, INK, fade), anchor='lm')
        # étape + barre de progression (5 segments)
        st = min(sent + 1, 4)
        text(d, (PX0 + 350, by + 40), f'{STAGE_NAMES[st]} · {st + 1}/5', 30, mix(PANEL, INK, fade), anchor='lm')
        for k in range(5):
            x = PX0 + 625 + k * 50
            on = k <= st
            fillc = mix(PANEL, (255, 216, 74) if st == 4 else (110, 220, 150), fade) if on else mix(PANEL, (80, 84, 92), fade)
            rrect(d, x, by + 30, x + 40, by + 50, 8, fillc)
        if st == 4 and t > w + 0.9:
            text(d, (PX1 - 40, y + 20), 'elle a fleuri !', 28, mix(PANEL, CORE, clamp((t - w - 0.9) / 0.3)), anchor='rm')

def draw_end(d, t):
    u = out_cubic(seg(t, 9.55, 10.25))
    if u <= 0: return
    oy = (1 - u) * 90
    text(d, (CX, 842 + oy), 'Une plante. Tous les serveurs.', 40, mix(BG, INK, u), bold=True)
    bx0, bx1, by0, by1 = CX - 330, CX + 330, 890 + oy, 962 + oy
    rrect(d, bx0, by0, bx1, by1, 36, mix(BG, INK, u))
    text(d, (CX, (by0 + by1) / 2), 'Ajouter le bot à ton serveur', 31, BG, bold=True)
    text(d, (CX, 1010 + oy), 'zaderlyl.github.io/DevTober  ·  #devtober', 25, mix(BG, INK, u * 0.85))

def frame(t):
    img = Image.new('RGB', (W * S, H * S), BG)
    d = ImageDraw.Draw(img)
    draw_title(d, t)
    g, top = draw_plant(d, t)
    draw_rain(d, t)
    draw_sparkles(d, t, top)
    draw_panel(d, t)
    draw_end(d, t)
    return img.resize((W, H), Image.LANCZOS)

def _job(args):
    i, out = args
    frame(i / FPS).save(os.path.join(out, f'f{i:04d}.png'))

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-1500:])

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--still':
        frame(float(sys.argv[2])).save(os.path.join(HERE, 'still.png')); print('still.png'); sys.exit()
    out = tempfile.mkdtemp(prefix='bloom-frames-')
    n = int(DURATION * FPS)
    with Pool() as p: p.map(_job, [(i, out) for i in range(n)], chunksize=6)
    src = ['-framerate', str(FPS), '-i', os.path.join(out, 'f%04d.png')]
    run(['ffmpeg', '-y', '-v', 'error', *src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', os.path.join(HERE, 'bloom.mp4')])
    # GIF : 600 px, 15 images/s, palette calculée sur la vidéo pour de belles couleurs
    vf = 'fps=15,scale=600:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
    run(['ffmpeg', '-y', '-v', 'error', *src, '-vf', vf, '-loop', '0', os.path.join(HERE, 'bloom.gif')])
    print('frames :', out, f'({n} images)')
