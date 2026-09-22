#!/usr/bin/env python3
"""Generates the Calamus app icon: cartoonish cat face with a golden quill pen."""
from PIL import Image, ImageDraw
import math

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

# ── Background (rounded square, teal gradient) ────────────────────────────────
RADIUS = 200
BG_TOP = (45, 160, 180)
BG_BOT = (20, 100, 130)

bg_layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bg_draw  = ImageDraw.Draw(bg_layer)
for y in range(S):
    t = y / S
    c = lerp_color(BG_TOP, BG_BOT, t) + (255,)
    bg_draw.line([(0, y), (S, y)], fill=c)

mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S-1, S-1], radius=RADIUS, fill=255)
img.paste(bg_layer, mask=mask)
d = ImageDraw.Draw(img)

# Thick black border
d.rounded_rectangle([0, 0, S-1, S-1], radius=RADIUS, outline=(0, 0, 0, 220), width=28)
# Inner highlight rim
d.rounded_rectangle([14, 14, S-15, S-15], radius=RADIUS-14, outline=(255, 255, 255, 40), width=6)

# ── Quill (lower-right) ───────────────────────────────────────────────────────
OUTLINE   = (20, 12, 0, 255)
GOLD_BODY = (255, 200, 40, 255)
GOLD_DARK = (200, 140, 20, 255)
GOLD_LITE = (255, 230, 110, 255)
NIB_COL   = (60, 35, 10, 255)

