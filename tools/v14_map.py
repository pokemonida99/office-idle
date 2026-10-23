"""v1.4 直式地圖（1080 寬、約 2500 高）：GPT 一張最高 1536，所以分兩段生，再接起來
  1. v14_map1a / v14_map2a：下半段（路從下方中央進來、從上方中央出去）
  2. python3 tools/v14_map.py ext 1   → 把下半段上面 40% 放到新畫布底部，上方灰色，生 v14_map1b（往上延伸）
  3. python3 tools/v14_map.py build 1 → 對齊、找最不明顯的接縫、合成 → art/map/week1.webp；抽道路中心線 → art/map/week1.json
"""
import os, sys, json
from PIL import Image, ImageChops, ImageFilter, ImageDraw, ImageStat
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
G = 'work/gen/'
W = 1080
OV = 0.40   # 重疊比例（下半段上方 40%）

STYLE = ('Tall portrait illustrated game world map, top-down view with a slight isometric angle, cute polished anime mobile game style, soft painterly cel shading, clean and readable. '
         'A wide smooth road in a light cream color (about 9 percent of the image width) winds in gentle S-curves through the map; the road is always clearly visible, never hidden behind anything, completely empty: no nodes, no markers, no cars, no people on it. '
         'No text, no letters, no numbers, no signs with writing, no UI, no frame.')
SCENE = {
    1: ('A bright sunny friendly office district. At the very bottom: our small cozy office building with plants and a little cafe. Around the road: cute city streets, a park with trees, a convenience store, a bubble tea shop, a bus stop, crosswalks, small office towers, blue sky reflections. The road enters at the bottom center and leaves at the top center of the image.',
        'Continue the same sunny office district upward: more office towers, a plaza, a river with a small bridge the road crosses, and at the very top the road ends at a plaza in front of a big friendly clock tower glowing in warm sunset light (the Friday finish line).'),
    2: ('A gloomy dark business district of the evil Black Heart Corporation at dusk, red and black color scheme but still readable: dark gray buildings with red glowing windows, red neon lights, smoke from chimneys, barbed fences, surveillance cameras on poles, crows. At the very bottom: a dark iron gate with a cracked black heart emblem where the road enters. The road enters at the bottom center and leaves at the top center of the image.',
        'Continue the same dark red-and-black district upward, getting darker and more ominous: factories, a dark bridge over a red-glowing canal, and at the very top a towering black skyscraper with red glowing windows and a giant glowing red cracked black heart emblem on its top; the road ends at the skyscraper entrance.'),
}


def prompts():
    for i in (1, 2):
        open(f'work/prompts/v14_map{i}a.txt', 'w').write(STYLE + ' Scene: ' + SCENE[i][0])
        r = f'work/prompts/v14_map{i}a.refs'
        if os.path.exists(r): os.remove(r)


def ext(i):
    a = Image.open(G + f'v14_map{i}a.png').convert('RGB')
    w, h = a.size
    k = int(h * OV)
    canvas = Image.new('RGB', (w, h), (128, 128, 128))
    canvas.paste(a.crop((0, 0, w, k)), (0, h - k))
    canvas.save(f'work/gen/v14_map{i}b_in.png')
    t = ('Edit the attached image and return the full image at the same tall portrait size. The bottom part of the attached image is the upper edge of a game world map; the flat gray area above it is empty. '
         f'Keep the bottom {int(OV*100)}% exactly as it is (same position, scale, colors and art style) and paint the empty gray area so the map continues seamlessly upward. '
         'The cream road must continue smoothly from exactly where it touches the top of the existing part and keep winding upward. ' + STYLE + ' Scene: ' + SCENE[i][1])
    open(f'work/prompts/v14_map{i}b.txt', 'w').write(t)
    open(f'work/prompts/v14_map{i}b.refs', 'w').write(f'work/gen/v14_map{i}b_in.png\n')
    print('ext', i)


