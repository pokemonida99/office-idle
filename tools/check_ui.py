"""去背檢查：把 art/ui/bonus_*.webp 放到深色與亮色底上放大 2 倍 → work/bonus_check.png
用法: python3 tools/check_ui.py
"""
import os, glob
from PIL import Image
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
fs = sorted(glob.glob("art/ui/bonus_*.webp"))
ims = [Image.open(f).convert("RGBA") for f in fs]
ims = [im.resize((im.width * 2, im.height * 2), Image.LANCZOS) for im in ims]
w = sum(im.width + 30 for im in ims) + 30; h = max(im.height for im in ims) + 40
out = Image.new("RGB", (w, h * 3))
for row, col in enumerate([(24, 24, 32), (70, 60, 90), (235, 235, 235)]):
    bg = Image.new("RGB", (w, h), col); x = 30
    for im in ims: bg.paste(im, (x, 20), im); x += im.width + 30
    out.paste(bg, (0, row * h))
out.save("work/bonus_check.png"); print("work/bonus_check.png", [os.path.basename(f) + f" {Image.open(f).size} {os.path.getsize(f)//1024}KB" for f in fs])
