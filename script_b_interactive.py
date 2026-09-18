import json

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

    # --- BoneWalls (11) ---
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_01", 3250.0, 750.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_01")
    except Exception as e:
        errors.append("BoneWall_01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_02", 3250.0, 850.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_02")
    except Exception as e:
        errors.append("BoneWall_02: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_03", 3250.0, 950.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_03")
    except Exception as e:
        errors.append("BoneWall_03: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_04", 3250.0, 1050.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_04")
    except Exception as e:
        errors.append("BoneWall_04: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_05", 3250.0, 1150.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_05")
    except Exception as e:
        errors.append("BoneWall_05: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_06", 3250.0, 1250.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_06")
    except Exception as e:
        errors.append("BoneWall_06: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_07", 3250.0, 1350.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_07")
    except Exception as e:
        errors.append("BoneWall_07: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_08", 3250.0, 1450.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_08")
    except Exception as e:
        errors.append("BoneWall_08: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_09", 3250.0, 1550.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_09")
    except Exception as e:
        errors.append("BoneWall_09: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_10", 3250.0, 1650.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_10")
    except Exception as e:
        errors.append("BoneWall_10: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "BoneWall_11", 3250.0, 1750.0, 60.0, 1.0, 1.0, 1.2)
        override_mat(a, "/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(a, "Level01/Walls")
        spawned.append("BoneWall_11")
    except Exception as e:
        errors.append("BoneWall_11: " + str(e)[:120])
    # --- Towers (6) ---
    try:
        a = spawn_class("/Script/Engine.Actor", "Tower_Wail_01", 2450.0, 450.0, 0.0)
        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="/Game/Materials/M_SoulGlow.M_SoulGlow")
        to_folder(a, "Level01/Towers")
        spawned.append("Tower_Wail_01")
    except Exception as e:
        errors.append("Tower_Wail_01: " + str(e)[:120])
    try:
        a = spawn_class("/Script/Engine.Actor", "Tower_Arrow_01", 950.0, 650.0, 0.0)
        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        to_folder(a, "Level01/Towers")
        spawned.append("Tower_Arrow_01")
    except Exception as e:
        errors.append("Tower_Arrow_01: " + str(e)[:120])
    try:
        a = spawn_class("/Script/Engine.Actor", "Tower_Poison_01", 2750.0, 950.0, 0.0)
        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="/Game/Materials/M_PoisonGlow.M_PoisonGlow")
        to_folder(a, "Level01/Towers")
        spawned.append("Tower_Poison_01")
    except Exception as e:
        errors.append("Tower_Poison_01: " + str(e)[:120])
    try:
        a = spawn_class("/Script/Engine.Actor", "Tower_Arrow_02", 5450.0, 950.0, 0.0)
        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        to_folder(a, "Level01/Towers")
        spawned.append("Tower_Arrow_02")
    except Exception as e:
        errors.append("Tower_Arrow_02: " + str(e)[:120])
    try:
        a = spawn_class("/Script/Engine.Actor", "Tower_Revive_01", 4150.0, 1250.0, 0.0)
        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="/Game/Materials/M_SoulGlow.M_SoulGlow")
        to_folder(a, "Level01/Towers")
        spawned.append("Tower_Revive_01")
    except Exception as e:
        errors.append("Tower_Revive_01: " + str(e)[:120])
    try:
        a = spawn_class("/Script/Engine.Actor", "Tower_Arrow_03", 950.0, 1650.0, 0.0)
        add_prim(a, "cyl", "Base", (40.0, 140.0), 70.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        add_prim(a, "cone", "Top", (45.0, 80.0), 180.0, mat="/Game/Materials/M_BoneTower.M_BoneTower")
        to_folder(a, "Level01/Towers")
        spawned.append("Tower_Arrow_03")
    except Exception as e:
        errors.append("Tower_Arrow_03: " + str(e)[:120])
    # --- Gate ---
    try:
        g = spawn_class("/Script/Engine.Actor", "Gate", 6000.0, 1100.0, 0.0)
        add_prim(g, "cube", "Body", (200.0, 200.0, 120.0), 60.0, mat="/Game/Materials/M_Rock.M_Rock")
        add_prim(g, "cube", "TrimTop", (200.0, 200.0, 12.0), 126.0, mat="/Game/Materials/M_BoneWall.M_BoneWall")
        add_prim(g, "cube", "TrimL", (24.0, 200.0, 140.0), 70.0, lx=-88.0, mat="/Game/Materials/M_BoneWall.M_BoneWall")
        add_prim(g, "cube", "TrimR", (24.0, 200.0, 140.0), 70.0, lx=88.0, mat="/Game/Materials/M_BoneWall.M_BoneWall")
        to_folder(g, "Level01/Interactive")
        spawned.append("Gate")
    except Exception as e:
        errors.append("Gate: " + str(e)[:120])
    # --- Tombs (9) ---
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_01", 3650.0, 450.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_01")
    except Exception as e:
        errors.append("Tomb_01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_02", 4250.0, 550.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_02")
    except Exception as e:
        errors.append("Tomb_02: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_03", 4650.0, 650.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_03")
    except Exception as e:
        errors.append("Tomb_03: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_04", 3850.0, 750.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_04")
    except Exception as e:
        errors.append("Tomb_04: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_05", 4550.0, 950.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_05")
    except Exception as e:
        errors.append("Tomb_05: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_06", 3650.0, 1250.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_06")
    except Exception as e:
        errors.append("Tomb_06: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_07", 4450.0, 1450.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_07")
    except Exception as e:
        errors.append("Tomb_07: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_08", 3950.0, 1650.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_08")
    except Exception as e:
        errors.append("Tomb_08: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "Tomb_09", 4650.0, 1750.0, 35.0, 0.4, 0.15, 0.7)
        override_mat(a, "/Game/Materials/M_Tomb.M_Tomb")
        to_folder(a, "Level01/Interactive")
        spawned.append("Tomb_09")
    except Exception as e:
        errors.append("Tomb_09: " + str(e)[:120])
    # --- Rift / DigSite / Spawn marker ---
    try:
        a = spawn("/Engine/BasicShapes/Cylinder", "Rift", 3850.0, 2150.0, 4.0, 0.8, 0.8, 0.08)
        override_mat(a, "/Game/Materials/M_RiftGlow.M_RiftGlow")
        to_folder(a, "Level01/Interactive"); spawned.append("Rift")
    except Exception as e:
        errors.append("Rift: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Sphere", "DigSite", 3450.0, 1850.0, 25.0, 0.5, 0.5, 0.5)
        override_mat(a, "/Game/Materials/M_Gold.M_Gold")
        to_folder(a, "Level01/Interactive"); spawned.append("DigSite")
    except Exception as e:
        errors.append("DigSite: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "SpawnMarker", 150.0, 1050.0, 5.0, 0.5, 0.5, 0.1)
        override_mat(a, "/Game/Materials/M_Player.M_Player")
        to_folder(a, "Level01/Interactive"); spawned.append("SpawnMarker")
    except Exception as e:
        errors.append("SpawnMarker: " + str(e)[:120])
    return {"spawned": spawned, "errors": errors}