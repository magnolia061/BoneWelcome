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


def run():
    spawned = 0
    errors = []
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r00_c00", 3200.0, 50.0, 100.0, 64.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r00_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r01_c00", 50.0, 150.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r01_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r01_c01", 3200.0, 150.0, -5.0, 62.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r01_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r01_c63", 6350.0, 150.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r01_c63: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r02_c00", 50.0, 250.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r02_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r02_c01", 750.0, 250.0, -5.0, 13.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r02_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r02_c14", 2300.0, 250.0, 35.0, 18.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r02_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r02_c32", 4550.0, 250.0, -5.0, 27.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r02_c32: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r02_c59", 6150.0, 250.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r02_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r03_c00", 50.0, 350.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r03_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r03_c01", 750.0, 350.0, -5.0, 13.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r03_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r03_c14", 2300.0, 350.0, 35.0, 18.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r03_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r03_c32", 4550.0, 350.0, -5.0, 27.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r03_c32: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r03_c59", 6150.0, 350.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r03_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r04_c00", 50.0, 450.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r04_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r04_c01", 750.0, 450.0, -5.0, 13.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r04_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r04_c14", 1900.0, 450.0, 35.0, 10.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r04_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r04_c24", 2450.0, 450.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r04_c24: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r04_c25", 2800.0, 450.0, 35.0, 6.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r04_c25: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ramp_r04_c31", 3150.0, 450.0, 15.0, 1.0, 1.0, 0.5)
        override_mat(a, "/Game/Materials/M_Ramp.M_Ramp")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ramp_r04_c31: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r04_c32", 4550.0, 450.0, -5.0, 27.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r04_c32: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r04_c59", 6150.0, 450.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r04_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r05_c00", 50.0, 550.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r05_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r05_c01", 750.0, 550.0, -5.0, 13.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r05_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r05_c14", 2300.0, 550.0, 35.0, 18.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r05_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r05_c32", 4550.0, 550.0, -5.0, 27.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r05_c32: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r05_c59", 6150.0, 550.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r05_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r06_c00", 50.0, 650.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r06_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r06_c01", 750.0, 650.0, -5.0, 13.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r06_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r06_c14", 2300.0, 650.0, 35.0, 18.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r06_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r06_c32", 4550.0, 650.0, -5.0, 27.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r06_c32: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r06_c59", 6150.0, 650.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r06_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r07_c00", 50.0, 750.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r07_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r07_c01", 700.0, 750.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r07_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r07_c13", 1350.0, 750.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r07_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ramp_r07_c14", 1450.0, 750.0, 15.0, 1.0, 1.0, 0.5)
        override_mat(a, "/Game/Materials/M_Ramp.M_Ramp")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ramp_r07_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r07_c15", 2350.0, 750.0, 100.0, 17.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r07_c15: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r07_c33", 4100.0, 750.0, -5.0, 16.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r07_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r07_c49", 5100.0, 750.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r07_c49: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r07_c53", 5600.0, 750.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r07_c53: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r07_c59", 6150.0, 750.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r07_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r08_c00", 50.0, 850.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r08_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r08_c01", 1650.0, 850.0, -5.0, 31.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r08_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r08_c33", 4100.0, 850.0, -5.0, 16.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r08_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r08_c49", 5100.0, 850.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r08_c49: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r08_c53", 5600.0, 850.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r08_c53: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r08_c59", 6150.0, 850.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r08_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r09_c00", 50.0, 950.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r09_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r09_c01", 1650.0, 950.0, -5.0, 31.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r09_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r09_c33", 4100.0, 950.0, -5.0, 16.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r09_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r09_c49", 5100.0, 950.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r09_c49: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r09_c53", 5600.0, 950.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r09_c53: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r09_c59", 6150.0, 950.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r09_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r10_c00", 50.0, 1050.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r10_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r10_c01", 150.0, 1050.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r10_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Road_r10_c02", 1700.0, 1050.0, -5.0, 30.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Road.M_Road")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Road_r10_c02: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Road_r10_c33", 4700.0, 1050.0, -5.0, 28.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Road.M_Road")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Road_r10_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r10_c61", 6250.0, 1050.0, 100.0, 3.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r10_c61: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r11_c00", 50.0, 1150.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r11_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Road_r11_c01", 1650.0, 1150.0, -5.0, 31.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Road.M_Road")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Road_r11_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Road_r11_c33", 4700.0, 1150.0, -5.0, 28.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Road.M_Road")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Road_r11_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r11_c61", 6250.0, 1150.0, 100.0, 3.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r11_c61: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r12_c00", 50.0, 1250.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r12_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r12_c01", 1650.0, 1250.0, -5.0, 31.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r12_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r12_c33", 4600.0, 1250.0, -5.0, 26.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r12_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r12_c59", 6150.0, 1250.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r12_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r13_c00", 50.0, 1350.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r13_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r13_c01", 700.0, 1350.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r13_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r13_c13", 2100.0, 1350.0, 100.0, 16.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r13_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r13_c29", 3050.0, 1350.0, -5.0, 3.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r13_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r13_c33", 4100.0, 1350.0, -5.0, 16.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r13_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r13_c49", 5100.0, 1350.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r13_c49: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r13_c53", 5600.0, 1350.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r13_c53: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r13_c59", 6150.0, 1350.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r13_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r14_c00", 50.0, 1450.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r14_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r14_c01", 700.0, 1450.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r14_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r14_c13", 2100.0, 1450.0, 100.0, 16.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r14_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r14_c29", 3050.0, 1450.0, -5.0, 3.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r14_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r14_c33", 3700.0, 1450.0, -5.0, 8.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r14_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r14_c41", 4150.0, 1450.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r14_c41: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r14_c42", 4550.0, 1450.0, -5.0, 7.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r14_c42: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r14_c49", 5100.0, 1450.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r14_c49: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r14_c53", 5600.0, 1450.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r14_c53: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r14_c59", 6150.0, 1450.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r14_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r15_c00", 50.0, 1550.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r15_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r15_c01", 700.0, 1550.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r15_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r15_c13", 2100.0, 1550.0, 35.0, 16.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r15_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r15_c29", 3050.0, 1550.0, -5.0, 3.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r15_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r15_c33", 3700.0, 1550.0, -5.0, 8.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r15_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r15_c41", 4150.0, 1550.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r15_c41: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r15_c42", 4550.0, 1550.0, -5.0, 7.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r15_c42: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r15_c49", 5100.0, 1550.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r15_c49: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r15_c53", 5600.0, 1550.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r15_c53: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r15_c59", 6150.0, 1550.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r15_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r16_c00", 50.0, 1650.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r16_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r16_c01", 700.0, 1650.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r16_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r16_c13", 2100.0, 1650.0, 35.0, 16.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r16_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r16_c29", 3050.0, 1650.0, -5.0, 3.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r16_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r16_c33", 3700.0, 1650.0, -5.0, 8.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r16_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r16_c41", 4150.0, 1650.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r16_c41: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r16_c42", 5050.0, 1650.0, -5.0, 17.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r16_c42: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r16_c59", 6150.0, 1650.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r16_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r17_c00", 50.0, 1750.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r17_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r17_c01", 700.0, 1750.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r17_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r17_c13", 2100.0, 1750.0, 35.0, 16.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r17_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r17_c29", 3050.0, 1750.0, -5.0, 3.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r17_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r17_c33", 3700.0, 1750.0, -5.0, 8.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r17_c33: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r17_c41", 4150.0, 1750.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r17_c41: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r17_c42", 5050.0, 1750.0, -5.0, 17.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r17_c42: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r17_c59", 6150.0, 1750.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r17_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r18_c00", 50.0, 1850.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r18_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r18_c01", 700.0, 1850.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r18_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r18_c13", 2100.0, 1850.0, 35.0, 16.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r18_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r18_c29", 3200.0, 1850.0, -5.0, 6.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r18_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r18_c35", 3850.0, 1850.0, -5.0, 7.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r18_c35: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r18_c42", 5050.0, 1850.0, -5.0, 17.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r18_c42: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r18_c59", 6150.0, 1850.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r18_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r19_c00", 50.0, 1950.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r19_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r19_c01", 700.0, 1950.0, -5.0, 12.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r19_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ramp_r19_c13", 1350.0, 1950.0, 15.0, 1.0, 1.0, 0.5)
        override_mat(a, "/Game/Materials/M_Ramp.M_Ramp")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ramp_r19_c13: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_High_r19_c14", 2150.0, 1950.0, 35.0, 15.0, 1.0, 0.9)
        override_mat(a, "/Game/Materials/M_High.M_High")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_High_r19_c14: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r19_c29", 4400.0, 1950.0, -5.0, 30.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r19_c29: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r19_c59", 6150.0, 1950.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r19_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r20_c00", 50.0, 2050.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r20_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r20_c01", 1800.0, 2050.0, -5.0, 34.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r20_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r20_c35", 3900.0, 2050.0, -5.0, 8.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r20_c35: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r20_c43", 5100.0, 2050.0, -5.0, 16.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r20_c43: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r20_c59", 6150.0, 2050.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r20_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r21_c00", 50.0, 2150.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r21_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r21_c01", 1800.0, 2150.0, -5.0, 34.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r21_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r21_c35", 3650.0, 2150.0, -5.0, 3.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r21_c35: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r21_c38", 3850.0, 2150.0, -5.0, 1.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r21_c38: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r21_c39", 4100.0, 2150.0, -5.0, 4.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r21_c39: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r21_c43", 5100.0, 2150.0, -5.0, 16.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r21_c43: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r21_c59", 6150.0, 2150.0, 100.0, 5.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r21_c59: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r22_c00", 50.0, 2250.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r22_c00: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r22_c01", 1800.0, 2250.0, -5.0, 34.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r22_c01: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Marsh_r22_c35", 3900.0, 2250.0, -5.0, 8.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Marsh.M_Marsh")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Marsh_r22_c35: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Ground_r22_c43", 5300.0, 2250.0, -5.0, 20.0, 1.0, 0.1)
        override_mat(a, "/Game/Materials/M_Ground.M_Ground")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Ground_r22_c43: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r22_c63", 6350.0, 2250.0, 100.0, 1.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r22_c63: " + str(e)[:120])
    try:
        a = spawn("/Engine/BasicShapes/Cube", "T_Rock_r23_c00", 3200.0, 2350.0, 100.0, 64.0, 1.0, 2.0)
        override_mat(a, "/Game/Materials/M_Rock.M_Rock")
        to_folder(a, "Level01/Terrain")
        spawned += 1
    except Exception as e:
        errors.append("T_Rock_r23_c00: " + str(e)[:120])
    return {"spawned": spawned, "errors": errors}