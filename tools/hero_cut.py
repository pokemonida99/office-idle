"""v1.3 同事圖：work/gen/hg_XX.png（2×2 四人）、hs_<id>.png（單張）→ art/hero/<id>.webp（高 420）＋ art/hero/face/<id>.webp（128×128）
用法: python3 tools/hero_cut.py [-f] [名稱...]   （不給名稱就處理 hero_groups.json 裡已生好的全部；已存在就跳過，-f 重做）
      python3 tools/hero_cut.py --legacy        （把 art/char 原本四人複製到 art/hero 並裁頭像）
"""
import json, os, sys
from PIL import Image, ImageChops
sys.path.insert(0, os.path.dirname(__file__))
from cut import cut

ROOT = os.path.join(os.path.dirname(__file__), '..')
P = lambda *a: os.path.join(ROOT, *a)
CELL = P('work/gen/hero_cells')
# 自動找臉失敗的手動修正：{id: [cx, cy]}（以全身圖高度為單位的絕對位置）
FIXF = P('tools/hero_face_fix.json')
FIX = json.load(open(FIXF)) if os.path.exists(FIXF) else {}
H = 420


def fgmask(im):
    r, g, b = im.convert('RGB').split()
    k = ImageChops.subtract(g, ImageChops.lighter(r, b))
    return k.point(lambda v: 0 if v > 35 else 255)


def best_split(mask, horizontal):
    """在中間 30%～70% 找前景最少的一條線"""
    m = mask.resize((mask.width // 4, mask.height // 4))
    w, h = m.size
    px = m.load()
    n = h if horizontal else w
    best = None
    for i in range(int(n * 0.3), int(n * 0.7)):
        if horizontal:
            c = sum(1 for x in range(w) if px[x, i])
        else:
            c = sum(1 for y in range(h) if px[i, y])
        d = abs(i - n / 2)
        if best is None or (c, d) < best[:2]:
            best = (c, d, i)
    return best[2] * 4, best[0]


def split4(src):
    im = Image.open(src).convert('RGB')
    mask = fgmask(im)
    xs, cx = best_split(mask, False)
    cells, warn = [], []
    if cx: warn.append(f'直線切到 {cx} 點')
    for x0, x1 in ((0, xs), (xs, im.width)):
        half = mask.crop((x0, 0, x1, im.height))
        ys, cy = best_split(half, True)
        if cy: warn.append(f'橫線切到 {cy} 點')
        for y0, y1 in ((0, ys), (ys, im.height)):
            cells.append(im.crop((x0, y0, x1, y1)))
    # 順序：左上、右上、左下、右下
    return [cells[0], cells[2], cells[1], cells[3]], warn


def face(src, dst, over=None):
    """找臉：眼睛＝被膚色包圍的深色像素，取最密集的一團當眼睛中心，往下一點當臉中心，裁正方形"""
    im = Image.open(src).convert('RGBA')
    W, Hh = im.size
    px = im.load()
    Y = int(Hh * 0.55)
    skin = [[False] * W for _ in range(Y)]
    dark = []
    for y in range(Y):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 200: continue
            if r > 225 and 165 < g < 240 and 125 < b < 220 and 12 <= r - g <= 70 and 8 <= g - b <= 50:
                skin[y][x] = True
            elif r + g + b < 330:
                dark.append((x, y))
    def near(x, y, dx, dy):
        x1, y1 = x + dx, y + dy
        return 0 <= x1 < W and 0 <= y1 < Y and skin[y1][x1]
    eyes = []
    for x, y in dark:
        below = any(near(x, y, 0, d) for d in range(3, 26, 3))
        side = any(near(x, y, d, 0) for d in range(3, 30, 3)) and any(near(x, y, -d, 0) for d in range(3, 30, 3))
        if below and side:
            eyes.append((x, y))
    side = round(Hh * 0.37)
    if len(eyes) > 40:
        C = 16; hist = {}
        for x, y in eyes:
            k = (x // C, y // C); hist[k] = hist.get(k, 0) + 1
        best = max(hist, key=lambda k: sum(hist.get((k[0] + i, k[1] + j), 0) for i in range(-2, 3) for j in range(-1, 2)))
        bx, by = best[0] * C + C // 2, best[1] * C + C // 2
        sel = [(x, y) for x, y in eyes if abs(x - bx) < Hh * 0.12 and abs(y - by) < Hh * 0.06]
        cx = sum(x for x, _ in sel) / len(sel)
        cy = sum(y for _, y in sel) / len(sel) + Hh * 0.025
    else:  # 找不到（機器人等）：頭部約在上方 23%
        cx, cy = W / 2, Hh * 0.23
    if over:  # 手動指定臉中心 [cx, cy]（以高度為單位）
        cx, cy = over[0] * Hh, over[1] * Hh
    cx, cy = round(cx), round(cy)
    box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.paste(im.crop(box), (0, 0))
    out = out.resize((128, 128), Image.LANCZOS)
    out.save(dst, 'WEBP', quality=88, method=6)
    return len(eyes)


def main():
    args = sys.argv[1:]
    force = '-f' in args
    args = [a for a in args if a != '-f']
    os.makedirs(CELL, exist_ok=True)
    os.makedirs(P('art/hero/face'), exist_ok=True)
    if args == ['--faces']:  # 只重裁頭像
        for f in sorted(os.listdir(P('art/hero'))):
            if f.endswith('.webp'):
                i = f[:-5]; face(P('art/hero', f), P('art/hero/face', f), FIX.get(i))
        return
    if args == ['--legacy']:
        for n in ('mi', 'jie', 'kui', 'vivi'):
            Image.open(P('art/char', n + '.webp')).save(P('art/hero', n + '.webp'), 'WEBP', quality=88, method=6)
            face(P('art/hero', n + '.webp'), P('art/hero/face', n + '.webp'))
            print('legacy', n)
        return
    groups = json.load(open(P('work/prompts/hero_groups.json')))
    names = args or sorted(groups)
    for name in names:
        src = P('work/gen', name + '.png')
        ids = groups[name]
        if not os.path.exists(src):
            continue
        if not force and all(os.path.exists(P('art/hero', i + '.webp')) for i in ids):
            continue
        if len(ids) == 4:
            cells, warn = split4(src)
        else:
            cells, warn = [Image.open(src).convert('RGB')], []
        for i, c in zip(ids, cells):
            cp = os.path.join(CELL, i + '.png')
            c.save(cp)
            size = cut(cp, P('art/hero', i + '.webp'), H)
            face(P('art/hero', i + '.webp'), P('art/hero/face', i + '.webp'), FIX.get(i))
            print(name, i, size, ' '.join(warn))


if __name__ == '__main__':
    main()
