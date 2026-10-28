"""Draw the app icons (provenance: authored geometry, no source images). Run: python3 -I scripts/make-icons.py
The mark: a frame-green field, one pale slot, its brass label plate, and the vermilion tab pushed out
past the slot's right edge - the app's signature, at icon scale."""
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent.parent / 'ferry' / 'public' / 'icons'
FRAME, SLOT, BRASS, TAB, SHADOW = '#1f4a44', '#f7f8f4', '#c9a452', '#c93a22', '#173a35'

def draw(size, maskable=False, rounded=False):
    s = 4  # supersample
    W = size * s
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.22), fill=FRAME)
    else:
        d.rectangle([0, 0, W, W], fill=FRAME)
    pad = 0.2 if maskable else 0.12           # maskable keeps the mark inside the safe circle
    x0, x1 = W * (pad + 0.02), W * (1 - pad - 0.1)
    for i, y in enumerate((0.30, 0.52)):
        y0, y1 = W * y, W * (y + 0.16)
        d.rounded_rectangle([x0, y0 + W * 0.012, x1, y1 + W * 0.012], radius=W * 0.03, fill=SHADOW)
        d.rounded_rectangle([x0, y0, x1, y1], radius=W * 0.03, fill=SLOT)
        d.rounded_rectangle([x0 + W * 0.04, y0 + W * 0.045, x0 + W * 0.17, y1 - W * 0.045], radius=W * 0.008, fill=BRASS)
        if i == 0:  # the waiting one pushes its tab out past the edge
            d.rounded_rectangle([x1 - W * 0.09, y0 + W * 0.035, x1 + W * 0.07, y1 - W * 0.035], radius=W * 0.02, fill=TAB)
    d.rounded_rectangle([x0, W * 0.74, x1, W * 0.80], radius=W * 0.02, fill='#2a5d56')
    return im.resize((size, size), Image.LANCZOS)

OUT.mkdir(parents=True, exist_ok=True)
draw(192).save(OUT / 'icon-192.png')
draw(512).save(OUT / 'icon-512.png')
draw(512, maskable=True).save(OUT / 'icon-maskable-512.png')
draw(180).convert('RGB').save(OUT / 'apple-touch-icon.png')
draw(64, rounded=True).save(OUT / 'favicon.png')
print('icons written to', OUT)
