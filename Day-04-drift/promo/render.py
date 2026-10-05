#!/usr/bin/env python3
"""Génère la bande d'annonce de Day 04 - Drift (drift.mp4 et drift.gif), image par image.

Les DONNÉES sont réelles : drift-run.json est le résultat d'une vraie dérive faite sur Wikipédia avec la règle de la page
(voir fetch_run.py) : vrais titres, vrai nombre de pages liées, vrai numéro tiré. Le DESSIN, lui, est calculé : chaque image
est dessinée à partir du temps t (Pillow), sans aucune capture d'écran. Aucune image d'article n'est utilisée.

    python3 render.py             # tout générer
    python3 render.py --still 6   # une seule image PNG à t = 6 s, pour régler le dessin
"""
import json, math, os, random, subprocess, sys, tempfile
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont

W = H = 1080
S = 2
FPS = 30
DURATION = 14.4
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, 'drift-run.json'), encoding='utf-8'))

BG = (31, 157, 85); INK = (255, 255, 255)
MAPBG = (27, 135, 73)
PANEL = (43, 45, 49); MUTED = (160, 164, 172)
COLORS = [(255, 216, 74), (255, 143, 194), (127, 212, 255), (255, 155, 84), (201, 168, 255), (255, 107, 107)]
MX0, MX1, MY0, MY1 = 40, 1040, 292, 800          # la carte
MW, MH = MX1 - MX0, MY1 - MY0
PX0, PX1, PY0, PY1 = 90, 990, 826, 1034          # le panneau du journal

MENLO = '/System/Library/Fonts/Menlo.ttc'
_f = {}
def font(size, bold=False):
    k = (size, bold)
    if k not in _f: _f[k] = ImageFont.truetype(MENLO, int(size * S), index=1 if bold else 0)
    return _f[k]

clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
def seg(t, a, b): return clamp((t - a) / (b - a))
def out_cubic(x): return 1 - (1 - x) ** 3
def in_out(x): x = clamp(x); return x * x * (3 - 2 * x)
def out_back(x, c=1.7): x = clamp(x); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
def lerp(a, b, x): return a + (b - a) * x
def mix(c1, c2, a): return tuple(int(lerp(c1[i], c2[i], clamp(a))) for i in range(3))

N, HOPS = DATA['drifters'], DATA['hops']
SPACING = 150

# ---- le scénario
T_ROOT = 1.1                  # le point de départ apparaît
T_ROUND0, T_DT = 2.1, 0.82    # un saut par « tour », tous les dériveurs en même temps (léger décalage)
T_FIT = T_ROUND0 + HOPS * T_DT + 0.4     # tout est dessiné
T_IN0, T_IN1, T_OUT0, T_OUT1 = T_FIT + 0.5, T_FIT + 1.6, T_FIT + 2.9, T_FIT + 3.9   # on plonge dans une branche, puis on en ressort
T_END = T_OUT1 - 0.3          # carte finale
FLY_BRANCH = 1                # la branche où l'on zoome

# ---- le tracé : les branches rayonnent depuis le centre (même logique que la page)
def build():
    rng = random.Random(7)
    nodes = [{'title': DATA['start'], 'x': 0.0, 'y': 0.0, 'b': -1, 'i': 0, 't': T_ROOT, 'parent': None, 'bend': 0}]
    plan = [{'angle': math.pi / 4 + b / N * 2 * math.pi + (rng.random() - 0.5) * 0.25, 'w': 0.0} for b in range(N)]
    tip = [0] * N
    for hop in range(HOPS):
        for b, br in enumerate(DATA['branches']):
            if hop >= len(br['steps']): continue
            st, pl, par = br['steps'][hop], plan[b], nodes[tip[b]]
            best, bd = None, -1
            for _ in range(10):
                w = clamp(pl['w'] * 0.6 + (rng.random() - 0.5) * 0.9, -0.9, 0.9)
                a, r = pl['angle'] + w, SPACING * (0.8 + rng.random() * 0.4)
                p = (par['x'] + math.cos(a) * r, par['y'] + math.sin(a) * r, w)
                d = min(math.hypot(n['x'] - p[0], n['y'] - p[1]) for n in nodes)
                if d > bd: best, bd = p, d
                if d > 100: break
            pl['w'] = best[2]
            nodes.append({'title': st['to'], 'x': best[0], 'y': best[1], 'b': b, 'i': len(nodes), 't': T_ROUND0 + hop * T_DT + b * 0.07,
                          'parent': par['i'], 'bend': (1 if rng.random() < 0.5 else -1) * 0.16, 'hop': hop + 1, 'step': st})
            tip[b] = len(nodes) - 1
    return nodes
