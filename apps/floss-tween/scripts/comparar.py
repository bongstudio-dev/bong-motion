# Compara fixtures/frames/after-*.png con motor-*.png: diferencia media por cuadro y una
# hoja con After | motor | diferencia (amplificada) por fila. Uso: python3 scripts/comparar.py
import sys, glob, os
from PIL import Image, ImageChops, ImageDraw
d = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'frames')
filas = []
for a in sorted(glob.glob(os.path.join(d, 'after-*.png'))):
    t = os.path.basename(a)[6:-4]
    m = os.path.join(d, f'motor-{t}.png')
    if not os.path.exists(m): continue
    A = Image.open(a).convert('RGB'); M = Image.open(m).convert('RGB').resize(A.size)
    D = ImageChops.difference(A, M).convert('L')
    hist = D.histogram(); n = sum(hist)
    media = sum(i * h for i, h in enumerate(hist)) / n
    fuera = sum(hist[40:]) / n * 100
    print(f't={t}  diferencia media {media:.2f}/255  px con diferencia > 40: {fuera:.2f} %')
    filas.append((t, A, M, D.point(lambda v: min(255, v * 4)).convert('RGB')))
if filas:
    w, h = 640, 360
    hoja = Image.new('RGB', (w * 3, h * len(filas)), 'black')
    for i, (t, A, M, D) in enumerate(filas):
        for j, im in enumerate((A, M, D)):
            hoja.paste(im.resize((w, h)), (j * w, i * h))
        ImageDraw.Draw(hoja).text((8, i * h + 8), f't={t}  After | motor | diferencia x4', fill='yellow')
    hoja.save(os.path.join(d, 'comparacion.png'))
    print(os.path.join(d, 'comparacion.png'))