def build(i):
    A = Image.open(G + f'v14_map{i}a.png').convert('RGB')
    B = Image.open(G + f'v14_map{i}b.png').convert('RGB').resize(A.size, Image.LANCZOS)
    w, h = A.size
    k = int(h * OV)
    # B 的底部 k 高應該等於 A 的頂部 k 高：找最佳縮放／位移
    ref = A.crop((0, 0, w, k))
    best = None
    for s in (0.97, 0.98, 0.99, 1.0, 1.01, 1.02, 1.03):
        Bs = B.resize((round(w * s), round(h * s)), Image.BILINEAR)
        for dx in range(-24, 25, 4):
            for dy in range(-40, 41, 4):
                # B 縮放後放在 (ox, oy)，使 B 底部對齊：B 的 y = h - k 對應 A 的 0
                ox = (w - Bs.width) // 2 + dx
                oy = round((h - k) * s) - dy
                box = (-ox, oy, -ox + w, oy + k)
                if box[0] < 0 or box[2] > Bs.width or box[3] > Bs.height: continue
                d = ImageChops.difference(Bs.crop(box).resize((w // 8, k // 8)), ref.resize((w // 8, k // 8)))
                v = sum(ImageStat.Stat(d).mean)
                if best is None or v < best[0]: best = (v, s, ox, oy)
    v, s, ox, oy = best
    Bs = B.resize((round(w * s), round(h * s)), Image.LANCZOS)
    top = Bs.crop((-ox, 0, -ox + w, oy + k))      # B 從頂端到重疊區底
    H = top.height - k + h
    out = Image.new('RGB', (w, H))
    out.paste(top, (0, 0))
    # 重疊區：找一條左右走向、差異最小的路徑，路徑以上用 B、以下用 A，羽化
    yo = top.height - k
    D = ImageChops.difference(top.crop((0, yo, w, yo + k)), ref).convert('L').resize((w // 4, k // 4)).filter(ImageFilter.GaussianBlur(2))
    px = D.load(); dw, dh = D.size
    lo, hi = int(dh * 0.25), int(dh * 0.85)
    INF = 1e18
    cost = [[INF] * dh for _ in range(dw)]; back = [[0] * dh for _ in range(dw)]
    for y in range(lo, hi): cost[0][y] = px[0, y]
    for x in range(1, dw):
        for y in range(lo, hi):
            by, bv = y, cost[x - 1][y]
            if y > lo and cost[x - 1][y - 1] < bv: by, bv = y - 1, cost[x - 1][y - 1]
            if y < hi - 1 and cost[x - 1][y + 1] < bv: by, bv = y + 1, cost[x - 1][y + 1]
            cost[x][y] = bv + px[x, y]; back[x][y] = by
    y = min(range(lo, hi), key=lambda yy: cost[dw - 1][yy]); path = [0] * dw
    for x in range(dw - 1, -1, -1): path[x] = y; y = back[x][y]
    M = Image.new('L', (dw, dh), 0); dr = ImageDraw.Draw(M)
    for x in range(dw): dr.line([(x, path[x]), (x, dh)], fill=255)
    M = M.resize((w, k), Image.BILINEAR).filter(ImageFilter.GaussianBlur(8))
    out.paste(A, (0, yo))
    blend = Image.composite(ref, top.crop((0, yo, w, yo + k)), M)
    out.paste(blend, (0, yo))
    out = out.resize((W, round(H * W / w)), Image.LANCZOS)
    os.makedirs('art/map', exist_ok=True)
    out.save(f'art/map/week{i}.webp', 'WEBP', quality=70, method=6)
    print(f'week{i}', out.size, f'align s={s} ox={ox} oy={oy} err={v:.1f}', os.path.getsize(f'art/map/week{i}.webp') // 1024, 'KB')
    return out


def road(i, n=60):
    """道路中心線：取路的米色，從下往上追蹤"""
    im = Image.open(f'art/map/week{i}.webp').convert('RGB')
    w, h = im.size
    sm = im.resize((w // 4, h // 4)); px = sm.load(); sw, sh = sm.size
    # 路色：最下方中央附近的亮米色
    cand = [px[x, y] for y in range(sh - 40, sh - 5) for x in range(sw // 2 - 20, sw // 2 + 20)]
    cand.sort(key=lambda c: -(c[0] + c[1] + c[2]))
    rc = cand[len(cand) // 5]
    def isroad(c): return abs(c[0] - rc[0]) + abs(c[1] - rc[1]) + abs(c[2] - rc[2]) < 70
    mask = [[isroad(px[x, y]) for x in range(sw)] for y in range(sh)]
    # 逐列：找連續路段，選離上一點最近、寬度合理的一段；太寬（廣場）不算；連續 40 列找不到就當作路到盡頭
    pts = []; cx = sw / 2; rw = None; miss = 0
    for y in range(sh - 3, 2, -1):
        segs = []; x = 0
        while x < sw:
            if mask[y][x]:
                x0 = x
                while x < sw and mask[y][x]: x += 1
                if x - x0 >= 4: segs.append((x0, x))
            x += 1
        ok = None
        if segs:
            s0 = min(segs, key=lambda s: abs((s[0] + s[1]) / 2 - cx))
            c = (s0[0] + s0[1]) / 2; wd = s0[1] - s0[0]
            if (not pts or abs(c - cx) < sw * 0.03) and wd < sw * 0.22:
                ok = c
        if ok is None:
            miss += 1
            if pts and miss > 40: break
            continue
        miss = 0; cx = ok; pts.append((ok, y))
    # 平滑 x
    sm2 = []
    for k in range(len(pts)):
        win = pts[max(0, k - 6):k + 7]
        sm2.append((sum(p[0] for p in win) / len(win), pts[k][1]))
    pts = sm2
    # 依弧長取 n 點
    L = [0]
    for a, b in zip(pts, pts[1:]): L.append(L[-1] + ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)
    out = []; j = 0
    for k in range(n):
        t = L[-1] * k / (n - 1)
        while j < len(L) - 2 and L[j + 1] < t: j += 1
        a, b = pts[j], pts[j + 1]; f = (t - L[j]) / max(1e-6, L[j + 1] - L[j])
        out.append([round((a[0] + (b[0] - a[0]) * f) / sw, 4), round((a[1] + (b[1] - a[1]) * f) / sh, 4)])
    json.dump(out, open(f'art/map/week{i}.json', 'w'))
    # 檢查圖
    chk = im.resize((w // 2, h // 2)); d = ImageDraw.Draw(chk)
    for k, (x, y) in enumerate(out):
        X, Y = x * chk.width, y * chk.height
        d.ellipse((X - 6, Y - 6, X + 6, Y + 6), fill=(255, 40, 40) if k % 6 == 0 else (40, 120, 255), outline=(255, 255, 255))
    chk.save(f'work/v14_map{i}_check.jpg', quality=80)
    print(f'week{i}.json', len(out), 'road color', rc, 'traced rows', len(pts), '/', sh)


if __name__ == '__main__':
    cmd, nums = sys.argv[1], [int(x) for x in sys.argv[2:]]
    if cmd == 'prompts': prompts()
    for i in nums:
        if cmd == 'ext': ext(i)
        elif cmd == 'build': build(i); road(i)
        elif cmd == 'road': road(i)
