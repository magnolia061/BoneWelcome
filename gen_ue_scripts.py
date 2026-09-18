# -*- coding: utf-8 -*-
"""Emit three UE execute_tool_script payloads (terrain / interactive / lighting)."""
import json

plan = json.load(open(r"C:\Users\magnolia\Documents\Kimi\Workspaces\游戏\build_plan.json", encoding="utf-8"))

CUBE = "/Engine/BasicShapes/Cube"
CYL = "/Engine/BasicShapes/Cylinder"
SPH = "/Engine/BasicShapes/Sphere"
MPATH = lambda m: f"/Game/Materials/{m}.{m}"

HEADER = '''import json

def et(tool, args):
    return execute_tool(tool, json.dumps(args))

def spawn(asset, name, x, y, z, sx, sy, sz):
    return et("editor_toolset.toolsets.scene.SceneTools.add_to_scene_from_asset",
              {"asset_path": asset, "name": name,
               "xform": {"location": {"x": x, "y": y, "z": z},
                         "scale": {"x": sx, "y": sy, "z": sz}}})["returnValue"]

def override_mat(actor, matpath):
    comps = et("editor_toolset.toolsets.actor.ActorTools.get_components",
               {"actor": actor})["returnValue"]
    for c in comps:
        if "StaticMeshComponent" in c["refPath"]:
            et("editor_toolset.toolsets.object.ObjectTools.set_properties",
               {"instance": c, "values": json.dumps({"OverrideMaterials": [matpath]})})
            return True
    return False

def to_folder(actor, folder):
    return et("editor_toolset.toolsets.scene.SceneTools.set_actor_folder",
              {"actor": actor, "folder_path": folder})
'''

# ---------- Script A: terrain ----------
lines = [HEADER, "\ndef run():", "    spawned = 0", "    errors = []"]
for rc in plan["rects"]:
    if rc["mat"] == "M_BoneWall":
        continue  # walls handled as interactive
    w = rc["c1"] - rc["c0"] + 1
    x = (rc["c0"] + rc["c1"] + 1) * 50.0
    y = rc["row"] * 100.0 + 50.0
    z = rc["topz"] - 50.0 * rc["sz"]
    name = f"T_{rc['mat'][2:]}_r{rc['row']:02d}_c{rc['c0']:02d}"
    mat = MPATH(rc["mat"])
    lines.append(f'    try:')
    lines.append(f'        a = spawn("{CUBE}", "{name}", {x}, {y}, {z}, {w}.0, 1.0, {rc["sz"]})')
    lines.append(f'        override_mat(a, "{mat}")')
    lines.append(f'        to_folder(a, "Level01/Terrain")')
    lines.append(f'        spawned += 1')
    lines.append(f'    except Exception as e:')
    lines.append(f'        errors.append("{name}: " + str(e)[:120])')
lines.append('    return {"spawned": spawned, "errors": errors}')
script_a = "\n".join(lines)

# ---------- Script B: interactive ----------
b = [HEADER]

b.append('''
def spawn_class(cls, name, x, y, z):
    return et("editor_toolset.toolsets.scene.SceneTools.add_to_scene_from_class",
              {"actor_type": {"refPath": cls}, "name": name,
               "xform": {"location": {"x": x, "y": y, "z": z}}})["returnValue"]

def add_prim(actor, kind, name, dims, lz, lx=0.0, mat=""):
    tool = {"cube": "editor_toolset.toolsets.primitive.PrimitiveTools.add_cube",
            "cyl": "editor_toolset.toolsets.primitive.PrimitiveTools.add_cylinder",
            "cone": "editor_toolset.toolsets.primitive.PrimitiveTools.add_cone"}[kind]
    args = {"actor": actor, "name": name,
            "local_transform": {"location": {"x": lx, "y": 0, "z": lz}}}
    if kind == "cube":
        args["dimensions"] = {"x": dims[0], "y": dims[1], "z": dims[2]}
    else:
        args["radius"] = dims[0]
        args["height"] = dims[1]
    comp = et(tool, args)["returnValue"]
    if mat:
        et("editor_toolset.toolsets.object.ObjectTools.set_properties",
           {"instance": comp, "values": json.dumps({"OverrideMaterials": [mat]})})
    return comp

def run():
    spawned = []
    errors = []
''')

# walls: individual per tile
wall_tiles = []
for rc in plan["rects"]:
    if rc["mat"] == "M_BoneWall":
        for c in range(rc["c0"], rc["c1"] + 1):
            wall_tiles.append((c, rc["row"]))
