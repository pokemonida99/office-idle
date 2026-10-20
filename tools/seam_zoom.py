"""1:1 放大檢查：art/bg/bgN.webp 接縫處（兩張相接）各取 ±300px → work/seam/zoom_bgN.jpg
用法: python3 tools/seam_zoom.py 1 2 ...
"""
import sys, os
from PIL import Image
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
for n in sys.argv[1:]:
    im = Image.open(f"art/bg/bg{n}.webp").convert("RGB"); W, H = im.size
    two = Image.new("RGB", (W * 2, H)); two.paste(im, (0, 0)); two.paste(im, (W, 0))
    two.crop((W - 300, 0, W + 300, H)).save(f"work/seam/zoom_bg{n}.jpg", quality=88)
    print(f"work/seam/zoom_bg{n}.jpg")
