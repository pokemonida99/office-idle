"""綠底 #00FF00 去背（只去掉跟外框相連的綠，角色身上的綠色保留）→ webp
用法: python3 -I tools/cut.py <src.png> <dst.webp> <高度>
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

LO, HI = 50, 110   # 綠度 G-max(R,B)：<LO 不透明，>HI 全透明

def cut(src, dst, H):
    im = Image.open(src).convert("RGB")
    r, g, b = im.split()
    k = ImageChops.subtract(g, ImageChops.lighter(r, b))           # 綠度
    bg = k.point(lambda v: 255 if v > 35 else 0)
    W, Hh = bg.size
    px = bg.load()
    seeds = [(x, 0) for x in range(0, W, 4)] + [(x, Hh - 1) for x in range(0, W, 4)] + \
            [(0, y) for y in range(0, Hh, 4)] + [(W - 1, y) for y in range(0, Hh, 4)]
    for s in seeds:
        if px[s] == 255:
            ImageDraw.floodfill(bg, s, 128)
    conn = bg.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(5))  # 外框相連的綠（含一圈邊）
    soft = k.point(lambda v: int(255 * min(1, max(0, 1 - (v - LO) / (HI - LO)))))
    A = ImageChops.lighter(ImageChops.invert(conn), soft)
    # 被包住的綠底（髮縫、手臂間）：非常純的綠也去掉
    strong = k.point(lambda v: int(255 * min(1, max(0, 1 - (v - 105) / 40))))
    A = ImageChops.darker(A, strong)
    A = A.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    # 去綠溢色：邊緣附近 G 壓到 max(R,B)
    edge = ImageChops.invert(A).filter(ImageFilter.MaxFilter(9))
    gl = ImageChops.lighter(r, b)
    g2 = Image.composite(ImageChops.darker(g, gl), g, edge.point(lambda v: 255 if v > 0 else 0))
    out = Image.merge("RGB", (r, g2, b)).convert("RGBA")
    out.putalpha(A)
    bbox = A.point(lambda v: 255 if v > 20 else 0).getbbox()
    out = out.crop(bbox)
    out = out.resize((round(out.width * H / out.height), H), Image.LANCZOS)
    out.save(dst, "WEBP", quality=88, method=6)
    return out.size

if __name__ == "__main__":
    print(cut(sys.argv[1], sys.argv[2], int(sys.argv[3])))
