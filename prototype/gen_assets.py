# 生成「彼岸」原型所需的真实 UI 图片素材（熔火/余烬风格，本地生成，非占位符）
from pathlib import Path
import math, random
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent / "assets"
OUT.mkdir(exist_ok=True)
random.seed(42)

def radial(size, inner, outer, cx=0.5, cy=0.5, r=0.75):
    """径向渐变底图"""
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            d = math.hypot(x / w - cx, y / h - cy) / r
            t = min(1.0, max(0.0, d))
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * t) for i in range(3))
    return img

def glow(img, cx, cy, radius, color, strength=1.0):
    """叠加柔光斑"""
    w, h = img.size
    layer = Image.new("RGB", img.size, (0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.65))
    base = img.load(); lp = layer.load()
    for y in range(h):
        for x in range(w):
            b = base[x, y]; l = lp[x, y]
            base[x, y] = tuple(min(255, int(b[i] + l[i] * strength)) for i in range(3))
    return img

def grain(img, amount=6):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            n = random.randint(-amount, amount)
            p = px[x, y]
            px[x, y] = tuple(max(0, min(255, c + n)) for c in p)
    return img

def orb(img, cx, cy, r, core, rim):
    """发光球体（参考图中的核心视觉）"""
    d = ImageDraw.Draw(img)
    steps = 24
    for i in range(steps, 0, -1):
        t = i / steps
        rr = r * (0.6 + 0.4 * t)
        col = tuple(int(core[j] + (rim[j] - core[j]) * t) for j in range(3))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
    img.paste(img.filter(ImageFilter.GaussianBlur(1)), (0, 0))
    return img

# 1. 逝者肖像（抽象暖色光球肖像，避免真实人脸）
p = radial((500, 500), (58, 22, 10), (8, 4, 3), cy=0.42, r=0.9)
p = glow(p, 250, 215, 120, (255, 122, 40), 0.9)
orb(p, 250, 210, 95, (255, 214, 160), (200, 70, 20))
p = glow(p, 250, 210, 60, (255, 190, 120), 0.5)
grain(p, 4).save(OUT / "portrait.png")

# 2. 首页 hero 背景（熔火夜空）
himg = radial((800, 1000), (70, 20, 8), (5, 3, 2), cy=0.25, r=1.1)
himg = glow(himg, 400, 240, 200, (255, 96, 24), 0.7)
himg = glow(himg, 140, 760, 120, (150, 40, 12), 0.5)
grain(himg, 5).save(OUT / "hero.png")

# 3-7. 祭品卡片图（统一暖色、区分色相的小图）
def item(name, hue_inner, hue_outer, gx, gy, gcol):
    im = radial((300, 300), hue_inner, hue_outer, cy=0.35, r=1.0)
    im = glow(im, 150, 120, 80, gcol, 0.85)
    im = glow(im, gx, gy, 40, gcol, 0.5)
    grain(im, 5).save(OUT / name)

item("flower.png", (120, 40, 40), (12, 5, 5), 110, 200, (255, 120, 90))   # 献花·暖红
item("candle.png", (140, 70, 15), (12, 6, 3), 190, 210, (255, 170, 60))   # 点灯·烛金
item("incense.png", (90, 60, 30), (10, 6, 4), 150, 190, (220, 180, 110))  # 清香·檀香
item("tea.png", (60, 80, 45), (8, 8, 4), 130, 200, (180, 220, 120))       # 茶·暖绿
item("fruit.png", (130, 60, 20), (12, 5, 3), 170, 200, (255, 150, 60))    # 水果·蜜橙
item("gift.png", (110, 50, 70), (12, 5, 8), 150, 190, (255, 130, 160))    # 纪念物·暖紫

# 8. 记忆配图（海·第一次旅行）
s = radial((600, 400), (40, 60, 80), (8, 8, 10), cy=0.3, r=1.1)
s = glow(s, 300, 130, 110, (255, 160, 90), 0.7)
s = glow(s, 300, 300, 160, (60, 90, 120), 0.5)
grain(s, 5).save(OUT / "sea.png")

# 9. 纪念物生成结果（茶具意境图）
g = radial((600, 600), (90, 45, 20), (8, 4, 3), cy=0.4, r=1.0)
g = glow(g, 300, 250, 130, (255, 150, 70), 0.8)
orb(g, 300, 250, 80, (255, 220, 170), (190, 90, 30))
g = glow(g, 300, 470, 90, (120, 60, 25), 0.5)
grain(g, 4).save(OUT / "keepsake.png")

print("generated:", sorted(x.name for x in OUT.iterdir()))