NODES = build()
EDGE_T, POP_T = 0.5, 0.35      # durée du tracé d'une arête, durée de l'apparition d'un rond (après le début de l'arête)

def node_time(n): return n['t'] + (EDGE_T * 0.75 if n['b'] >= 0 else 0)

# ---- la caméra : un centre et une échelle (pixels par unité), qui glissent en douceur vers leur cible
def cam_for(nodes_):
    xs = [n['x'] for n in nodes_]; ys = [n['y'] for n in nodes_]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    padx, pady = 90, 60
    s = min((MW - 2 * padx - 60) / max(x1 - x0, 1), (MH - 2 * pady) / max(y1 - y0, 1), 0.95)
    return (x0 + x1) / 2 + 30 / s, (y0 + y1) / 2, s

def build_cams():
    """un point de caméra par image, calculé à la suite (c'est un lissage : chaque image dépend de la précédente)"""
    cams, cx, cy, ls = [], 0.0, 0.0, math.log(0.95)
    branch_nodes = [n for n in NODES if n['b'] == FLY_BRANCH]
    for k in range(int(DURATION * FPS) + 1):
        t = k / FPS
        vis = [n for n in NODES if n['t'] <= t] or [NODES[0]]
        tx, ty, ts = cam_for(vis)
        if t >= T_IN0:   # on plonge sur le bout d'une branche, puis on revient
            zone = branch_nodes[-4:]
            zx, zy, zs = cam_for(zone); zs = min(zs, 0.62)
            allx, ally, alls = cam_for(NODES)
            e = in_out(seg(t, T_IN0, T_IN1)) * (1 - in_out(seg(t, T_OUT0, T_OUT1)))
            tx, ty, ts = lerp(allx, zx, e), lerp(ally, zy, e), math.exp(lerp(math.log(alls), math.log(zs), e))
            cx, cy, ls = tx, ty, math.log(ts)   # pendant le vol, la caméra suit la consigne exacte
        else:
            a = 0.12
            cx += (tx - cx) * a; cy += (ty - cy) * a; ls += (math.log(ts) - ls) * a
        cams.append((cx, cy, math.exp(ls)))
    return cams
CAMS = build_cams()

# ---- le dessin
def tx_(c, x, y):   # monde -> pixels de la carte (avant sur-échantillonnage)
    cx, cy, s = c
    return MW / 2 + (x - cx) * s, MH / 2 + (y - cy) * s

def bezier(p0, p1, bend, n=36):
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2; dx, dy = p1[0] - p0[0], p1[1] - p0[1]; L = math.hypot(dx, dy) or 1
    c = (mx - dy / L * bend * L, my + dx / L * bend * L)
    return [((1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1]) for u in (i / n for i in range(n + 1))]

def draw_text(d, xy, s, size, fill, bold=False, anchor='lm', halo=None):
    kw = {'stroke_width': int(4 * S), 'stroke_fill': halo} if halo else {}
    d.text((xy[0] * S, xy[1] * S), s, font=font(size, bold), fill=fill, anchor=anchor, **kw)

def rrect(d, x0, y0, x1, y1, r, fill):
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], r * S, fill=fill)

