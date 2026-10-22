"""檢查圖：python3 tools/hero_sheet.py <輸出.jpg> id1 id2 ...（全身＋頭像並排，灰底）"""
import sys, os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(__file__), '..')
out, ids = sys.argv[1], sys.argv[2:]
ims = [(i, Image.open(os.path.join(ROOT, 'art/hero', i + '.webp')).convert('RGBA')) for i in ids if os.path.exists(os.path.join(ROOT, 'art/hero', i + '.webp'))]
W = sum(im.width for _, im in ims) + 10 * len(ims) + 10
c = Image.new('RGB', (W, 590), (120, 130, 150)); d = ImageDraw.Draw(c); x = 5
for i, im in ims:
    c.paste(im, (x, 5), im)
    f = Image.open(os.path.join(ROOT, 'art/hero/face', i + '.webp')).convert('RGBA')
    c.paste((60, 60, 70), (x, 435, x + 128, 563)); c.paste(f, (x, 435), f); d.text((x, 568), i, fill=(255, 255, 255))
    x += im.width + 10
c.save(out, quality=85)
