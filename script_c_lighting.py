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
