# -*- coding: utf-8 -*-
"""Parse level01_map.json and emit build plan JSON for UE MCP spawn script."""
import json, math

SRC = r"C:\Users\magnolia\Documents\Kimi\Workspaces\游戏\BoneWelcome\Content\Design\level01_map.json"
OUT = r"C:\Users\magnolia\Documents\Kimi\Workspaces\游戏\build_plan.json"

data = json.load(open(SRC, encoding="utf-8"))
rows = data["mapRows"]
palette = data["palette"]
T = 100.0  # tile size cm

# ---- palette hex -> linear ----
def hex_to_linear(h):
    h = h.lstrip("#")
    c = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    return [round(pow(x, 2.2), 4) for x in c]

lin = {k: hex_to_linear(v) for k, v in palette.items()}

# ---- base terrain class per cell ----
# terrain key -> (material, topZ, scaleZ)
TERRAIN = {
    "%": ("rock", 200.0, 2.0),
    "^": ("high", 80.0, 0.9),
    "n": ("ramp", 40.0, 0.5),
    "#": ("bonewall", 120.0, 1.2),
    "~": ("marsh", 0.0, 0.1),
    ",": ("road", 0.0, 0.1),
    ".": ("ground", 0.0, 0.1),
    ":": ("ground", 0.0, 0.1),   # tunnel: visually flat ground
}
# interactive cells sit on a flat base tile
BASE_OVERRIDE = {"T": ".", "X": ".", "?": ".", "S": ".",
                 "a": ".", "p": ".", "w": ".", "r": ".",
                 "D": ","}
TERRAIN_FLAT = {"ground": 0.0, "road": 0.0}

nrows = len(rows)
ncols = len(rows[0])
assert nrows == 24 and all(len(r) == 64 for r in rows)

def base_key(ch):
    if ch in TERRAIN:
        return ch
    if ch in BASE_OVERRIDE:
        return BASE_OVERRIDE[ch]
    raise ValueError(f"unknown char {ch!r}")

# ---- row-run merge ----
rects = []  # (matname, x0col, x1col, row, topZ, scaleZ)
for r in range(nrows):
    c = 0
    while c < ncols:
        k = base_key(rows[r][c])
        c2 = c
        while c2 + 1 < ncols and base_key(rows[r][c2 + 1]) == k:
            c2 += 1
        mat, topz, sz = TERRAIN[k]
        rects.append({"mat": {"rock": "M_Rock", "high": "M_High", "ramp": "M_Ramp",
                              "bonewall": "M_BoneWall", "marsh": "M_Marsh",
                              "road": "M_Road", "ground": "M_Ground"}[mat],
                      "c0": c, "c1": c2, "row": r, "topz": topz, "sz": sz})
        c = c2 + 1

# ---- interactive objects ----
towers, tombs, gates, rifts, digs, spawn = [], [], [], [], [], []
tcount = {"a": 0, "p": 0, "w": 0, "r": 0}
tname = {"a": "Tower_Arrow", "p": "Tower_Poison", "w": "Tower_Wail", "r": "Tower_Revive"}
for r in range(nrows):
    for c in range(ncols):
        ch = rows[r][c]
        if ch in tcount:
            tcount[ch] += 1
            towers.append({"type": ch, "name": f"{tname[ch]}_{tcount[ch]:02d}", "col": c, "row": r})
        elif ch == "T":
            tombs.append({"col": c, "row": r})
        elif ch == "D":
            gates.append({"col": c, "row": r})
        elif ch == "X":
            rifts.append({"col": c, "row": r})
        elif ch == "?":
            digs.append({"col": c, "row": r})
        elif ch == "S":
            spawn.append({"col": c, "row": r})

plan = {"rects": rects, "towers": towers, "tombs": tombs, "gates": gates,
        "rifts": rifts, "digs": digs, "spawn": spawn, "palette_linear": lin}
json.dump(plan, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# stats
from collections import Counter
matcnt = Counter(rc["mat"] for rc in rects)
print("rect count:", len(rects), dict(matcnt))
print("towers:", [(t["name"], t["col"], t["row"]) for t in towers])
print("tombs:", len(tombs), [(t["col"], t["row"]) for t in tombs])
print("gates:", [(g["col"], g["row"]) for g in gates])
print("rifts:", rifts, "digs:", digs, "spawn:", spawn)
print("palette linear:", json.dumps(lin))