b.append(f'    # --- BoneWalls ({len(wall_tiles)}) ---')
for i, (c, r) in enumerate(wall_tiles, 1):
    x, y = c * 100.0 + 50.0, r * 100.0 + 50.0
    nm = f"BoneWall_{i:02d}"
    b.append(f'    try:')
    b.append(f'        a = spawn("{CUBE}", "{nm}", {x}, {y}, 60.0, 1.0, 1.0, 1.2)')
    b.append(f'        override_mat(a, "{MPATH("M_BoneWall")}")')
    b.append(f'        to_folder(a, "Level01/Walls")')
    b.append(f'        spawned.append("{nm}")')
    b.append(f'    except Exception as e:')
    b.append(f'        errors.append("{nm}: " + str(e)[:120])')

# towers
topmat = {"a": MPATH("M_BoneTower"), "p": MPATH("M_PoisonGlow"),
          "w": MPATH("M_SoulGlow"), "r": MPATH("M_SoulGlow")}
b.append(f'    # --- Towers ({len(plan["towers"])}) ---')
for t in plan["towers"]:
    x, y = t["col"] * 100.0 + 50.0, t["row"] * 100.0 + 50.0
    nm = t["name"]
    tm = topmat[t["type"]]
    b.append(f'    try:')
    b.append(f'        a = spawn_class("/Script/Engine.Actor", "{nm}", {x}, {y}, 0.0)')
    b.append(f'        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="{MPATH("M_BoneTower")}")')
    b.append(f'        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="{tm}")')
    b.append(f'        to_folder(a, "Level01/Towers")')
    b.append(f'        spawned.append("{nm}")')
    b.append(f'    except Exception as e:')
    b.append(f'        errors.append("{nm}: " + str(e)[:120])')

# gate (2x2 at cols 59-60, rows 10-11 -> center x=6000 y=1100)
b.append('    # --- Gate ---')
b.append('    try:')
b.append('        g = spawn_class("/Script/Engine.Actor", "Gate", 6000.0, 1100.0, 0.0)')
b.append(f'        add_prim(g, "cube", "Body", (200.0, 200.0, 120.0), 60.0, mat="{MPATH("M_Rock")}")')
b.append(f'        add_prim(g, "cube", "TrimTop", (200.0, 200.0, 12.0), 126.0, mat="{MPATH("M_BoneWall")}")')
b.append(f'        add_prim(g, "cube", "TrimL", (24.0, 200.0, 140.0), 70.0, lx=-88.0, mat="{MPATH("M_BoneWall")}")')
b.append(f'        add_prim(g, "cube", "TrimR", (24.0, 200.0, 140.0), 70.0, lx=88.0, mat="{MPATH("M_BoneWall")}")')
b.append('        to_folder(g, "Level01/Interactive")')
b.append('        spawned.append("Gate")')
b.append('    except Exception as e:')
b.append('        errors.append("Gate: " + str(e)[:120])')

# tombs
b.append(f'    # --- Tombs ({len(plan["tombs"])}) ---')
for i, t in enumerate(plan["tombs"], 1):
    x, y = t["col"] * 100.0 + 50.0, t["row"] * 100.0 + 50.0
    nm = f"Tomb_{i:02d}"
    b.append(f'    try:')
    b.append(f'        a = spawn("{CUBE}", "{nm}", {x}, {y}, 35.0, 0.4, 0.15, 0.7)')
    b.append(f'        override_mat(a, "{MPATH("M_Tomb")}")')
    b.append(f'        to_folder(a, "Level01/Interactive")')
    b.append(f'        spawned.append("{nm}")')
    b.append(f'    except Exception as e:')
    b.append(f'        errors.append("{nm}: " + str(e)[:120])')

# rift / digsite / spawn marker
rf = plan["rifts"][0]; dg = plan["digs"][0]; sp = plan["spawn"][0]
rx, ry = rf["col"] * 100.0 + 50.0, rf["row"] * 100.0 + 50.0
dx, dy = dg["col"] * 100.0 + 50.0, dg["row"] * 100.0 + 50.0
sx_, sy_ = sp["col"] * 100.0 + 50.0, sp["row"] * 100.0 + 50.0
b.append('    # --- Rift / DigSite / Spawn marker ---')
b.append('    try:')
b.append(f'        a = spawn("{CYL}", "Rift", {rx}, {ry}, 4.0, 0.8, 0.8, 0.08)')
b.append(f'        override_mat(a, "{MPATH("M_RiftGlow")}")')
b.append('        to_folder(a, "Level01/Interactive"); spawned.append("Rift")')
b.append('    except Exception as e:')
b.append('        errors.append("Rift: " + str(e)[:120])')
b.append('    try:')
b.append(f'        a = spawn("{SPH}", "DigSite", {dx}, {dy}, 25.0, 0.5, 0.5, 0.5)')
b.append(f'        override_mat(a, "{MPATH("M_Gold")}")')
b.append('        to_folder(a, "Level01/Interactive"); spawned.append("DigSite")')
b.append('    except Exception as e:')
b.append('        errors.append("DigSite: " + str(e)[:120])')
b.append('    try:')
b.append(f'        a = spawn("{CUBE}", "SpawnMarker", {sx_}, {sy_}, 5.0, 0.5, 0.5, 0.1)')
b.append(f'        override_mat(a, "{MPATH("M_Player")}")')
b.append('        to_folder(a, "Level01/Interactive"); spawned.append("SpawnMarker")')
b.append('    except Exception as e:')
b.append('        errors.append("SpawnMarker: " + str(e)[:120])')
b.append('    return {"spawned": spawned, "errors": errors}')
script_b = "\n".join(b)

