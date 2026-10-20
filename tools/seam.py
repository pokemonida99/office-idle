"""背景左右無縫化（只用 Pillow）
做法：
  1. prep：原圖 work/gen/bgN.png 往右捲半張寬 → work/seam/bgN_shift.png
     （捲過之後左右兩邊本來就是原圖中段、天生接得起來；接縫跑到正中間）
  2. 用 GPT 重畫中間那條接縫（tools/run.sh seam_bgN，參考圖就是 bgN_shift.png）→ work/gen/seam_bgN.png
  3. build：GPT 圖對齊回 shift 圖（縮放＋位移搜尋、色彩增益校正），
     在左右兩區各找一條「兩張差異最小」的上下路徑，路徑之間用 GPT 圖、外側用原圖，邊緣羽化
     → art/bg/bgN.webp；並輸出 work/seam/check_bgN.jpg（兩張並排，接縫在正中間）與總表 work/seam_check.jpg
用法:
  python3 tools/seam.py prep
  python3 tools/seam.py build [1 2 3 4 5]
"""
import sys, os
from PIL import Image, ImageChops, ImageFilter, ImageStat, ImageDraw, ImageEnhance

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT_H = 720          # 輸出高度（遊戲以 300 高畫，720 夠清楚）
DS = 4               # 對齊與找路徑用的縮小倍率
FEATHER = 10         # 羽化半徑（全尺寸 px）
# 每張的色調微調（亮度, 飽和度, 對比），讓五張放一起不會差太多
TONE = {1: (0.97, 0.96, 1.0), 2: (0.97, 0.95, 1.0), 3: (1.0, 1.0, 1.0), 4: (1.0, 0.96, 1.0), 5: (1.04, 0.97, 1.0)}


def prep():
    os.makedirs("work/seam", exist_ok=True)
    for i in range(1, 6):
        im = Image.open(f"work/gen/bg{i}.png").convert("RGB")
        ImageChops.offset(im, im.width // 2, 0).save(f"work/seam/bg{i}_shift.png")
        print("shift", i)


def warp(im, s, dx, dy):
    """以中心縮放 s、再位移 (dx,dy)；輸出同尺寸"""
    W, H = im.size
    cx, cy = W / 2, H / 2
    # 反向映射：src = (dst - c - d)/s + c
    a = 1 / s
    return im.transform((W, H), Image.AFFINE, (a, 0, cx - (cx + dx) * a, 0, a, cy - (cy + dy) * a), Image.BILINEAR)


def score(S, G, box):
    d = ImageChops.difference(S.crop(box), G.crop(box))
    return sum(ImageStat.Stat(d).mean)


def align(S, G):
    """在外側 30% 的區域找最好的縮放/位移（縮小圖上暴力搜尋，再細調）"""
    w, h = S.width // DS, S.height // DS
    s_ = S.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1))
    g_ = G.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1))
    boxes = [(int(w * 0.04), int(h * 0.04), int(w * 0.30), int(h * 0.96)),
             (int(w * 0.70), int(h * 0.04), int(w * 0.96), int(h * 0.96))]
    f = lambda s, dx, dy: sum(score(s_, warp(g_, s, dx, dy), b) for b in boxes)
    best = (f(1, 0, 0), 1, 0, 0)
    for s in [0.96, 0.98, 1.0, 1.02, 1.04]:
        for dx in range(-8, 9, 2):
            for dy in range(-8, 9, 2):
                v = f(s, dx, dy)
                if v < best[0]: best = (v, s, dx, dy)
    _, s0, x0, y0 = best
    for s in [s0 - 0.01, s0 - 0.005, s0, s0 + 0.005, s0 + 0.01]:
        for dx in [x0 - 1, x0 - 0.5, x0, x0 + 0.5, x0 + 1]:
            for dy in [y0 - 1, y0 - 0.5, y0, y0 + 0.5, y0 + 1]:
                v = f(s, dx, dy)
                if v < best[0]: best = (v, s, dx, dy)
    v, s, dx, dy = best
    return s, dx * DS, dy * DS, v / 6


def gain(S, G):
    """GPT 圖整體色偏：用外側區域的平均值做每通道增益"""
    W, H = S.size
    ms = [0, 0, 0]; mg = [0, 0, 0]
    for b in [(int(W * .05), 0, int(W * .3), H), (int(W * .7), 0, int(W * .95), H)]:
        a, c = ImageStat.Stat(S.crop(b)).mean, ImageStat.Stat(G.crop(b)).mean
        for k in range(3): ms[k] += a[k]; mg[k] += c[k]
    k = [max(0.85, min(1.15, ms[i] / max(1, mg[i]))) for i in range(3)]
    ch = [c.point(lambda v, kk=kk: min(255, int(v * kk + .5))) for c, kk in zip(G.split(), k)]
    return Image.merge("RGB", ch), k


