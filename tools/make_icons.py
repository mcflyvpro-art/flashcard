#!/usr/bin/env python3
"""Génère les icônes PWA depuis logoflashcard.png (racine du repo)."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, 'logoflashcard.png')
im = Image.open(src).convert('RGBA')

# recadrage sur le carré opaque du logo, puis carré parfait
box = im.getchannel('A').point(lambda v: 255 if v > 200 else 0).getbbox()
im = im.crop(box)
w, h = im.size
s = max(w, h)
sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
sq.paste(im, ((s - w) // 2, (s - h) // 2), im)

# couleur de fond = teinte des bords du logo (comble les coins arrondis)
px = im.convert('RGB')
pts = ((w // 2, 6), (6, h // 2), (w - 7, h // 2), (w // 2, h - 7))
BG = tuple(sum(px.getpixel(p)[i] for p in pts) // len(pts) for i in range(3))

def flat(img, size, pad=0.0):
    inner = round(size * (1 - 2 * pad))
    r = img.resize((inner, inner), Image.LANCZOS)
    out = Image.new('RGB', (size, size), BG)
    out.paste(r, ((size - inner) // 2, (size - inner) // 2), r)
    return out

os.makedirs(os.path.join(ROOT, 'icons'), exist_ok=True)
for size, name in ((180, 'icon-180.png'), (192, 'icon-192.png'), (512, 'icon-512.png')):
    flat(sq, size).save(os.path.join(ROOT, 'icons', name))
flat(sq, 512, pad=.10).save(os.path.join(ROOT, 'icons', 'icon-maskable.png'))
print('fond', BG, '- icônes générées depuis', os.path.basename(src))