def draw_map(img, t, cam):
    layer = Image.new('RGB', (MW * S, MH * S), MAPBG)
    d = ImageDraw.Draw(layer)
    s = cam[2]
    rpx = max(7, min(22, 0.3 * SPACING * s)) * 0.8 * 1.0
    # arêtes
    for n in NODES[1:]:
        p = clamp((t - n['t']) / EDGE_T)
        if p <= 0: continue
        par = NODES[n['parent']]
        a, b = tx_(cam, par['x'], par['y']), tx_(cam, n['x'], n['y'])
        pts = bezier(a, b, n['bend'])[: max(2, int(36 * out_cubic(p)) + 1)]
        d.line([(x * S, y * S) for x, y in pts], fill=COLORS[n['b'] % len(COLORS)], width=int(3 * S), joint='curve')
    # bouts de branche actuels
    tips = {}
    for n in NODES:
        if node_time(n) <= t: tips[n['b']] = n['i']
    # ronds
    for n in NODES:
        pop = out_back(seg(t, node_time(n), node_time(n) + POP_T), 1.8)
        if pop <= 0.02: continue
        x, y = tx_(cam, n['x'], n['y']); isroot = n['b'] < 0; istip = tips.get(n['b']) == n['i'] and not isroot
        r = rpx * (1.25 if (isroot or istip) else 1) * pop
        col = INK if isroot else COLORS[n['b'] % len(COLORS)]
        d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=INK if (isroot or istip) else MAPBG, outline=col, width=int((3.5 if istip else 2.5) * S))
    # noms : bouts de branche et départ d'abord, puis les plus récents, seulement s'il y a la place
    boxes = []
    order = sorted([n for n in NODES if node_time(n) + 0.15 <= t], key=lambda n: (-(n['b'] < 0 or tips.get(n['b']) == n['i']), -n['i']))
    for n in order:
        x, y = tx_(cam, n['x'], n['y']); isroot = n['b'] < 0; istip = tips.get(n['b']) == n['i']
        if not (8 < x < MW - 8 and 8 < y < MH - 8): continue
        txt = n['title'] if len(n['title']) <= 22 else n['title'][:21] + '…'
        size = 21 if (isroot or istip) else 18
        w = ImageFont.truetype(MENLO, size).getlength(txt)
        r = rpx * (1.25 if (isroot or istip) else 1)
        by = y + ((r + 20) if n['i'] % 2 else -(r + 6))
        placed = False
        for side in (1, -1):
            off = r + 7
            x0 = x + off if side > 0 else x - off - w; x1 = x0 + w
            box = (x0 - 2, by - 14, x1 + 2, by + 6)
            if box[0] < 4 or box[2] > MW - 4 or box[1] < 2 or box[3] > MH - 2: continue
            if any(box[0] < b[2] and box[2] > b[0] and box[1] < b[3] and box[3] > b[1] for b in boxes): continue
            if any(abs(ox - (box[0] + box[2]) / 2) < (box[2] - box[0]) / 2 + rpx and abs(oy - (box[1] + box[3]) / 2) < 12 + rpx
                   for ox, oy in (tx_(cam, o['x'], o['y']) for o in NODES if o is not n and node_time(o) <= t)): continue
            col = INK
            alpha = clamp((t - node_time(n) - 0.15) / 0.3)
            draw_text(d, ((x + off) if side > 0 else (x - off), by), txt, size, mix(MAPBG, col, alpha), bold=(isroot or istip),
                      anchor='lm' if side > 0 else 'rm', halo=MAPBG)
            boxes.append(box); placed = True; break
    mask = Image.new('L', (MW * S, MH * S), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, MW * S - 1, MH * S - 1], 30 * S, fill=255)
    img.paste(layer, (MX0 * S, MY0 * S), mask)

# le journal : les derniers sauts, avec un point de la couleur de la branche
EVENTS = sorted([(n['t'], n) for n in NODES[1:]], key=lambda e: e[0])

def draw_panel(d, t):
    slide = 1 - out_cubic(seg(t, 1.7, 2.4)) + out_cubic(seg(t, T_END, T_END + 0.5))
    oy = slide * 260
    if oy > 250: return
    rrect(d, PX0, PY0 + oy, PX1, PY1 + oy, 28, PANEL)
    done = [e for e in EVENTS if e[0] <= t][-4:][::-1]
    for k, (te, n) in enumerate(done):
        st = n['step']; y = PY0 + 34 + k * 46 + oy
        a = clamp((t - te) / 0.25) * [1, .78, .55, .38][k]
        slide_in = (1 - out_cubic(clamp((t - te) / 0.25))) * 14 if k == 0 else 0
        col = mix(PANEL, COLORS[n['b'] % len(COLORS)], a)
        d.ellipse([(PX0 + 30) * S, (y - 8 + slide_in) * S, (PX0 + 46) * S, (y + 8 + slide_in) * S], fill=col)
        right = f"tirage n°{st['pick']}/{st['n']}"
        rw = ImageFont.truetype(MENLO, 20).getlength(right)
        room = (PX1 - 28 - rw - 24) - (PX0 + 62)          # la place qui reste à gauche du « tirage »
        f25 = ImageFont.truetype(MENLO, 25)
        ell = lambda x, m: x if len(x) <= m else x[:m - 1].rstrip() + '…'
        for m in range(40, 5, -1):   # on raccourcit les deux titres jusqu'à ce que ça tienne
            left = f"{ell(st['from'], m)} → {ell(st['to'], m)}"
            if f25.getlength(left) <= room: break
        draw_text(d, (PX0 + 62, y + slide_in), left, 25, mix(PANEL, INK, a), anchor='lm')
        draw_text(d, (PX1 - 28, y + slide_in), right, 20, mix(PANEL, MUTED, a), anchor='rm')