# ---------- Script C: lighting + camera + playerstart ----------
script_c = HEADER + '''
def run():
    out = {}
    errors = []
    try:
        sun = et("editor_toolset.toolsets.scene.SceneTools.add_to_scene_from_class",
                 {"actor_type": {"refPath": "/Script/Engine.DirectionalLight"}, "name": "Sun_Moon",
                  "xform": {"location": {"x": 3200, "y": 1200, "z": 3000},
                            "rotation": {"pitch": -60, "yaw": -35, "roll": 0}}})["returnValue"]
        comps = et("editor_toolset.toolsets.actor.ActorTools.get_components", {"actor": sun})["returnValue"]
        for c in comps:
            if "DirectionalLightComponent" in c["refPath"]:
                et("editor_toolset.toolsets.object.ObjectTools.set_properties",
                   {"instance": c, "values": json.dumps({"Intensity": 3.0,
                        "LightColor": {"R": 170, "G": 190, "B": 255, "A": 255}})})
        et("editor_toolset.toolsets.scene.SceneTools.set_actor_folder",
           {"actor": sun, "folder_path": "Level01/Lighting"})
        out["sun"] = sun["refPath"]
    except Exception as e:
        errors.append("Sun: " + str(e)[:150])
    try:
        sky = et("editor_toolset.toolsets.scene.SceneTools.add_to_scene_from_class",
                 {"actor_type": {"refPath": "/Script/Engine.SkyLight"}, "name": "SkyLight_Night",
                  "xform": {"location": {"x": 3200, "y": 1200, "z": 500}}})["returnValue"]
        comps = et("editor_toolset.toolsets.actor.ActorTools.get_components", {"actor": sky})["returnValue"]
        for c in comps:
            if "SkyLightComponent" in c["refPath"]:
                et("editor_toolset.toolsets.object.ObjectTools.set_properties",
                   {"instance": c, "values": json.dumps({"Intensity": 0.5,
                        "LightColor": {"R": 120, "G": 140, "B": 200, "A": 255}})})
        et("editor_toolset.toolsets.scene.SceneTools.set_actor_folder",
           {"actor": sky, "folder_path": "Level01/Lighting"})
        out["sky"] = sky["refPath"]
    except Exception as e:
        errors.append("Sky: " + str(e)[:150])
    try:
        cam = et("editor_toolset.toolsets.scene.SceneTools.add_to_scene_from_class",
                 {"actor_type": {"refPath": "/Script/Engine.CameraActor"}, "name": "Cam_Overview",
                  "xform": {"location": {"x": 3200, "y": 1200, "z": 2600},
                            "rotation": {"pitch": -75, "yaw": 0, "roll": 0}}})["returnValue"]
        et("editor_toolset.toolsets.scene.SceneTools.set_actor_folder",
           {"actor": cam, "folder_path": "Level01/Cameras"})
        out["cam"] = cam["refPath"]
    except Exception as e:
        errors.append("Cam: " + str(e)[:150])
    try:
        ps = et("editor_toolset.toolsets.scene.SceneTools.add_to_scene_from_class",
                {"actor_type": {"refPath": "/Script/Engine.PlayerStart"}, "name": "SpawnPoint",
                 "xform": {"location": {"x": 150, "y": 1050, "z": 10}}})["returnValue"]
        et("editor_toolset.toolsets.scene.SceneTools.set_actor_folder",
           {"actor": ps, "folder_path": "Level01/Interactive"})
        out["spawn"] = ps["refPath"]
    except Exception as e:
        errors.append("PlayerStart: " + str(e)[:150])
    out["errors"] = errors
    return out
'''

base = r"C:\Users\magnolia\Documents\Kimi\Workspaces\游戏"
open(base + r"\script_a_terrain.py", "w", encoding="utf-8").write(script_a)
open(base + r"\script_b_interactive.py", "w", encoding="utf-8").write(script_b)
open(base + r"\script_c_lighting.py", "w", encoding="utf-8").write(script_c)
print("A lines:", script_a.count("\n"), "B lines:", script_b.count("\n"), "C lines:", script_c.count("\n"))
print("wall tiles:", len(wall_tiles))
