"""v1.4 黑心公司篇：work/gen/v14_*.png → art/
用法: python3 tools/v14_cut.py [-f]           （去背類：頭目、怪物、立繪、標誌、挑戰圖示；已存在就跳過）
      python3 tools/v14_cut.py prep 6 7 ...   （背景：往右捲半張 → work/seam/bgN_shift.png，再生 seam_bgN）
      python3 tools/v14_cut.py bg 6 7 ...     （背景：tools/seam.py 的 build 接縫 → art/bg/bgN.webp）
      python3 tools/v14_cut.py sheet          （檢查圖 work/v14_check.jpg）
"""
import os, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from cut import cut
from hero_cut import fgmask


def split_blobs(src, n=4):
    """2×2 圖依連通區塊分組：每塊依重心歸到最近的格子中心，再各自只保留自己那組（其他塗綠）"""
    im = Image.open(src).convert('RGB')
    W, H = im.size
    D = 4
    m = fgmask(im).resize((W // D, H // D))
    w, h = m.size
    px = m.load()
    lab = [[0] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if px[x, y] and not lab[y][x]:
                k = len(comps) + 1; st = [(x, y)]; lab[y][x] = k; pts = []
                while st:
                    a, b = st.pop(); pts.append((a, b))
                    for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                        if 0 <= c < w and 0 <= d < h and px[c, d] and not lab[d][c]:
                            lab[d][c] = k; st.append((c, d))
                comps.append(pts)
    centers = [(w * .25, h * .25), (w * .75, h * .25), (w * .25, h * .75), (w * .75, h * .75)]
    groups = [[] for _ in range(4)]
    for k, pts in enumerate(comps, 1):
        if len(pts) < 6: continue
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        g = min(range(4), key=lambda j: (cx - centers[j][0]) ** 2 + (cy - centers[j][1]) ** 2)
        groups[g].append(k)
    out = []
    for g in groups:
        keep = set(g)
        M = Image.new('L', (w, h), 0); mp = M.load()
        for y in range(h):
            for x in range(w):
                if lab[y][x] in keep: mp[x, y] = 255
        M = M.resize((W, H), Image.NEAREST).filter(ImageFilter.MaxFilter(9))
        cell = Image.composite(im, Image.new('RGB', (W, H), (0, 255, 0)), M)
        bb = M.getbbox()
        out.append(cell.crop((max(0, bb[0] - 20), max(0, bb[1] - 20), min(W, bb[2] + 20), min(H, bb[3] + 20))))
    return out, [f'{len(g)} 塊' for g in groups]

G = 'work/gen/'
SINGLE = {  # 生成名 → (輸出, 高)
    'v14_logo': ('art/villain/logo.webp', 256),
    'v14_challenge': ('art/ui/challenge.webp', 96),
    'v14_v_ceo': ('art/villain/v_ceo.webp', 420),
    'v14_v_aide': ('art/villain/v_aide.webp', 420),
    'v14_e_layoff': ('art/enemy/layoff.webp', 300),
}
for b in ('b_996', 'b_unpaid', 'b_duty', 'b_merger', 'b_ceo'):
    SINGLE['v14_' + b] = (f'art/enemy/{b}.webp', 440)
SHEETS = {'v14_esheet1': ['timeclock', 'unpaid', 'shackle', 'spy'], 'v14_esheet2': ['contract', 'cctv', 'pie', 'suit']}


def cutout(force):
    os.makedirs('art/villain', exist_ok=True)
    os.makedirs(G + 'v14_cells', exist_ok=True)
    for n, (out, h) in SINGLE.items():
        if os.path.exists(G + n + '.png') and (force or not os.path.exists(out)):
            print(n, out, cut(G + n + '.png', out, h))
    for n, ids in SHEETS.items():
        if not os.path.exists(G + n + '.png'): continue
        if not force and all(os.path.exists(f'art/enemy/{i}.webp') for i in ids): continue
        cells, warn = split_blobs(G + n + '.png')
        for i, c in zip(ids, cells):
            p = G + f'v14_cells/{i}.png'; c.save(p)
            print(n, i, cut(p, f'art/enemy/{i}.webp', 300), ' '.join(warn))


SEAM = open('work/prompts/seam_bg3.txt').read()


def prep(nums):
    os.makedirs('work/seam', exist_ok=True)
    for i in nums:
        im = Image.open(G + f'v14_bg{i}.png').convert('RGB')
        ImageChops.offset(im, im.width // 2, 0).save(f'work/seam/bg{i}_shift.png')
        open(f'work/prompts/seam_bg{i}.txt', 'w').write(SEAM)
        open(f'work/prompts/seam_bg{i}.refs', 'w').write(f'work/seam/bg{i}_shift.png\n')
        print('prep', i)


def bg(nums):
    import seam
    for i in nums: seam.TONE[int(i)] = (1.12, 1.0, 1.02)   # 黑心公司場景偏暗，提亮讓角色看得清楚
    for i in nums: seam.build(int(i))
    ims = [Image.open(f'work/seam/check_bg{i}.jpg') for i in nums]
    w = max(im.width for im in ims)
    sh = Image.new('RGB', (w, sum(im.height + 6 for im in ims)), (30, 30, 30)); y = 0
    for im in ims: sh.paste(im, (0, y)); y += im.height + 6
    sh.save('work/v14_seam_check.jpg', quality=82)


def sheet():
    items = [p for p in ['art/villain/logo.webp', 'art/ui/challenge.webp'] + [f'art/enemy/{b}.webp' for b in ('b_996', 'b_unpaid', 'b_duty', 'b_merger', 'b_ceo')]
             + [f'art/enemy/{i}.webp' for i in SHEETS['v14_esheet1'] + SHEETS['v14_esheet2'] + ['layoff']] + ['art/villain/v_ceo.webp', 'art/villain/v_aide.webp'] if os.path.exists(p)]
    ims = [Image.open(p).convert('RGBA') for p in items]
    rows, row, w = [], [], 0
    for im in ims:
        if w + im.width > 2400 and row: rows.append(row); row, w = [], 0
        row.append(im); w += im.width + 10
    rows.append(row)
    H = sum(max(i.height for i in r) + 10 for r in rows)
    c = Image.new('RGB', (2420, H + 10), (120, 130, 150)); y = 5
    for r in rows:
        x = 5; mh = max(i.height for i in r)
        for im in r: c.paste(im, (x, y + mh - im.height), im); x += im.width + 10
        y += mh + 10
    c.save('work/v14_check.jpg', quality=85); print('work/v14_check.jpg')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'prep': prep(a[1:])
    elif a and a[0] == 'bg': bg(a[1:])
    elif a and a[0] == 'sheet': sheet()
    else: cutout('-f' in a)