NIB = (660, 870)
TIP = (820, 560)
MID = ((NIB[0]+TIP[0])//2, (NIB[1]+TIP[1])//2)

# Outline pass (drawn slightly larger)
left_vane_out = [
    (NIB[0]-2,  NIB[1]+2),
    (NIB[0]-52, NIB[1]-28),
    (MID[0]-105, MID[1]+45),
    (MID[0]-72,  MID[1]-35),
    (TIP[0]-92,  TIP[1]+65),
    (TIP[0]-38,  TIP[1]+8),
    (TIP[0]-2,   TIP[1]-2),
]
right_vane_out = [
    (NIB[0]+2,  NIB[1]+2),
    (NIB[0]+40, NIB[1]-50),
    (MID[0]+95, MID[1]+65),
    (MID[0]+62, MID[1]-22),
    (TIP[0]+72, TIP[1]+85),
    (TIP[0]+28, TIP[1]+8),
    (TIP[0]+2,  TIP[1]-2),
]
d.polygon(left_vane_out,  fill=OUTLINE)
d.polygon(right_vane_out, fill=OUTLINE)

# Filled vanes
left_vane = [
    NIB,
    (NIB[0]-40, NIB[1]-22),
    (MID[0]-88, MID[1]+38),
    (MID[0]-58, MID[1]-28),
    (TIP[0]-78, TIP[1]+58),
    (TIP[0]-28, TIP[1]+6),
    TIP,
]
right_vane = [
    NIB,
    (NIB[0]+28, NIB[1]-42),
    (MID[0]+80, MID[1]+56),
    (MID[0]+50, MID[1]-16),
    (TIP[0]+60, TIP[1]+76),
    (TIP[0]+18, TIP[1]+6),
    TIP,
]
d.polygon(left_vane,  fill=GOLD_DARK)
d.polygon(right_vane, fill=GOLD_BODY)

# Highlight stripe on right vane
hi = [
    (NIB[0]+10, NIB[1]-20),
    (MID[0]+30, MID[1]+30),
    (MID[0]+20, MID[1]+10),
    (NIB[0]+4,  NIB[1]-8),
]
d.polygon(hi, fill=GOLD_LITE)

# Barb lines
for i in range(8):
    t = 0.15 + i * 0.1
    sx = int(NIB[0] + (TIP[0]-NIB[0])*t)
    sy = int(NIB[1] + (TIP[1]-NIB[1])*t)
    d.line([(sx, sy), (sx - 60 + i*3, sy + 28 - i*5)], fill=OUTLINE, width=5)
    d.line([(sx, sy), (sx + 50 - i*2, sy + 30 - i*5)], fill=OUTLINE, width=5)

# Spine
d.line([NIB, TIP], fill=OUTLINE, width=14)
d.line([NIB, TIP], fill=(255, 240, 160, 255), width=6)

# Nib triangle
nib_tip = (NIB[0]-20, NIB[1]+48)
nib_pts  = [NIB, (NIB[0]-32, NIB[1]+16), nib_tip, (NIB[0]+16, NIB[1]+20)]
d.polygon(nib_pts, fill=OUTLINE)
d.polygon(nib_pts, fill=NIB_COL)

# Ink drop
d.ellipse([nib_tip[0]-9, nib_tip[1]+2, nib_tip[0]+9, nib_tip[1]+22],
          fill=(10, 5, 2, 240), outline=OUTLINE, width=4)

# ── Cat face ──────────────────────────────────────────────────────────────────
CX, CY, CR = 420, 435, 235
OUTLINE_W = 18

FUR    = (255, 235, 185, 255)
FUR_CH = (240, 200, 155, 255)   # cheek/chin shading
EAR_IN = (255, 150, 170, 255)
NOSE   = (255, 130, 155, 255)
MOUTH  = (60,  20,  10, 255)
EYE_WH = (255, 255, 255, 255)
EYE_BL = (30,  15,   5, 255)
SHINE  = (255, 255, 255, 255)
WHISK  = (255, 255, 255, 200)
BLUSH  = (255, 160, 160, 100)

# Head outline
d.ellipse([CX-CR-OUTLINE_W, CY-CR-OUTLINE_W, CX+CR+OUTLINE_W, CY+CR+OUTLINE_W],
          fill=(0, 0, 0, 255))
# Head fill
d.ellipse([CX-CR, CY-CR, CX+CR, CY+CR], fill=FUR)

# Chin shading
for i in range(30):
    alpha = int(40 * (i/30))
    d.ellipse([CX-CR+i*2, CY+CR//2+i, CX+CR-i*2, CY+CR-i],
              fill=FUR_CH[:3]+(alpha,))

# ── Ears ──────────────────────────────────────────────────────────────────────
OW = OUTLINE_W + 4

# Left ear outline
d.polygon([(248-OW, 348+OW), (265-OW, 145-OW), (405+OW, 290+OW)], fill=(0,0,0,255))
# Left ear fill
d.polygon([(248, 348), (265, 145), (405, 290)], fill=FUR)
# Left ear inner
d.polygon([(264, 328), (280, 182), (388, 278)], fill=EAR_IN)

# Right ear outline
d.polygon([(592+OW, 290+OW), (565-OW, 145-OW), (435-OW, 290+OW)], fill=(0,0,0,255))
# Right ear fill
d.polygon([(592, 290), (565, 145), (435, 290)], fill=FUR)
# Right ear inner
d.polygon([(576, 278), (552, 180), (452, 278)], fill=EAR_IN)

# ── Eyes (big cartoony closed arcs) ──────────────────────────────────────────
# Left eye — thick happy arc
for w in range(4):
    d.arc([318-w, 392-w, 396+w, 448+w], start=195, end=345,
          fill=(0,0,0,255), width=22-w*3)
# Tiny highlight dots
d.ellipse([325, 396, 337, 408], fill=SHINE)

# Right eye
for w in range(4):
    d.arc([434-w, 392-w, 512+w, 448+w], start=195, end=345,
          fill=(0,0,0,255), width=22-w*3)
d.ellipse([441, 396, 453, 408], fill=SHINE)

# ── Rosy cheeks ───────────────────────────────────────────────────────────────
d.ellipse([248, 455, 348, 520], fill=BLUSH)
d.ellipse([492, 455, 592, 520], fill=BLUSH)

# ── Nose ─────────────────────────────────────────────────────────────────────
nose_pts = [(CX, 468), (CX-26, 500), (CX+26, 500)]
# outline
d.polygon([(CX, 468-8), (CX-34, 508), (CX+34, 508)], fill=(0,0,0,255))
d.polygon(nose_pts, fill=NOSE)
# shine
d.ellipse([CX-10, 473, CX+2, 482], fill=(255, 200, 215, 200))

# ── Mouth ─────────────────────────────────────────────────────────────────────
for w in range(3):
    d.arc([372-w, 490-w, 422+w, 535+w], start=25, end=155, fill=MOUTH, width=9-w*2)
    d.arc([418-w, 490-w, 468+w, 535+w], start=25, end=155, fill=MOUTH, width=9-w*2)

# ── Whiskers ──────────────────────────────────────────────────────────────────
whisker_data = [
    # left side
    ((110, 448), (388, 462)),
    ((105, 478), (388, 478)),
    ((112, 508), (388, 495)),
    # right side
    ((730, 448), (452, 462)),
    ((735, 478), (452, 478)),
    ((728, 508), (452, 495)),
]
for pts in whisker_data:
    # outline
    d.line(pts, fill=(0,0,0,160), width=10)
    # fill
    d.line(pts, fill=WHISK, width=6)

# ── Save ──────────────────────────────────────────────────────────────────────
import os
os.makedirs('build', exist_ok=True)
out = 'build/icon.png'
img.save(out, 'PNG')
print(f'Saved {out}  ({S}×{S})')
