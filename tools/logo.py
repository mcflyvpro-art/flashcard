#!/usr/bin/env python3
"""Le logo de Folio, tracé à partir de sa géométrie (et non détouré d'une image).

Trois livres reliés empilés, vus de trois quarts : crème en haut (avec son
étiquette sombre), gris au milieu, presque noir en bas — le dessin de
public/icons/icon-512.png, redessiné droit. Chaque livre est un volume posé
dans un repère 3D (x : du dos à la tranche, y : de la tête à la queue,
z : l'épaisseur), projeté sur l'écran par trois vecteurs ; le dos est un
vrai demi-cylindre (son contour est l'enveloppe convexe de ses deux
profils), la couverture l'enveloppe en « C » vue à la queue, et le bloc des
pages est en retrait. Tout ce qui doit être parallèle l'est, par
construction.

Sorties :
  public/site/logo.svg   la marque seule, fond transparent (page d'accueil)
  public/site/icone.svg  la marque sur son carré crème arrondi (512 × 512)
  public/favicon.svg     le même carré, sans les feuillets (16-32 px)
Lancer : python3 tools/logo.py
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def vec(deg, k=1.0):
    a = math.radians(deg)
    return (math.cos(a) * k, math.sin(a) * k)


# La largeur (dos → tranche) monte vers la droite, la longueur (tête →
# queue) descend vers la droite, l'épaisseur monte droit.
EX = vec(-19.0)
EY = vec(31.0)
EZ = (0.0, -1.0)

W, L, T = 192.0, 164.0, 70.0    # largeur, longueur, épaisseur d'un livre
PLAT = 8.5                      # épaisseur de la couverture
DEBORD = 5.0                    # la couverture dépasse des pages (tranche)
RENTRE = 5.0                    # les pages sont en retrait à la queue
DOS = 15.0                      # le dos bombe de tant vers x < 0
R_COIN = 14.0                   # arrondi des coins de la couverture
N = 24                          # points par profil de dos


def P(x, y, z, o=(0.0, 0.0)):
    return (o[0] + x * EX[0] + y * EY[0] + z * EZ[0],
            o[1] + x * EX[1] + y * EY[1] + z * EZ[1])


def f(v):
    s = f'{v:.1f}'
    if s == '-0.0':
        s = '0.0'
    return s[:-2] if s.endswith('.0') else s


def pt(p):
    return f'{f(p[0])} {f(p[1])}'


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def poly(pts):
    return 'M ' + ' L '.join(pt(p) for p in pts) + ' Z'


def arrondi(pts, rayons):
    """Polygone aux coins arrondis, arrondis pris sur les arêtes projetées."""
    n = len(pts)
    out = []
    for i in range(n):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
        r = rayons[i] if isinstance(rayons, (list, tuple)) else rayons
        cmd = 'M' if i == 0 else 'L'
        if r <= 0:
            out.append(f'{cmd} {pt(b)}')
            continue
        p1 = lerp(b, a, min(.48, r / dist(a, b)))
        p2 = lerp(b, c, min(.48, r / dist(b, c)))
        out.append(f'{cmd} {pt(p1)} Q {pt(b)} {pt(p2)}')
    return ' '.join(out) + ' Z'


def enveloppe(points):
    """Enveloppe convexe (chaîne monotone d'Andrew)."""
    pts = sorted(set((round(x, 3), round(y, 3)) for x, y in points))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    bas, haut = [], []
    for p in pts:
        while len(bas) >= 2 and cross(bas[-2], bas[-1], p) <= 0:
            bas.pop()
        bas.append(p)
    for p in reversed(pts):
        while len(haut) >= 2 and cross(haut[-2], haut[-1], p) <= 0:
            haut.pop()
        haut.append(p)
    return bas[:-1] + haut[:-1]


def profil_ext(t):
    """Le dos vu en coupe (x, z), du haut (0, t) au bas (0, 0), bombé vers -x."""
    return [(-DOS * math.sin(math.pi * k / N), t / 2 + t / 2 * math.cos(math.pi * k / N))
            for k in range(N + 1)]


def profil_int(t):
    """L'intérieur de la couverture au dos : le même, épaissi de PLAT."""
    return [(PLAT * .25 - (DOS - PLAT) * math.sin(math.pi * k / N),
             t / 2 + (t / 2 - PLAT) * math.cos(math.pi * k / N)) for k in range(N + 1)]


def livre(o, c, uid, t=T, detail=True, etiquette=False):
    """Un livre posé à l'origine écran `o`, de couleurs `c`."""
    g = []

    def Q(x, z, y=L):
        return P(x, y, z, o)

    # ---- le dos : un demi-cylindre le long de y ------------------------
    ext = profil_ext(t)
    contour = enveloppe([P(x, 0, z, o) for x, z in ext] + [P(x, L, z, o) for x, z in ext]
                        + [P(0, 0, t, o), P(0, L, t, o), P(0, 0, 0, o), P(0, L, 0, o)])
    a, b = P(0, L / 2, t, o), P(-DOS, L / 2, t * .15, o)
    g.append(f'<linearGradient id="dos-{uid}" gradientUnits="userSpaceOnUse" '
             f'x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}">'
             f'<stop offset="0" stop-color="{c["dos"][0]}"/><stop offset=".55" stop-color="{c["dos"][1]}"/>'
             f'<stop offset="1" stop-color="{c["dos"][2]}"/></linearGradient>')
    g.append(f'<path d="{poly(contour)}" fill="url(#dos-{uid})"/>')

    # ---- la queue : la couverture en « C » autour des pages -------------
    inte = profil_int(t)
    c_ext = ([Q(W, t)] + [Q(x, z) for x, z in ext] + [Q(W, 0)])
    c_int = ([Q(W, PLAT)] + [Q(x, z) for x, z in reversed(inte)] + [Q(W, t - PLAT)])
    # le creux (l'intérieur des plats, dans l'ombre), puis la couverture
    creux = [Q(x, z) for x, z in inte] + [Q(W - DEBORD, PLAT), Q(W - DEBORD, t - PLAT)]
    xr = W - DEBORD + RENTRE * EY[0] / EX[0]
    creux = [Q(x, z) for x, z in inte] + [Q(xr - 8, PLAT), Q(xr - 8, t - PLAT)]
    g.append(f'<path d="{poly(creux)}" fill="{c["creux"]}"/>')
    # les pages, en retrait : décalées vers la tête
    yb = L - RENTRE
    pg = ([P(x + .8, yb, z, o) for x, z in inte[N // 2:]] + [P(xr + 1, yb, PLAT + .6, o),
          P(xr + 1, yb, t - PLAT - .6, o)] + [P(x + .8, yb, z, o) for x, z in inte[:N // 2]])
    a, b = P(0, yb, t / 2, o), P(W, yb, t / 2, o)
    g.append(f'<linearGradient id="pg-{uid}" gradientUnits="userSpaceOnUse" '
             f'x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}">'
             f'<stop offset="0" stop-color="#E9E3D7"/><stop offset=".18" stop-color="#F8F5EE"/>'
             f'<stop offset="1" stop-color="#F3EFE6"/></linearGradient>')
    g.append(f'<path d="{poly(pg)}" fill="url(#pg-{uid})"/>')
    if detail:
        for k in range(1, 5):
            z = PLAT + (t - 2 * PLAT) * k / 5
            x0 = PLAT * .25 - (DOS - PLAT) * math.sin(math.acos(max(-1, min(1, (z - t / 2) / (t / 2 - PLAT))))) + 2.5
            g.append(f'<path d="M {pt(P(x0, yb, z, o))} L {pt(P(xr - .6, yb, z, o))}" '
                     f'stroke="#E6E0D4" stroke-width=".9" fill="none"/>')
    # l'ombre du plat du haut sur les pages
    om = [P(PLAT * .5, yb, t - PLAT - .6, o), P(xr, yb, t - PLAT - .6, o),
          P(xr, yb, t - PLAT - 4.5, o), P(PLAT * .5, yb, t - PLAT - 4.5, o)]
    g.append(f'<path d="{poly(om)}" fill="#3B342A" opacity=".07"/>')
    # la couverture vue par la queue, d'un seul tenant : plat du haut, dos,
    # plat du bas ; les bouts des plats arrondis
    a, b = Q(0, t), Q(0, 0)
    g.append(f'<linearGradient id="c-{uid}" gradientUnits="userSpaceOnUse" '
             f'x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}">'
             f'<stop offset="0" stop-color="{c["coupe"][0]}"/><stop offset="1" stop-color="{c["coupe"][1]}"/>'
             f'</linearGradient>')
    cpts = c_ext + c_int
    rayons = [0] * len(cpts)
    rayons[0] = rayons[len(c_ext) - 1] = 2.6
    rayons[len(c_ext)] = rayons[-1] = 1.4
    g.append(f'<path d="{arrondi(cpts, rayons)}" fill="url(#c-{uid})"/>')

    # ---- la couverture (dessus) -----------------------------------------
    cov = [P(0, 0, t, o), P(W, 0, t, o), P(W, L, t, o), P(0, L, t, o)]
    a, b = P(0, 0, t, o), P(W, L, t, o)
    g.append(f'<linearGradient id="cv-{uid}" gradientUnits="userSpaceOnUse" '
             f'x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}">'
             f'<stop offset="0" stop-color="{c["cou"][0]}"/><stop offset="1" stop-color="{c["cou"][1]}"/>'
             f'</linearGradient>')
    g.append(f'<path d="{arrondi(cov, [R_COIN * .9, R_COIN, 3, 2])}" fill="url(#cv-{uid})"/>')
    # le pli du dos : un reflet le long de l'arête
    pli = [P(5, 7, t, o), P(12, 7, t, o), P(12, L - 4, t, o), P(5, L - 4, t, o)]
    g.append(f'<path d="{arrondi(pli, 3)}" fill="{c["pli"]}" opacity=".5"/>')
    # un filet de lumière sur l'arête avant de la couverture
    g.append(f'<path d="M {pt(P(16, L - .6, t, o))} L {pt(P(W - R_COIN * .7, L - .6, t, o))}" '
             f'stroke="{c["pli"]}" stroke-width="1.2" stroke-linecap="round" opacity=".7" fill="none"/>')
    if etiquette:
        g.extend(etiquette_de(o, t, uid))
    return g


def etiquette_de(o, t=T, uid='clair'):
    """L'étiquette sombre au milieu de la couverture du livre du haut."""
    g = []
    if True:
        cx, cy, s = W * .54, L * .42, 74.0
        et = [P(cx - s / 2, cy - s * .44, t, o), P(cx + s / 2, cy - s * .44, t, o),
              P(cx + s / 2, cy + s * .44, t, o), P(cx - s / 2, cy + s * .44, t, o)]
        a, b = et[0], et[2]
        g.append(f'<linearGradient id="et-{uid}" gradientUnits="userSpaceOnUse" '
                 f'x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}">'
                 f'<stop offset="0" stop-color="#5A5652"/><stop offset="1" stop-color="#3B3835"/>'
                 f'</linearGradient>')
        g.append(f'<path class="etiquette" d="{arrondi(et, 8)}" fill="url(#et-{uid})"/>')
    return g


COULEURS = {
    'clair': {'cou': ('#FCFAF6', '#ECE7DE'), 'dos': ('#F3EFE7', '#E2DCD1', '#CFC7BA'),
              'coupe': ('#D8D1C4', '#BDB5A7'), 'creux': '#B3AB9D', 'pli': '#FFFFFF'},
    'gris': {'cou': ('#8D8983', '#75716B'), 'dos': ('#85817B', '#6C6863', '#55524E'),
             'coupe': ('#7A766F', '#5E5A55'), 'creux': '#4A4743', 'pli': '#A9A59F'},
    'noir': {'cou': ('#403E3B', '#2C2B29'), 'dos': ('#393735', '#262524', '#171615'),
             'coupe': ('#33312F', '#1E1D1C'), 'creux': '#121110', 'pli': '#64605B'},
}

PILE = [('noir', (-9.0, 3.0)), ('gris', (-4.5, 1.5)), ('clair', (0.0, 0.0))]


def marque(detail=True):
    """Les trois livres ; rend (corps, boîte englobante)."""
    corps, xs, ys = [], [], []
    for i, (k, (dx, dy)) in enumerate(PILE):
        o = P(dx, dy, i * T)
        parts = livre(o, COULEURS[k], k, detail=detail, etiquette=(k == 'clair'))
        corps.append(f'<g class="livre livre-{k}">' + ''.join(parts) + '</g>')
        for x in (-DOS, W):
            for y in (0, L):
                for z in (0, T):
                    p = P(x, y, z, o)
                    xs.append(p[0])
                    ys.append(p[1])
    return ''.join(corps), (min(xs), min(ys), max(xs), max(ys))


def ecrire(nom, contenu):
    os.makedirs(os.path.dirname(nom), exist_ok=True)
    with open(nom, 'w', encoding='utf8') as fh:
        fh.write(contenu + '\n')


OMBRE = ('<filter id="flou" x="-30%" y="-300%" width="160%" height="700%">'
         '<feGaussianBlur stdDeviation="{s}"/></filter>')


def svg_marque():
    corps, (x0, y0, x1, y1) = marque()
    m = 8
    vb = f'{f(x0 - m)} {f(y0 - m)} {f(x1 - x0 + 2 * m)} {f(y1 - y0 + 2 * m + 8)}'
    cx = P(W * .5 - 6, L * .55, 0)
    ombre = (f'<ellipse cx="{f(cx[0])}" cy="{f(y1 - 2)}" rx="{f((x1 - x0) * .44)}" ry="8" '
             f'fill="#1D1C19" opacity=".14" filter="url(#flou)"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Folio">'
            f'<defs>{OMBRE.format(s=6)}</defs>{ombre}{corps}</svg>')


def svg_icone(detail=True, remplir=362):
    corps, (x0, y0, x1, y1) = marque(detail)
    w, h = x1 - x0, y1 - y0
    k = remplir / max(w, h)
    tx = 256 - (x0 + w / 2) * k
    ty = 260 - (y0 + h / 2) * k
    fond = ('<linearGradient id="fond" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#FAF7F0"/><stop offset="1" stop-color="#EEE9DF"/></linearGradient>'
            '<radialGradient id="halo" cx=".78" cy=".1" r=".8">'
            '<stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/>'
            '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>')
    ombre = (f'<ellipse cx="{f(256 + 4)}" cy="{f(ty + y1 * k - 3)}" rx="{f(w * k * .42)}" ry="11" '
             f'fill="#1D1C19" opacity=".18" filter="url(#flou)"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
            f'<defs>{fond}{OMBRE.format(s=8)}</defs>'
            f'<rect width="512" height="512" rx="114" fill="url(#fond)"/>'
            f'<rect width="512" height="512" rx="114" fill="url(#halo)"/>'
            f'{ombre}<g transform="translate({f(tx)} {f(ty)}) scale({k:.4f})">{corps}</g></svg>')


def sprite():
    """Pour la page d'accueil : chaque livre et l'étiquette en <g id>, et
    la marque entière en <symbol id="logo"> ; l'en-tête et le pied la
    reprennent d'un <use>, le héros pose les livres un par un (un <use>
    chacun, animé). Rend (le SVG caché, la viewBox de la marque)."""
    _, (x0, y0, x1, y1) = marque()
    m = 8
    vb = f'{f(x0 - m)} {f(y0 - m)} {f(x1 - x0 + 2 * m)} {f(y1 - y0 + 2 * m)}'
    groupes = []
    for i, (k, (dx, dy)) in enumerate(PILE):
        o = P(dx, dy, i * T)
        groupes.append(f'<g id="livre-{k}">' + ''.join(livre(o, COULEURS[k], k)) + '</g>')
        if k == 'clair':
            groupes.append('<g id="etiquette">' + ''.join(etiquette_de(o)) + '</g>')
    logo = (f'<symbol id="logo" viewBox="{vb}"><use href="#livre-noir"/><use href="#livre-gris"/>'
            f'<use href="#livre-clair"/><use href="#etiquette"/></symbol>')
    return (f'<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">'
            f'<defs>{"".join(groupes)}{logo}</defs></svg>'), vb


def injecter(page):
    """Réécrit le sprite entre ses deux marqueurs, et la viewBox du héros."""
    import re
    with open(page, encoding='utf8') as fh:
        h = fh.read()
    svg, vb = sprite()
    h, n = re.subn(r'(<!-- logo:debut -->).*?(<!-- logo:fin -->)', lambda mo: mo.group(1) + svg + mo.group(2), h, flags=re.S)
    # le héros garde de la place sous la pile pour son ombre
    x, y, w, hh = (float(v) for v in vb.split())
    vbh = f'{f(x)} {f(y)} {f(w)} {f(hh + 26)}'
    h = re.sub(r'(<svg class="pile"[^>]*?viewBox=")[^"]*(")', lambda mo: mo.group(1) + vbh + mo.group(2), h)
    with open(page, 'w', encoding='utf8') as fh:
        fh.write(h)
    return n


if __name__ == '__main__':
    ecrire(os.path.join(ROOT, 'public', 'site', 'logo.svg'), svg_marque())
    ecrire(os.path.join(ROOT, 'public', 'site', 'icone.svg'), svg_icone())
    # l'onglet d'un navigateur : 16 px, la pile remplit le carré
    ecrire(os.path.join(ROOT, 'public', 'favicon.svg'), svg_icone(detail=False, remplir=440))
    n = injecter(os.path.join(ROOT, 'index.html'))
    print('logo.svg, icone.svg, favicon.svg écrits' + (' ; sprite de index.html à jour' if n else ''))