def draw_title(d, t):
    a = out_cubic(seg(t, 0.0, 0.6)); b = out_back(seg(t, 0.05, 0.85), 1.9)
    # lettres espacées
    label = 'DAY 04  /  DEVTOBER'; x = W / 2 - (sum(ImageFont.truetype(MENLO, 26).getlength(c) + 7 for c in label) - 7) / 2
    for c in label:
        draw_text(d, (x, 58), c, 26, mix(BG, INK, a * 0.85), anchor='lm'); x += ImageFont.truetype(MENLO, 26).getlength(c) + 7
    draw_text(d, (W / 2, 160 - (1 - b) * 60), 'Drift', 170, mix(BG, INK, clamp(b * 1.4)), bold=True, anchor='mm')
    draw_text(d, (W / 2, 262), 'plusieurs dériveurs, un seul point de départ', 28, mix(BG, INK, out_cubic(seg(t, 0.6, 1.3)) * 0.88), anchor='mm')

def draw_end(d, t, ends, meet):
    u = out_cubic(seg(t, T_END + 0.15, T_END + 0.85))
    if u <= 0: return
    oy = (1 - u) * 80
    draw_text(d, (W / 2, 858 + oy), 'Même départ, destins différents.', 40, mix(BG, INK, u), bold=True, anchor='mm')
    draw_text(d, (W / 2, 905 + oy), f"{N} dériveurs · {ends} endroits différents" + (f" · {meet} recroisement" + ('s' if meet > 1 else '') if meet else ''), 26, mix(BG, INK, u * 0.9), anchor='mm')
    bx0, bx1, by0, by1 = W / 2 - 260, W / 2 + 260, 934 + oy, 996 + oy
    rrect(d, bx0, by0, bx1, by1, 31, mix(BG, INK, u))
    draw_text(d, (W / 2, (by0 + by1) / 2), 'Dériver dans Wikipédia', 28, BG, bold=True, anchor='mm')
    draw_text(d, (W / 2, 1030 + oy), 'zaderlyl.github.io/DevTober  ·  #devtober', 23, mix(BG, INK, u * 0.85), anchor='mm')

def stats():
    ends = len({(br['steps'][-1]['to'] if br['steps'] else DATA['start']) for br in DATA['branches']})
    seen = {}
    for b, br in enumerate(DATA['branches']):
        for st in br['steps']: seen.setdefault(st['to'], set()).add(b)
    meet = sum(1 for k, v in seen.items() if len(v) > 1 and k != DATA['start'])
    return ends, meet
ENDS, MEET = stats()

def frame(k):
    t = k / FPS
    img = Image.new('RGB', (W * S, H * S), BG)
    d = ImageDraw.Draw(img)
    draw_title(d, t)
    if t > 0.9: draw_map(img, t, CAMS[min(k, len(CAMS) - 1)])
    d = ImageDraw.Draw(img)
    draw_panel(d, t)
    draw_end(d, t, ENDS, MEET)
    return img.resize((W, H), Image.LANCZOS)

def _job(args):
    k, out = args
    frame(k).save(os.path.join(out, f'f{k:04d}.png'))

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-1500:])

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--still':
        frame(int(float(sys.argv[2]) * FPS)).save(os.path.join(HERE, 'still.png')); print('still.png'); sys.exit()
    out = tempfile.mkdtemp(prefix='drift-frames-')
    n = int(DURATION * FPS)
    with Pool() as p: p.map(_job, [(k, out) for k in range(n)], chunksize=6)
    src = ['-framerate', str(FPS), '-i', os.path.join(out, 'f%04d.png')]
    run(['ffmpeg', '-y', '-v', 'error', *src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', os.path.join(HERE, 'drift.mp4')])
    vf = 'fps=15,scale=600:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
    run(['ffmpeg', '-y', '-v', 'error', *src, '-vf', vf, '-loop', '0', os.path.join(HERE, 'drift.gif')])
    print('frames :', out, f'({n} images)')
