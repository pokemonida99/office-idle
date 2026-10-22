"""v1.3 圖示：work/gen/hicons.png（3×2）→ art/ui/resume.webp、dept_<dept>.webp（去背、高 96）
用法: python3 tools/hero_icons.py
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cut import cut
from hero_cut import fgmask

ROOT = os.path.join(os.path.dirname(__file__), '..')
NAMES = ['resume', 'dept_design', 'dept_cs', 'dept_eng', 'dept_sales', 'dept_admin']
im = Image.open(os.path.join(ROOT, 'work/gen/hicons.png')).convert('RGB')
m = fgmask(im)
W, H = im.size

def gap(lo, hi, vertical):
    """lo～hi 之間前景最少的線"""
    best = None
    for i in range(lo, hi, 2):
        box = (i, 0, i + 1, H) if vertical else (0, i, W, i + 1)
        c = sum(1 for v in m.crop(box).getdata() if v)
        if best is None or c < best[0]: best = (c, i)
    return best[1]

xs = [0, gap(W // 3 - W // 10, W // 3 + W // 10, True), gap(2 * W // 3 - W // 10, 2 * W // 3 + W // 10, True), W]
ys = [0, gap(H // 2 - H // 8, H // 2 + H // 8, False), H]
os.makedirs(os.path.join(ROOT, 'work/gen/hero_cells'), exist_ok=True)
k = 0
for r in range(2):
    for c in range(3):
        cell = im.crop((xs[c], ys[r], xs[c + 1], ys[r + 1]))
        p = os.path.join(ROOT, 'work/gen/hero_cells', NAMES[k] + '.png'); cell.save(p)
        print(NAMES[k], cut(p, os.path.join(ROOT, 'art/ui', NAMES[k] + '.webp'), 96)); k += 1