def min_path(D, x0, x1):
    """D: 灰階差異圖（縮小），在欄 [x0,x1) 找上到下累計差異最小的路徑，回傳每列的 x"""
    w, h = D.size
    px = D.load()
    INF = 1e18
    cost = [[INF] * w for _ in range(h)]
    back = [[0] * w for _ in range(h)]
    for x in range(x0, x1): cost[0][x] = px[x, 0]
    for y in range(1, h):
        prev, row, br = cost[y - 1], cost[y], back[y]
        for x in range(x0, x1):
            bx, bv = x, prev[x]
            if x > x0 and prev[x - 1] < bv: bx, bv = x - 1, prev[x - 1]
            if x < x1 - 1 and prev[x + 1] < bv: bx, bv = x + 1, prev[x + 1]
            row[x] = bv + px[x, y]; br[x] = bx
    x = min(range(x0, x1), key=lambda i: cost[h - 1][i])
    path = [0] * h
    for y in range(h - 1, -1, -1):
        path[y] = x; x = back[y][x]
    return path


def build(i):
    S = Image.open(f"work/seam/bg{i}_shift.png").convert("RGB")
    W, H = S.size
    G = Image.open(f"work/gen/seam_bg{i}.png").convert("RGB").resize((W, H), Image.LANCZOS)
    s, dx, dy, err = align(S, G)
    G = warp(G, s, dx, dy)
    G, k = gain(S, G)
    # 差異圖（縮小、模糊），加上離中心越遠越便宜的偏好（盡量多用原圖、但要避開不一致處）
    w, h = W // DS, H // DS
    D = ImageChops.difference(S.resize((w, h), Image.BILINEAR), G.resize((w, h), Image.BILINEAR))
    D = D.convert("L").filter(ImageFilter.GaussianBlur(2)).point(lambda v: v * 2 + 4)
    pl = min_path(D, int(w * 0.10), int(w * 0.40))
    pr = min_path(D, int(w * 0.60), int(w * 0.90))
    M = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(M)
    for y in range(h): dr.line([(pl[y], y), (pr[y], y)], fill=255)
    M = M.resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(FEATHER))
    out = Image.composite(G, S, M)
    b, c, ct = TONE.get(i, (1, 1, 1))
    out = ImageEnhance.Contrast(ImageEnhance.Color(ImageEnhance.Brightness(out).enhance(b)).enhance(c)).enhance(ct)
    out = out.resize((round(W * OUT_H / H), OUT_H), Image.LANCZOS)
    dst = f"art/bg/bg{i}.webp"
    out.save(dst, "WEBP", quality=78, method=6)
    # 檢查圖：兩張並排（接縫在正中間）＋ 上方小三角標出 GPT 區的左右界
    cw = out.width // 2
    t = out.resize((cw, OUT_H // 2), Image.LANCZOS)
    chk = Image.new("RGB", (cw * 2, t.height + 14), (30, 30, 30))
    chk.paste(t, (0, 14)); chk.paste(t, (cw, 14))
    d2 = ImageDraw.Draw(chk)
    for off in (0, cw):
        for xs in (sum(pl) / h, sum(pr) / h):
            xx = off + xs / w * cw
            d2.polygon([(xx - 5, 2), (xx + 5, 2), (xx, 12)], fill=(255, 200, 0))
    d2.polygon([(cw - 6, 2), (cw + 6, 2), (cw, 12)], fill=(255, 60, 60))
    chk.save(f"work/seam/check_bg{i}.jpg", quality=85)
    print(f"bg{i}: align s={s:.3f} dx={dx:.0f} dy={dy:.0f} err={err:.1f} gain={[round(x,3) for x in k]} -> {dst} {out.size} {os.path.getsize(dst)//1024}KB")


def sheet():
    ims = [Image.open(f"work/seam/check_bg{i}.jpg") for i in range(1, 6) if os.path.exists(f"work/seam/check_bg{i}.jpg")]
    if not ims: return
    w = max(im.width for im in ims)
    sh = Image.new("RGB", (w, sum(im.height + 6 for im in ims)), (30, 30, 30))
    y = 0
    for im in ims: sh.paste(im, (0, y)); y += im.height + 6
    sh.save("work/seam_check.jpg", quality=82)
    print("sheet work/seam_check.jpg")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "prep": prep()
    else:
        for n in (sys.argv[2:] or "12345"): build(int(n))
        sheet()
